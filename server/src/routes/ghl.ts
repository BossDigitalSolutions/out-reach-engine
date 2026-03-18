import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { syncContactToGhl, sendGhlMessage, getGhlConversations } from '../services/ghl';

const router = Router();
router.use(authenticate);

// Helper to get GHL credentials or return an error
async function getGhlCredentials(userId: string): Promise<{ apiKey: string; locationId: string } | null> {
  const settings = await prisma.settings.findUnique({ where: { userId } });
  const apiKey = settings?.ghlApiKey || process.env.GHL_API_KEY;
  const locationId = settings?.ghlLocationId || process.env.GHL_LOCATION_ID;
  if (!apiKey || !locationId) return null;
  return { apiKey, locationId };
}

// POST /api/ghl/sync
// Body: { leadIds: string[] }
// Syncs one or more leads to GHL as contacts
router.post('/sync', async (req: AuthRequest, res: Response) => {
  try {
    const { leadIds } = z.object({ leadIds: z.array(z.string()).min(1) }).parse(req.body);

    const creds = await getGhlCredentials(req.user!.userId);
    if (!creds) {
      return res.status(400).json({
        error: 'GoHighLevel API key and Location ID are not configured. Add them in Settings.',
      });
    }

    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds }, userId: req.user!.userId },
    });

    const results: Array<{ leadId: string; ghlContactId: string; businessName: string }> = [];
    const errors: Array<{ leadId: string; error: string }> = [];

    for (const lead of leads) {
      try {
        const ghlContactId = await syncContactToGhl(
          {
            businessName: lead.businessName,
            ownerName: lead.ownerName,
            email: lead.email,
            phone: lead.phone,
            address: lead.address,
            city: lead.city,
            state: lead.state,
            industry: lead.industry,
            websiteUrl: lead.websiteUrl,
            googleRating: lead.googleRating,
            description: lead.description,
            ghlContactId: lead.ghlContactId,
          },
          creds.apiKey,
          creds.locationId
        );

        // Save the GHL contact ID back to the lead
        await prisma.lead.update({
          where: { id: lead.id },
          data: { ghlContactId },
        });

        results.push({ leadId: lead.id, ghlContactId, businessName: lead.businessName });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sync failed';
        errors.push({ leadId: lead.id, error: message });
      }
    }

    res.json({ synced: results.length, failed: errors.length, results, errors });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to sync to GoHighLevel' });
  }
});

// POST /api/ghl/message
// Send a message through GHL to a lead (WhatsApp, Email, or SMS)
router.post('/message', async (req: AuthRequest, res: Response) => {
  try {
    const { leadId, message, type, subject } = z
      .object({
        leadId: z.string(),
        message: z.string().min(1),
        type: z.enum(['WhatsApp', 'Email', 'SMS']),
        subject: z.string().optional(),
      })
      .parse(req.body);

    const creds = await getGhlCredentials(req.user!.userId);
    if (!creds) {
      return res.status(400).json({
        error: 'GoHighLevel API key and Location ID are not configured. Add them in Settings.',
      });
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, userId: req.user!.userId },
    });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // Auto-sync to GHL first if not already done
    let ghlContactId = lead.ghlContactId;
    if (!ghlContactId) {
      ghlContactId = await syncContactToGhl(
        {
          businessName: lead.businessName,
          ownerName: lead.ownerName,
          email: lead.email,
          phone: lead.phone,
          address: lead.address,
          city: lead.city,
          state: lead.state,
          industry: lead.industry,
          websiteUrl: lead.websiteUrl,
          googleRating: lead.googleRating,
          description: lead.description,
        },
        creds.apiKey,
        creds.locationId
      );
      await prisma.lead.update({
        where: { id: lead.id },
        data: { ghlContactId },
      });
    }

    const messageId = await sendGhlMessage(
      ghlContactId,
      message,
      type,
      creds.apiKey,
      creds.locationId,
      subject
    );

    // Update lead status to CONTACTED if still NEW
    await prisma.lead.updateMany({
      where: { id: lead.id, status: 'NEW' },
      data: { status: 'CONTACTED' },
    });

    res.json({ messageId, ghlContactId });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    const apiErr = err as { response?: { data?: { message?: string } } };
    const detail = apiErr?.response?.data?.message || (err instanceof Error ? err.message : 'GHL error');
    res.status(500).json({ error: `GoHighLevel error: ${detail}` });
  }
});

// GET /api/ghl/conversations/:leadId
// Fetch conversation history for a lead from GHL
router.get('/conversations/:leadId', async (req: AuthRequest, res: Response) => {
  try {
    const creds = await getGhlCredentials(req.user!.userId);
    if (!creds) {
      return res.status(400).json({ error: 'GoHighLevel not configured' });
    }

    const lead = await prisma.lead.findFirst({
      where: { id: req.params.leadId, userId: req.user!.userId },
    });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!lead.ghlContactId) return res.json({ conversations: [] });

    const conversations = await getGhlConversations(lead.ghlContactId, creds.apiKey, creds.locationId);
    res.json({ conversations });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch conversations';
    res.status(500).json({ error: message });
  }
});

// GET /api/ghl/status — check if GHL is configured
router.get('/status', async (req: AuthRequest, res: Response) => {
  const creds = await getGhlCredentials(req.user!.userId);
  res.json({ configured: !!creds });
});

export default router;
