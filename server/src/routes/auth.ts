import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, AuthRequest, SUPER_ADMIN_EMAIL, hashToken } from '../middleware/auth';
import { logActivity, getIp } from '../services/activityLogger';
import speakeasy from 'speakeasy';

const router = Router();

const LOCK_THRESHOLD = 5;
const LOCK_MINUTES = 30;
const SESSION_DAYS = 30;
const MAX_SESSIONS = 3;

// Strong password: 10+ chars, uppercase, lowercase, number, special char
const strongPassword = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');

const registerSchema = z.object({
  email: z.string().email(),
  password: strongPassword,
  name: z.string().optional(),
  inviteToken: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  totpCode: z.string().optional(),
});

async function createSession(
  userId: string,
  token: string,
  req: Request
): Promise<void> {
  const tokenHash = hashToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  // Enforce max sessions: remove oldest if at limit
  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  });
  if (sessions.length >= MAX_SESSIONS) {
    const toDelete = sessions.slice(0, sessions.length - MAX_SESSIONS + 1);
    await prisma.session.deleteMany({
      where: { id: { in: toDelete.map((s) => s.id) } },
    });
  }

  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown';

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      ipAddress: ip,
      userAgent: req.headers['user-agent'] || null,
      expiresAt,
    },
  });
}

function signToken(user: { id: string; email: string; role: string }, sessionId?: string): string {
  const role = user.email === SUPER_ADMIN_EMAIL ? 'ADMIN' : user.role;
  return jwt.sign(
    { userId: user.id, email: user.email, role, sessionId: sessionId || user.id },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: `${SESSION_DAYS}d` }
  );
}

// POST /api/auth/register
// Public registration disabled after first user — admin must invite members via /api/team
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = registerSchema.parse(req.body);

    // Allow first registration (super admin), then block public signups
    const userCount = await prisma.user.count();
    if (userCount > 0 && email !== SUPER_ADMIN_EMAIL) {
      return res.status(403).json({
        error: 'Registration is closed. Contact your admin to be invited.',
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const role = email === SUPER_ADMIN_EMAIL ? 'ADMIN' : 'MEMBER';
    const user = await prisma.user.create({
      data: { email, password: hashed, name, role: role as 'ADMIN' | 'MEMBER' },
    });

    await prisma.settings.create({ data: { userId: user.id } });

    const token = signToken(user);
    await createSession(user.id, token, req);

    await logActivity({
      userId: user.id,
      userEmail: user.email,
      action: 'REGISTER',
      req,
    });

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, totpCode } = loginSchema.parse(req.body);
    const ip = getIp(req);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await logActivity({ userEmail: email, action: 'LOGIN_FAILED', req, metadata: { reason: 'user_not_found' } });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      await logActivity({ userId: user.id, userEmail: user.email, action: 'LOGIN_LOCKED', req });
      return res.status(423).json({
        error: `Account locked due to too many failed attempts. Try again in ${minutesLeft} minute(s).`,
      });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const lockData: Record<string, unknown> = { failedLoginAttempts: attempts };
      if (attempts >= LOCK_THRESHOLD) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + LOCK_MINUTES);
        lockData.lockedUntil = lockUntil;
      }
      await prisma.user.update({ where: { id: user.id }, data: lockData });
      await logActivity({
        userId: user.id,
        userEmail: user.email,
        action: 'LOGIN_FAILED',
        req,
        metadata: { attempt: attempts },
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check 2FA if enabled
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!totpCode) {
        return res.status(200).json({ requiresTwoFactor: true });
      }
      const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: totpCode,
      window: 1,
    });
      if (!isValid) {
        await logActivity({
          userId: user.id,
          userEmail: user.email,
          action: 'LOGIN_FAILED',
          req,
          metadata: { reason: '2fa_invalid' },
        });
        return res.status(401).json({ error: 'Invalid 2FA code' });
      }
    }

    // Reset failed attempts, update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      },
    });

    const token = signToken(user);
    await createSession(user.id, token, req);

    await logActivity({
      userId: user.id,
      userEmail: user.email,
      action: 'LOGIN_SUCCESS',
      req,
      metadata: { ip },
    });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.email === SUPER_ADMIN_EMAIL ? 'ADMIN' : user.role,
        lastLoginAt: user.lastLoginAt,
        lastLoginIp: user.lastLoginIp,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        twoFactorEnabled: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const role = user.email === SUPER_ADMIN_EMAIL ? 'ADMIN' : user.role;
    res.json({ ...user, role });
  } catch {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const tokenHash = hashToken(token);
      await prisma.session.deleteMany({ where: { tokenHash } });
    }
    await logActivity({ userId: req.user!.userId, userEmail: req.user!.email, action: 'LOGOUT', req });
    res.json({ message: 'Logged out' });
  } catch {
    res.json({ message: 'Logged out' });
  }
});

export default router;
