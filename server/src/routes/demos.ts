import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const demoSchema = z.object({
  industry: z.string().min(1),
  url: z.string().url(),
  label: z.string().min(1),
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const demos = await prisma.demoLink.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(demos);
  } catch {
    res.status(500).json({ error: 'Failed to fetch demo links' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = demoSchema.parse(req.body);
    const demo = await prisma.demoLink.create({
      data: { ...data, userId: req.user!.userId },
    });
    res.status(201).json(demo);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to create demo link' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const data = demoSchema.partial().parse(req.body);
    const result = await prisma.demoLink.updateMany({
      where: { id: req.params.id, userId: req.user!.userId },
      data,
    });
    if (result.count === 0) return res.status(404).json({ error: 'Demo link not found' });
    const updated = await prisma.demoLink.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to update demo link' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.demoLink.deleteMany({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Demo link not found' });
    res.json({ message: 'Demo link deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete demo link' });
  }
});

export default router;
