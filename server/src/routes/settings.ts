import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { encryptField, decryptField } from '../services/encryption';
import { logActivity } from '../services/activityLogger';

const router = Router();
router.use(authenticate);

// Fields only admin can read/write
const ADMIN_ONLY_FIELDS = [
  'googleApiKey',
  'anthropicApiKey',
  'sendgridApiKey',
  'senderEmail',
  'whatsAppPhoneId',
  'whatsAppToken',
  'ghlApiKey',
  'ghlLocationId',
];

const settingsSchema = z.object({
  // Admin-only
  googleApiKey: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  sendgridApiKey: z.string().optional(),
  whatsAppPhoneId: z.string().optional(),
  whatsAppToken: z.string().optional(),
  ghlApiKey: z.string().optional(),
  ghlLocationId: z.string().optional(),
  senderEmail: z.string().email().optional().or(z.literal('')),
  // All users
  senderName: z.string().optional(),
  emailSignature: z.string().optional(),
  dailySendLimit: z.number().min(1).max(500).optional(),
  unsubscribeUrl: z.string().url().optional().or(z.literal('')),
  warmupMode: z.boolean().optional(),
  followupsEnabled: z.boolean().optional(),
  followupInterval1: z.number().min(1).max(30).optional(),
  followupInterval2: z.number().min(1).max(60).optional(),
  followupInterval3: z.number().min(1).max(90).optional(),
  industryWeights: z.record(z.number().min(0).max(25)).optional(),
});

// Decrypt and return actual key for internal use (never sent to client)
export async function getDecryptedSettings(userId: string) {
  const settings = await prisma.settings.findUnique({ where: { userId } });
  if (!settings) return null;
  return {
    ...settings,
    googleApiKey: decryptField(settings.googleApiKey),
    anthropicApiKey: decryptField(settings.anthropicApiKey),
    sendgridApiKey: decryptField(settings.sendgridApiKey),
    whatsAppToken: decryptField(settings.whatsAppToken),
    ghlApiKey: decryptField(settings.ghlApiKey),
  };
}

function maskApiKeys(settings: Record<string, unknown>, isAdmin: boolean) {
  const base = { ...settings };

  if (!isAdmin) {
    // Non-admins see nothing about API keys
    for (const field of ADMIN_ONLY_FIELDS) {
      delete base[field];
    }
    base.hasGoogleApiKey = false;
    base.hasAnthropicApiKey = false;
    base.hasSendgridApiKey = false;
    base.hasWhatsAppToken = false;
    base.hasGhlApiKey = false;
    return base;
  }

  return {
    ...base,
    googleApiKey: settings.googleApiKey ? '••••••••' : null,
    anthropicApiKey: settings.anthropicApiKey ? '••••••••' : null,
    sendgridApiKey: settings.sendgridApiKey ? '••••••••' : null,
    whatsAppToken: settings.whatsAppToken ? '••••••••' : null,
    ghlApiKey: settings.ghlApiKey ? '••••••••' : null,
    hasGoogleApiKey: !!settings.googleApiKey,
    hasAnthropicApiKey: !!settings.anthropicApiKey,
    hasSendgridApiKey: !!settings.sendgridApiKey,
    hasWhatsAppToken: !!settings.whatsAppToken,
    hasGhlApiKey: !!settings.ghlApiKey,
  };
}

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.user!.role === 'ADMIN';
    let settings = await prisma.settings.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: { userId: req.user!.userId },
      });
    }

    res.json(maskApiKeys(settings as Record<string, unknown>, isAdmin));
  } catch {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.user!.role === 'ADMIN';
    const data = settingsSchema.parse(req.body);

    // Strip admin-only fields for non-admins
    if (!isAdmin) {
      for (const field of ADMIN_ONLY_FIELDS) {
        if (field in data) {
          await logActivity({
            userId: req.user!.userId,
            userEmail: req.user!.email,
            action: 'ADMIN_ACCESS_BLOCKED',
            metadata: { attempted: `settings.${field}` },
            req,
          });
          return res.status(403).json({
            error: 'Only admins can change API keys and sender settings',
          });
        }
      }
    }

    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === '' || v === undefined) continue;
      // Encrypt API key fields
      if (ADMIN_ONLY_FIELDS.slice(0, 7).includes(k) && typeof v === 'string') {
        clean[k] = encryptField(v);
      } else {
        clean[k] = v;
      }
    }

    const settings = await prisma.settings.upsert({
      where: { userId: req.user!.userId },
      update: clean,
      create: { userId: req.user!.userId, ...clean },
    });

    await logActivity({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      action: 'SETTINGS_UPDATED',
      metadata: { fields: Object.keys(clean) },
      req,
    });

    res.json(maskApiKeys(settings as Record<string, unknown>, isAdmin));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
