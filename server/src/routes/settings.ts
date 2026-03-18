import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const settingsSchema = z.object({
  googleApiKey: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  sendgridApiKey: z.string().optional(),
  whatsAppPhoneId: z.string().optional(),
  whatsAppToken: z.string().optional(),
  senderName: z.string().optional(),
  senderEmail: z.string().email().optional().or(z.literal('')),
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

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { userId: req.user!.userId },
    });

    if (!settings) {
      const created = await prisma.settings.create({
        data: { userId: req.user!.userId },
      });
      return res.json(maskApiKeys(created));
    }

    res.json(maskApiKeys(settings));
  } catch {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = settingsSchema.parse(req.body);

    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== '' && v !== undefined) clean[k] = v;
    }

    const settings = await prisma.settings.upsert({
      where: { userId: req.user!.userId },
      update: clean,
      create: { userId: req.user!.userId, ...clean },
    });

    res.json(maskApiKeys(settings));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

function maskApiKeys(settings: Record<string, unknown>) {
  return {
    ...settings,
    googleApiKey: settings.googleApiKey ? '••••••••' : null,
    anthropicApiKey: settings.anthropicApiKey ? '••••••••' : null,
    sendgridApiKey: settings.sendgridApiKey ? '••••••••' : null,
    whatsAppToken: settings.whatsAppToken ? '••••••••' : null,
    hasGoogleApiKey: !!settings.googleApiKey,
    hasAnthropicApiKey: !!settings.anthropicApiKey,
    hasSendgridApiKey: !!settings.sendgridApiKey,
    hasWhatsAppToken: !!settings.whatsAppToken,
  };
}

export default router;
