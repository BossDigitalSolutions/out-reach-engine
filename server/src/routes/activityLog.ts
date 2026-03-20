import { Router, Response } from 'express';
import { prisma } from '../index';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

// GET /api/activity-log
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      userId,
      action,
      dateFrom,
      dateTo,
      page = '1',
      limit = '50',
    } = req.query;

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId as string;
    if (action) where.action = action as string;
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom as string) } : {}),
        ...(dateTo ? { lte: new Date(dateTo as string) } : {}),
      };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, name: true } },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    res.json({ logs, total });
  } catch {
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

// GET /api/activity-log/actions — list distinct action types
router.get('/actions', async (_req, res: Response) => {
  try {
    const result = await prisma.activityLog.findMany({
      select: { action: true },
      distinct: ['action'],
    });
    res.json(result.map((r) => r.action));
  } catch {
    res.status(500).json({ error: 'Failed to fetch actions' });
  }
});

export default router;
