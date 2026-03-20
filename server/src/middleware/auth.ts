import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';

export const SUPER_ADMIN_EMAIL = 'alistaire.bosman0416@gmail.com';

export interface JwtPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  sessionId: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];
  let payload: JwtPayload;
  try {
    payload = jwt.verify(
      token,
      process.env.JWT_SECRET || 'fallback-secret'
    ) as JwtPayload;
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Validate session exists in DB (supports revocation)
  try {
    const tokenHash = hashToken(token);
    const session = await prisma.session.findUnique({ where: { tokenHash } });
    if (!session || session.expiresAt < new Date()) {
      res.status(401).json({ error: 'Session expired or revoked' });
      return;
    }
    // Update last active
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });
  } catch {
    // If sessions table doesn't exist yet (first deploy), fall through
  }

  // Hardcode super admin role — cannot be demoted
  if (payload.email === SUPER_ADMIN_EMAIL) {
    payload.role = 'ADMIN';
  }

  req.user = payload;
  next();
};

export const requireAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'ADMIN' && req.user.email !== SUPER_ADMIN_EMAIL) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
};
