import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { syncContactToGhl, sendGhlMessage, getGhlConversations } from '../services/ghl';
import { decryptField } from '../services/encryption';
import { generateSms } from '../services/claude';
import { startSmsSequence, stopSmsSequence, stopSequencesForLead, validateLeadForSequence, generateSequenceMessages } from '../services/smsSequence';

const router = Router();

// ─── GHL Inbound Webhook (public — no auth, called by GHL) ─────────────────
// Configure this URL in GHL → Settings → Webhooks → Inbound Message
router.post('/webhook/inbound', async (req: Request, res: Response) => {
  try {
    const { type, locationId, contactId, body, message, direction, messageType } = req.body || {};

    // Only process inbound messages (replies)
    if (direction !== 'inbound') {
      return res.sendStatus(200);
    }

    const messageBody = body || message || '';
    if (!contactId) return res.sendStatus(200);

    // Find the lead by GHL contact ID
    const lead = await prisma.lead.findFirst({
      where: { ghlContactId: contactId },
    });
    if (!lead) {
      console.log(`GHL webhook: no lead found for contactId ${contactId}`);
      return res.sendStatus(200);
    }

    // Update lead status to REPLIED
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: 'REPLIED' },
    });

    // Stop any active SMS sequences for this lead
    await stopSequencesForLead(lead.id);

    // Find the most recent sent email for this lead and mark it as replied
    const latestEmail = await prisma.email.findFirst({
      where: {
        leadId: lead.id,
        status: { in: ['SENT', 'OPENED', 'CLICKED'] },
      },
      orderBy: { sentAt: 'desc' },
    });

    if (latestEmail) {
      await prisma.email.update({
        where: { id: latestEmail.id },
        data: { status: 'REPLIED', repliedAt: new Date() },
      });
    }

    console.log(`GHL webhook: marked lead ${lead.businessName} as REPLIED (type: ${type || messageType})`);
    res.sendStatus(200);
  } catch (err) {
    console.error('GHL webhook error:', err instanceof Error ? err.message : err);
    res.sendStatus(200); // Always return 200 to GHL
  }
});

router.use(authenticate);

// Helper to get GHL credentials or return an error
async function getGhlCredentials(userId: string): Promise<{ apiKey: string; locationId: string } | null> {
  const settings = await prisma.settings.findUnique({ where: { userId } });
  const apiKey = decryptField(settings?.ghlApiKey) || process.env.GHL_API_KEY;
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

// POST /api/ghl/generate-sms — AI-generate an SMS for a single lead
router.post('/generate-sms', async (req: AuthRequest, res: Response) => {
  try {
    const { leadId } = z.object({ leadId: z.string() }).parse(req.body);

    const settings = await prisma.settings.findUnique({ where: { userId: req.user!.userId } });
    const apiKey = decryptField(settings?.anthropicApiKey) || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'Anthropic API key not configured. Add it in Settings.' });
    }

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, userId: req.user!.userId },
    });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // Auto-match demo link by industry
    const demoLinks = await prisma.demoLink.findMany({ where: { userId: req.user!.userId } });
    const demoLink =
      lead.customDemoLink ||
      demoLinks.find(
        (d) => lead.industry && d.industry.toLowerCase().includes(lead.industry.toLowerCase())
      )?.url ||
      null;

    const message = await generateSms(
      { lead, senderName: settings?.senderName || 'Alistaire', demoLink },
      apiKey
    );

    res.json({ message });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate SMS';
    res.status(500).json({ error: msg });
  }
});

// POST /api/ghl/generate-sms-bulk — AI-generate SMS for multiple leads
router.post('/generate-sms-bulk', async (req: AuthRequest, res: Response) => {
  try {
    const { leadIds } = z.object({ leadIds: z.array(z.string()).min(1) }).parse(req.body);

    const settings = await prisma.settings.findUnique({ where: { userId: req.user!.userId } });
    const apiKey = decryptField(settings?.anthropicApiKey) || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'Anthropic API key not configured. Add it in Settings.' });
    }

    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds }, userId: req.user!.userId },
    });

    // Fetch demo links for auto-matching
    const demoLinks = await prisma.demoLink.findMany({ where: { userId: req.user!.userId } });

    const results: Array<{ leadId: string; businessName: string; phone: string; message: string }> = [];
    const errors: Array<{ leadId: string; error: string }> = [];

    for (const lead of leads) {
      if (!lead.phone) {
        errors.push({ leadId: lead.id, error: 'No phone number' });
        continue;
      }
      try {
        // Auto-match demo link by industry
        const demoLink =
          lead.customDemoLink ||
          demoLinks.find(
            (d) => lead.industry && d.industry.toLowerCase().includes(lead.industry.toLowerCase())
          )?.url ||
          null;

        const message = await generateSms(
          { lead, senderName: settings?.senderName || 'Alistaire', demoLink },
          apiKey
        );
        results.push({ leadId: lead.id, businessName: lead.businessName, phone: lead.phone, message });
      } catch (err) {
        errors.push({ leadId: lead.id, error: err instanceof Error ? err.message : 'Generation failed' });
      }
    }

    res.json({ generated: results, errors });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to generate SMS messages' });
  }
});

// POST /api/ghl/send-sms-bulk — send multiple SMS via GHL
router.post('/send-sms-bulk', async (req: AuthRequest, res: Response) => {
  try {
    const { messages } = z.object({
      messages: z.array(z.object({
        leadId: z.string(),
        message: z.string().min(1),
      })),
    }).parse(req.body);

    const creds = await getGhlCredentials(req.user!.userId);
    if (!creds) {
      return res.status(400).json({ error: 'GoHighLevel not configured. Add API key and Location ID in Settings.' });
    }

    let sent = 0;
    const errors: Array<{ leadId: string; error: string }> = [];

    for (const { leadId, message } of messages) {
      try {
        const lead = await prisma.lead.findFirst({
          where: { id: leadId, userId: req.user!.userId },
        });
        if (!lead) { errors.push({ leadId, error: 'Lead not found' }); continue; }
        if (!lead.phone) { errors.push({ leadId, error: 'No phone number' }); continue; }

        // Auto-sync to GHL if needed
        let ghlContactId = lead.ghlContactId;
        if (!ghlContactId) {
          ghlContactId = await syncContactToGhl(
            {
              businessName: lead.businessName, ownerName: lead.ownerName,
              email: lead.email, phone: lead.phone, address: lead.address,
              city: lead.city, state: lead.state, industry: lead.industry,
              websiteUrl: lead.websiteUrl, googleRating: lead.googleRating,
              description: lead.description,
            },
            creds.apiKey, creds.locationId
          );
          await prisma.lead.update({ where: { id: lead.id }, data: { ghlContactId } });
        }

        await sendGhlMessage(ghlContactId, message, 'SMS', creds.apiKey, creds.locationId);
        await prisma.lead.updateMany({ where: { id: lead.id, status: 'NEW' }, data: { status: 'CONTACTED' } });
        sent++;
      } catch (err) {
        errors.push({ leadId, error: err instanceof Error ? err.message : 'Send failed' });
      }
    }

    res.json({ sent, failed: errors.length, errors });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to send SMS messages' });
  }
});

// ─── SMS Sequence Endpoints ─────────────────────────────────────────────────

// POST /api/ghl/sms-sequence/start — start SMS sequence for one or more leads
router.post('/sms-sequence/start', async (req: AuthRequest, res: Response) => {
  try {
    const { leadIds } = z.object({ leadIds: z.array(z.string()).min(1) }).parse(req.body);

    const creds = await getGhlCredentials(req.user!.userId);
    if (!creds) {
      return res.status(400).json({ error: 'GoHighLevel not configured. Add API key and Location ID in Settings.' });
    }

    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds }, userId: req.user!.userId },
    });

    // Fetch demo links for auto-matching
    const demoLinks = await prisma.demoLink.findMany({ where: { userId: req.user!.userId } });

    const started: Array<{ leadId: string; businessName: string; sequenceId: string; message1: string; message2: string; message3: string }> = [];
    const errors: Array<{ leadId: string; businessName: string; error: string; missing?: string[] }> = [];

    for (const lead of leads) {
      // Validate required fields
      const validation = validateLeadForSequence(lead);
      if (!validation.valid) {
        errors.push({ leadId: lead.id, businessName: lead.businessName, error: 'Missing required fields', missing: validation.missing });
        continue;
      }

      // Find demo link
      const demoLink =
        lead.customDemoLink ||
        demoLinks.find(
          (d) => lead.industry && d.industry.toLowerCase().includes(lead.industry!.toLowerCase())
        )?.url;

      if (!demoLink) {
        errors.push({ leadId: lead.id, businessName: lead.businessName, error: 'No demo link found for this industry. Add one in Demo Links.' });
        continue;
      }

      try {
        const result = await startSmsSequence(req.user!.userId, lead.id, demoLink);
        started.push({ leadId: lead.id, businessName: lead.businessName, sequenceId: result.id, message1: result.message1, message2: result.message2, message3: result.message3 });
      } catch (err) {
        errors.push({ leadId: lead.id, businessName: lead.businessName, error: err instanceof Error ? err.message : 'Failed to start sequence' });
      }
    }

    res.json({ started: started.length, failed: errors.length, results: started, errors });
  } catch (err) {
    console.error('SMS sequence start error:', err);
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    const message = err instanceof Error ? err.message : 'Failed to start SMS sequences';
    res.status(500).json({ error: message });
  }
});

// POST /api/ghl/sms-sequence/stop — stop an active SMS sequence
router.post('/sms-sequence/stop', async (req: AuthRequest, res: Response) => {
  try {
    const { sequenceId } = z.object({ sequenceId: z.string() }).parse(req.body);
    await stopSmsSequence(sequenceId, req.user!.userId);
    res.json({ message: 'Sequence stopped' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to stop sequence' });
  }
});

// GET /api/ghl/sms-sequence/status — get all sequences for current user
router.get('/sms-sequence/status', async (req: AuthRequest, res: Response) => {
  try {
    const { leadId, status } = req.query;
    const where: Record<string, unknown> = { userId: req.user!.userId };
    if (leadId) where.leadId = leadId as string;
    if (status) where.status = status as string;

    const sequences = await prisma.smsSequence.findMany({
      where,
      include: { lead: { select: { businessName: true, ownerName: true, phone: true, industry: true, city: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ sequences });
  } catch {
    res.status(500).json({ error: 'Failed to fetch sequences' });
  }
});

// POST /api/ghl/sms-sequence/preview — preview messages without starting
router.post('/sms-sequence/preview', async (req: AuthRequest, res: Response) => {
  try {
    const { leadId } = z.object({ leadId: z.string() }).parse(req.body);

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, userId: req.user!.userId },
    });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const demoLinks = await prisma.demoLink.findMany({ where: { userId: req.user!.userId } });
    const demoLink =
      lead.customDemoLink ||
      demoLinks.find(
        (d) => lead.industry && d.industry.toLowerCase().includes(lead.industry!.toLowerCase())
      )?.url || '{demoLink}';

    const validation = validateLeadForSequence(lead);
    const messages = generateSequenceMessages(lead, demoLink);

    res.json({ ...messages, validation, lead: { businessName: lead.businessName, ownerName: lead.ownerName, phone: lead.phone, industry: lead.industry, city: lead.city } });
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    res.status(500).json({ error: 'Failed to preview messages' });
  }
});

// GET /api/ghl/status — check if GHL is configured
router.get('/status', async (req: AuthRequest, res: Response) => {
  const creds = await getGhlCredentials(req.user!.userId);
  res.json({ configured: !!creds });
});

export default router;
