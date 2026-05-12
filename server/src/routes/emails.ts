import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateEmail } from '../services/claude';
import { sendEmail } from '../services/sendgrid';
import { decryptField } from '../services/encryption';
import { logActivity } from '../services/activityLogger';
import { syncContactToGhl, sendGhlMessage } from '../services/ghl';
import { isMedSpaIndustry, generateMedSpaSequence } from '../services/medSpaTemplates';

const router = Router();

// SendGrid webhook (no auth needed)
router.post('/webhook', async (req, res) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    for (const event of events) {
      const { sg_message_id, event: eventType } = event;
      if (!sg_message_id) continue;

      const messageId = sg_message_id.split('.')[0];
      const email = await prisma.email.findFirst({ where: { messageId } });
      if (!email) continue;

      const updates: Record<string, unknown> = {};
      if (eventType === 'open' && !email.openedAt) {
        updates.status = 'OPENED';
        updates.openedAt = new Date();
        await prisma.lead.updateMany({
          where: { id: email.leadId, status: 'CONTACTED' },
          data: { status: 'OPENED' },
        });
      } else if (eventType === 'click' && !email.clickedAt) {
        updates.status = 'CLICKED';
        updates.clickedAt = new Date();
      } else if (eventType === 'bounce' || eventType === 'dropped') {
        updates.status = 'BOUNCED';
        updates.bouncedAt = new Date();
      }

      if (Object.keys(updates).length > 0) {
        await prisma.email.update({ where: { id: email.id }, data: updates });
      }
    }
    res.sendStatus(200);
  } catch {
    res.sendStatus(200); // Always return 200 to SendGrid
  }
});

router.use(authenticate);

// GET /api/emails
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { leadId, status, page = '1', limit = '50', sortBy } = req.query;
    const where: Record<string, unknown> = { userId: req.user!.userId };
    if (leadId) where.leadId = leadId;
    if (status) where.status = status;

    const orderBy = sortBy === 'scheduledAt'
      ? { scheduledAt: 'asc' as const }
      : { createdAt: 'desc' as const };

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy,
        include: { lead: { select: { businessName: true, email: true } } },
      }),
      prisma.email.count({ where }),
    ]);

    res.json({ emails, total });
  } catch {
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});

// POST /api/emails/generate
router.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const { leadIds, tone, demoLinkId } = z
      .object({ leadIds: z.array(z.string()), tone: z.string().optional(), demoLinkId: z.string().optional() })
      .parse(req.body);

    const settings = await prisma.settings.findUnique({
      where: { userId: req.user!.userId },
    });

    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds }, userId: req.user!.userId },
    });

    // Detect if this batch contains any non-med-spa leads needing AI generation
    const needsAi = leads.some((l) => !isMedSpaIndustry(l.industry));
    const apiKey = decryptField(settings?.anthropicApiKey) || process.env.ANTHROPIC_API_KEY;
    if (needsAi && !apiKey) {
      return res.status(400).json({
        error: 'Anthropic API key not configured. Add it in Settings.',
      });
    }

    const demoLinks = await prisma.demoLink.findMany({
      where: { userId: req.user!.userId },
    });

    const templates = await prisma.emailTemplate.findMany({
      where: { userId: req.user!.userId },
    });

    const generated: Array<Record<string, unknown>> = [];
    const skipped: Array<{ leadId: string; businessName: string; reason: string }> = [];

    for (const lead of leads) {
      // ─── FORK: Med Spa leads use locked templates, NO AI ───────────────
      if (isMedSpaIndustry(lead.industry)) {
        // Qualification gate — only send to confirmed med spas (must be enriched first)
        if (lead.isQualifiedMedSpa === false) {
          skipped.push({
            leadId: lead.id,
            businessName: lead.businessName,
            reason: `not_qualified (business_type: ${lead.businessType || 'unknown'})`,
          });
          continue;
        }
        if (lead.isQualifiedMedSpa == null) {
          skipped.push({
            leadId: lead.id,
            businessName: lead.businessName,
            reason: 'not_enriched — run Enrich Med Spa first',
          });
          continue;
        }

        const result = generateMedSpaSequence({
          businessName: lead.businessName,
          email: lead.email,
          emailFromSite: lead.emailFromSite,
          signatureTreatment: lead.signatureTreatment,
        });
        if (!result.ok) {
          skipped.push({ leadId: lead.id, businessName: lead.businessName, reason: result.reason });
          continue;
        }

        // Create 3 DRAFT emails with scheduledAt populated
        const createdSequence: Array<Record<string, unknown>> = [];
        for (const draft of result.emails) {
          const unsubscribeToken = crypto.randomBytes(32).toString('hex');
          const email = await prisma.email.create({
            data: {
              userId: req.user!.userId,
              leadId: lead.id,
              subject: draft.subject,
              body: draft.body,
              status: 'DRAFT',
              followupNumber: draft.followupNumber,
              scheduledAt: draft.scheduledAt,
              unsubscribeToken,
            },
          });
          createdSequence.push({
            ...email,
            lead: { businessName: lead.businessName },
            locked: true,
            source: 'med_spa_locked_templates',
          });
        }

        // Log warning if the fallback treatment was used
        if (result.usedFallbackTreatment) {
          await logActivity({
            userId: req.user!.userId,
            userEmail: req.user!.email,
            action: 'MED_SPA_FALLBACK_TREATMENT',
            targetType: 'lead',
            targetId: lead.id,
            metadata: { businessName: lead.businessName },
            req,
          });
        }

        generated.push(...createdSequence);
        continue;
      }

      // ─── Default path: AI-generated single email (UNCHANGED) ───────────
      const demoLink =
        (demoLinkId ? demoLinks.find((d) => d.id === demoLinkId)?.url : null) ||
        lead.customDemoLink ||
        demoLinks.find(
          (d) =>
            lead.industry &&
            d.industry.toLowerCase().includes(lead.industry.toLowerCase())
        )?.url;

      const template = templates.find(
        (t) =>
          lead.industry &&
          t.industry?.toLowerCase().includes(lead.industry.toLowerCase())
      );

      const { subject, body } = await generateEmail(
        {
          lead,
          demoLink,
          tone: tone || 'professional',
          senderName: settings?.senderName || 'Alex',
          templateBody: template?.body,
        },
        apiKey!
      );

      const unsubscribeToken = crypto.randomBytes(32).toString('hex');
      const fullBody = settings?.emailSignature
        ? `${body}\n\n${settings.emailSignature}`
        : body;

      const email = await prisma.email.create({
        data: {
          userId: req.user!.userId,
          leadId: lead.id,
          subject,
          body: fullBody,
          status: 'DRAFT',
          unsubscribeToken,
        },
      });

      generated.push({ ...email, lead: { businessName: lead.businessName } });
    }

    res.json({ generated, skipped });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate emails';
    res.status(500).json({ error: message });
  }
});

// PUT /api/emails/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { subject, body, scheduledAt } = z
      .object({
        subject: z.string().optional(),
        body: z.string().optional(),
        scheduledAt: z.string().optional(),
      })
      .parse(req.body);

    const email = await prisma.email.updateMany({
      where: { id: req.params.id, userId: req.user!.userId },
      data: {
        ...(subject && { subject }),
        ...(body && { body }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
      },
    });

    if (email.count === 0) return res.status(404).json({ error: 'Email not found' });
    const updated = await prisma.email.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Failed to update email' });
  }
});

// POST /api/emails/:id/schedule
router.post('/:id/schedule', async (req: AuthRequest, res: Response) => {
  try {
    const { scheduledAt } = z.object({ scheduledAt: z.string() }).parse(req.body);
    const email = await prisma.email.updateMany({
      where: { id: req.params.id, userId: req.user!.userId },
      data: { status: 'SCHEDULED', scheduledAt: new Date(scheduledAt) },
    });
    if (email.count === 0) return res.status(404).json({ error: 'Email not found' });
    res.json({ message: 'Email scheduled' });
  } catch {
    res.status(500).json({ error: 'Failed to schedule email' });
  }
});

// POST /api/emails/schedule-batch
router.post('/schedule-batch', async (req: AuthRequest, res: Response) => {
  try {
    const { emailIds, startDate, sendPerDay, minutesBetween } = z
      .object({
        emailIds: z.array(z.string()),
        startDate: z.string(),
        sendPerDay: z.number().min(1).max(200),
        minutesBetween: z.number().min(0).max(60).optional().default(0),
      })
      .parse(req.body);

    const start = new Date(startDate);
    let scheduled = 0;

    for (let i = 0; i < emailIds.length; i++) {
      const sendDate = new Date(start);
      if (minutesBetween > 0) {
        // Fixed interval: email i fires at start + (i * minutesBetween) minutes
        sendDate.setMinutes(sendDate.getMinutes() + i * minutesBetween);
      } else {
        // Original behaviour: spread over 8 hours per day
        const dayOffset = Math.floor(i / sendPerDay);
        const hourOffset = (i % sendPerDay) * Math.floor((8 * 60) / sendPerDay);
        sendDate.setDate(sendDate.getDate() + dayOffset);
        sendDate.setMinutes(sendDate.getMinutes() + hourOffset);
      }

      const result = await prisma.email.updateMany({
        where: { id: emailIds[i], userId: req.user!.userId },
        data: { status: 'SCHEDULED', scheduledAt: sendDate },
      });
      if (result.count > 0) scheduled++;
    }

    res.json({ scheduled });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to schedule emails' });
  }
});

// POST /api/emails/test-send — manually compose and send a test email
router.post('/test-send', async (req: AuthRequest, res: Response) => {
  try {
    const { to, subject, body } = z
      .object({
        to: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
      })
      .parse(req.body);

    const settings = await prisma.settings.findUnique({
      where: { userId: req.user!.userId },
    });

    const apiKey = decryptField(settings?.sendgridApiKey) || process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'SendGrid API key not configured. Add it in Settings or set SENDGRID_API_KEY env var on Railway.',
      });
    }

    let messageId: string;
    try {
      messageId = await sendEmail(
        {
          to,
          from: 'info@ma.bossdigitalsolutions.tech',
          fromName: settings?.senderName || 'Boss Digital Solutions',
          subject,
          body,
          serverUrl: process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3001}`,
        },
        apiKey
      );
    } catch (sendErr: unknown) {
      const sgErr = sendErr as { response?: { body?: { errors?: { message: string }[] } }; message?: string };
      const detail = sgErr?.response?.body?.errors?.[0]?.message || sgErr?.message || 'Unknown SendGrid error';
      console.error('SendGrid error:', JSON.stringify(sgErr?.response?.body || sgErr));
      return res.status(502).json({ error: `SendGrid error: ${detail}` });
    }

    await logActivity({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      action: 'EMAIL_SENT',
      targetType: 'test',
      targetId: '',
      metadata: { subject, to, test: true },
      req,
    });

    res.json({ message: 'Test email sent successfully', messageId });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    const message = err instanceof Error ? err.message : 'Failed to send test email';
    res.status(500).json({ error: message });
  }
});

// POST /api/emails/:id/send-now
router.post('/:id/send-now', async (req: AuthRequest, res: Response) => {
  try {
    const settings = await prisma.settings.findUnique({
      where: { userId: req.user!.userId },
    });

    const apiKey = decryptField(settings?.sendgridApiKey) || process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'SendGrid API key not configured. Add it in Settings.',
      });
    }

    const email = await prisma.email.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: { lead: true },
    });

    if (!email) return res.status(404).json({ error: 'Email not found' });
    if (!email.lead.email) {
      return res.status(400).json({ error: 'Lead has no email address' });
    }
    if (email.lead.unsubscribed) {
      return res.status(400).json({ error: 'Lead has unsubscribed' });
    }

    const messageId = await sendEmail(
      {
        to: email.lead.email,
        from: 'info@ma.bossdigitalsolutions.tech',
        fromName: settings?.senderName || 'Boss Digital Solutions',
        subject: email.subject,
        body: email.body,
        unsubscribeToken: email.unsubscribeToken || undefined,
        serverUrl: process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3001}`,
      },
      apiKey
    );

    await prisma.email.update({
      where: { id: email.id },
      data: { status: 'SENT', sentAt: new Date(), messageId },
    });

    await prisma.lead.update({
      where: { id: email.leadId },
      data: { status: 'CONTACTED' },
    });

    await logActivity({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      action: 'EMAIL_SENT',
      targetType: 'lead',
      targetId: email.leadId,
      metadata: { subject: email.subject, to: email.lead.email },
      req,
    });

    // Sync to GHL so the email shows in GoHighLevel conversation
    try {
      const ghlApiKey = decryptField(settings?.ghlApiKey) || process.env.GHL_API_KEY;
      const ghlLocationId = settings?.ghlLocationId || process.env.GHL_LOCATION_ID;
      if (ghlApiKey && ghlLocationId) {
        let ghlContactId = email.lead.ghlContactId;
        if (!ghlContactId) {
          ghlContactId = await syncContactToGhl(
            {
              businessName: email.lead.businessName,
              ownerName: email.lead.ownerName,
              email: email.lead.email,
              phone: email.lead.phone,
              address: email.lead.address,
              city: email.lead.city,
              state: email.lead.state,
              industry: email.lead.industry,
              websiteUrl: email.lead.websiteUrl,
              googleRating: email.lead.googleRating,
              description: email.lead.description,
            },
            ghlApiKey,
            ghlLocationId
          );
          await prisma.lead.update({
            where: { id: email.leadId },
            data: { ghlContactId },
          });
        }
        await sendGhlMessage(ghlContactId, email.body, 'Email', ghlApiKey, ghlLocationId, email.subject);
      }
    } catch (ghlErr) {
      console.error('GHL sync failed (non-blocking):', ghlErr instanceof Error ? ghlErr.message : ghlErr);
    }

    res.json({ message: 'Email sent successfully' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send email';
    res.status(500).json({ error: message });
  }
});

// DELETE /api/emails/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.email.deleteMany({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Email not found' });
    res.json({ message: 'Email deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete email' });
  }
});

export default router;
