import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, requireAdmin, AuthRequest, SUPER_ADMIN_EMAIL } from '../middleware/auth';
import { logActivity } from '../services/activityLogger';

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

// GET /api/team — list all users
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
        twoFactorEnabled: true,
        lockedUntil: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Enforce super admin display
    const result = users.map((u) => ({
      ...u,
      role: u.email === SUPER_ADMIN_EMAIL ? 'ADMIN' : u.role,
      isSuperAdmin: u.email === SUPER_ADMIN_EMAIL,
    }));

    res.json(result);
  } catch {
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// POST /api/team — admin creates a member account directly
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, name, role } = z
      .object({
        email: z.string().email(),
        password: z
          .string()
          .min(10, 'Password must be at least 10 characters')
          .regex(/[A-Z]/, 'Must contain uppercase')
          .regex(/[a-z]/, 'Must contain lowercase')
          .regex(/[0-9]/, 'Must contain a number')
          .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
        name: z.string().optional(),
        role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
      })
      .parse(req.body);

    // Super admin email cannot be created via invite (only via register)
    if (email === SUPER_ADMIN_EMAIL) {
      return res.status(400).json({ error: 'This email is reserved' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: 'Email already in use' });

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: hashed, name, role },
    });
    await prisma.settings.create({ data: { userId: user.id } });

    await logActivity({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      action: 'USER_INVITED',
      targetType: 'user',
      targetId: user.id,
      metadata: { email, role },
      req,
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PATCH /api/team/:id/role — change role (cannot touch super admin)
router.patch('/:id/role', async (req: AuthRequest, res: Response) => {
  try {
    const { role } = z.object({ role: z.enum(['ADMIN', 'MEMBER']) }).parse(req.body);

    const target = await prisma.user.findUnique({ where: { id: req.params.id as string } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.email === SUPER_ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Cannot modify the super admin account' });
    }

    await prisma.user.update({ where: { id: target.id }, data: { role } });

    await logActivity({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      action: 'USER_ROLE_CHANGED',
      targetType: 'user',
      targetId: target.id,
      metadata: { email: target.email, newRole: role },
      req,
    });

    res.json({ message: 'Role updated' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// DELETE /api/team/:id — remove user (cannot remove super admin or self)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id as string } });
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.email === SUPER_ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Cannot delete the super admin account' });
    }
    if (target.id === req.user!.userId) {
      return res.status(403).json({ error: 'Cannot delete your own account' });
    }

    await prisma.user.delete({ where: { id: target.id } });

    await logActivity({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      action: 'USER_REMOVED',
      targetType: 'user',
      targetId: target.id,
      metadata: { email: target.email },
      req,
    });

    res.json({ message: 'User removed' });
  } catch {
    res.status(500).json({ error: 'Failed to remove user' });
  }
});

// POST /api/team/:id/unlock — admin unlocks a locked account
router.post('/:id/unlock', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id as string },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
    res.json({ message: 'Account unlocked' });
  } catch {
    res.status(500).json({ error: 'Failed to unlock account' });
  }
});

export default router;
