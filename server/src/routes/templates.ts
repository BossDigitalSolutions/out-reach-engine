import { Router, Response, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// ── Public: prebuilt templates (no auth needed for browsing) ──────────────────
router.get('/prebuilt', async (req: Request, res: Response) => {
  try {
    const { industry } = req.query;

    const templates = await prisma.prebuiltTemplate.findMany({
      where: industry ? { industry: { contains: industry as string, mode: 'insensitive' } } : undefined,
      orderBy: [{ industry: 'asc' }, { seriesId: 'asc' }, { sequenceOrder: 'asc' }],
    });

    // Group by seriesId
    const seriesMap: Record<string, {
      seriesId: string;
      seriesName: string;
      industry: string;
      tone: string;
      emails: typeof templates;
    }> = {};

    for (const t of templates) {
      if (!seriesMap[t.seriesId]) {
        seriesMap[t.seriesId] = {
          seriesId: t.seriesId,
          seriesName: t.seriesName,
          industry: t.industry,
          tone: t.tone,
          emails: [],
        };
      }
      seriesMap[t.seriesId].emails.push(t);
    }

    res.json(Object.values(seriesMap));
  } catch {
    res.status(500).json({ error: 'Failed to fetch prebuilt templates' });
  }
});

// Get distinct industries from prebuilt templates
router.get('/prebuilt/industries', async (_req: Request, res: Response) => {
  try {
    const industries = await prisma.prebuiltTemplate.findMany({
      distinct: ['industry'],
      select: { industry: true },
      orderBy: { industry: 'asc' },
    });
    res.json(industries.map((i) => i.industry));
  } catch {
    res.status(500).json({ error: 'Failed to fetch industries' });
  }
});

// ── Authenticated: user templates ─────────────────────────────────────────────
router.use(authenticate);

const templateSchema = z.object({
  name: z.string().min(1),
  industry: z.string().optional(),
  subject: z.string().min(1),
  body: z.string().min(1),
  tone: z.enum(['professional', 'casual', 'friendly', 'bold']).optional().default('professional'),
  seriesId: z.string().optional(),
  sequenceOrder: z.number().min(1).max(4).optional().default(1),
  delayDays: z.number().min(0).optional().default(0),
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const templates = await prisma.emailTemplate.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(templates);
  } catch {
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = templateSchema.parse(req.body);
    const template = await prisma.emailTemplate.create({
      data: { ...data, userId: req.user!.userId },
    });
    res.status(201).json(template);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to create template' });
  }
});

router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const data = templateSchema.partial().parse(req.body);
    const result = await prisma.emailTemplate.updateMany({
      where: { id: req.params.id, userId: req.user!.userId },
      data,
    });
    if (result.count === 0) return res.status(404).json({ error: 'Template not found' });
    const updated = await prisma.emailTemplate.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to update template' });
  }
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.emailTemplate.deleteMany({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ message: 'Template deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
