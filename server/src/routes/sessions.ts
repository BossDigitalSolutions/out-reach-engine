import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, requireAdmin, AuthRequest, hashToken } from '../middleware/auth';
import { logActivity } from '../services/activityLogger';

const router = Router();
router.use(authenticate);

// GET /api/sessions — list own sessions
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { userId: req.user!.userId },
      orderBy: { lastActiveAt: 'desc' },
    });
    res.json(sessions);
  } catch {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// DELETE /api/sessions/:id — revoke a specific session
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const session = await prisma.session.findFirst({
      where: { id: req.params.id as string, userId: req.user!.userId },
    });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    await prisma.session.delete({ where: { id: session.id } });
    await logActivity({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      action: 'SESSION_REVOKED',
      targetId: session.id,
      req,
    });
    res.json({ message: 'Session revoked' });
  } catch {
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

// DELETE /api/sessions — revoke all own sessions (logout everywhere)
router.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    // Keep the current session unless "all" is explicitly requested
    const { all } = z.object({ all: z.boolean().optional() }).parse(req.body);

    if (all) {
      await prisma.session.deleteMany({ where: { userId: req.user!.userId } });
    } else {
      // Keep current session, revoke others
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const currentHash = hashToken(authHeader.split(' ')[1]);
        await prisma.session.deleteMany({
          where: { userId: req.user!.userId, tokenHash: { not: currentHash } },
        });
      }
    }

    await logActivity({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      action: 'ALL_SESSIONS_REVOKED',
      req,
    });
    res.json({ message: 'Sessions revoked' });
  } catch {
    res.status(500).json({ error: 'Failed to revoke sessions' });
  }
});

// Admin: GET /api/sessions/all — view all sessions across users
router.get('/all', requireAdmin, async (_req, res: Response) => {
  try {
    const sessions = await prisma.session.findMany({
      orderBy: { lastActiveAt: 'desc' },
      include: {
        user: { select: { email: true, name: true, role: true } },
      },
    });
    res.json(sessions);
  } catch {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Admin: DELETE /api/sessions/user/:userId — force-logout all sessions for a user
router.delete('/user/:userId', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const targetUserId = req.params.userId as string;
    await prisma.session.deleteMany({ where: { userId: targetUserId } });
    await logActivity({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      action: 'ALL_SESSIONS_REVOKED',
      targetType: 'user',
      targetId: targetUserId,
      req,
    });
    res.json({ message: 'All user sessions revoked' });
  } catch {
    res.status(500).json({ error: 'Failed to force logout' });
  }
});

export default router;
