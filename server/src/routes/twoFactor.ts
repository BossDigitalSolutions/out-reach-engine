import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { logActivity } from '../services/activityLogger';

const router = Router();
router.use(authenticate);

// POST /api/2fa/setup — generates a TOTP secret and returns the otpauth URL
router.post('/setup', async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }

    const generated = speakeasy.generateSecret({
      name: `OutreachEngine (${user.email})`,
      length: 20,
    });

    // Store secret temporarily (not yet confirmed)
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: generated.base32 },
    });

    res.json({ secret: generated.base32, otpauthUrl: generated.otpauth_url });
  } catch {
    res.status(500).json({ error: 'Failed to set up 2FA' });
  }
});

// POST /api/2fa/verify — confirms the TOTP code and enables 2FA, returns backup codes
router.post('/verify', async (req: AuthRequest, res: Response) => {
  try {
    const { code } = z.object({ code: z.string().length(6) }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ error: 'Run /setup first' });
    }
    if (user.twoFactorEnabled) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Generate 8 backup codes (plain for display, hashed for storage)
    const plainCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );
    const hashedCodes = await Promise.all(plainCodes.map((c) => bcrypt.hash(c, 10)));

    await prisma.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: true,
        backupCodes: JSON.stringify(hashedCodes),
      },
    });

    await logActivity({
      userId: user.id,
      userEmail: user.email,
      action: '2FA_ENABLED',
      req,
    });

    res.json({ backupCodes: plainCodes });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
});

// POST /api/2fa/disable — disables 2FA (requires current TOTP or backup code)
router.post('/disable', async (req: AuthRequest, res: Response) => {
  try {
    const { code } = z.object({ code: z.string() }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }

    // Try TOTP code
    const totpValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    // Try backup codes
    let backupValid = false;
    if (!totpValid && user.backupCodes) {
      const codes: string[] = JSON.parse(user.backupCodes);
      for (const hashed of codes) {
        if (await bcrypt.compare(code, hashed)) {
          backupValid = true;
          break;
        }
      }
    }

    if (!totpValid && !backupValid) {
      return res.status(400).json({ error: 'Invalid code' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null, backupCodes: null },
    });

    await logActivity({
      userId: user.id,
      userEmail: user.email,
      action: '2FA_DISABLED',
      req,
    });

    res.json({ message: '2FA disabled' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

export default router;
