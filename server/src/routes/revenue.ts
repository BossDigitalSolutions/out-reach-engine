import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const revenueSchema = z.object({
  leadId: z.string().optional(),
  amount: z.number().positive(),
  description: z.string().optional(),
  date: z.string().optional(),
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const entries = await prisma.revenueEntry.findMany({
      where: { userId: req.user!.userId },
      include: { lead: { select: { businessName: true, industry: true } } },
      orderBy: { date: 'desc' },
    });

    const total = entries.reduce((sum, e) => sum + e.amount, 0);
    res.json({ entries, total });
  } catch {
    res.status(500).json({ error: 'Failed to fetch revenue' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = revenueSchema.parse(req.body);
    const entry = await prisma.revenueEntry.create({
      data: {
        userId: req.user!.userId,
        leadId: data.leadId || null,
        amount: data.amount,
        description: data.description,
        date: data.date ? new Date(data.date) : new Date(),
      },
      include: { lead: { select: { businessName: true, industry: true } } },
    });
    res.status(201).json(entry);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to create revenue entry' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.revenueEntry.deleteMany({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json({ message: 'Deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete revenue entry' });
  }
});

export default router;
