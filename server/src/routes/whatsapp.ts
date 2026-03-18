import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { sendWhatsAppMessage, generateWhatsAppMessage } from '../services/whatsapp';

const router = Router();
router.use(authenticate);

// POST /api/whatsapp/send
// Sends a WhatsApp message to a lead via Meta Cloud API (if credentials configured)
// and logs it. Also returns a wa.me link for manual sending.
router.post('/send', async (req: AuthRequest, res: Response) => {
  try {
    const { leadId, message } = z
      .object({ leadId: z.string(), message: z.string().min(1) })
      .parse(req.body);

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, userId: req.user!.userId },
    });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!lead.phone) return res.status(400).json({ error: 'Lead has no phone number' });

    const settings = await prisma.settings.findUnique({
      where: { userId: req.user!.userId },
    });

    const phoneNumberId = settings?.whatsAppPhoneId || process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = settings?.whatsAppToken || process.env.WHATSAPP_ACCESS_TOKEN;

    let waMessageId: string | undefined;
    let status = 'OPENED_IN_APP';

    // If Meta API credentials are configured, send via API
    if (phoneNumberId && accessToken) {
      try {
        waMessageId = await sendWhatsAppMessage(lead.phone, message, phoneNumberId, accessToken);
        status = 'SENT';
      } catch (err) {
        const apiErr = err as { response?: { data?: { error?: { message?: string } } } };
        const detail = apiErr?.response?.data?.error?.message || (err instanceof Error ? err.message : 'WhatsApp API error');
        return res.status(500).json({ error: `WhatsApp API error: ${detail}` });
      }
    }

    // Log the message regardless of send method
    const record = await prisma.whatsAppMessage.create({
      data: {
        userId: req.user!.userId,
        leadId: lead.id,
        phone: lead.phone,
        message,
        status,
        waMessageId: waMessageId || null,
      },
    });

    // Update lead status to CONTACTED if it's still NEW
    await prisma.lead.updateMany({
      where: { id: lead.id, status: 'NEW' },
      data: { status: 'CONTACTED' },
    });

    // Build a wa.me link for manual fallback
    const normalizedPhone = lead.phone.replace(/\D/g, '');
    const waLink = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;

    res.json({
      message: record,
      waLink,
      sentViaApi: status === 'SENT',
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to send WhatsApp message' });
  }
});

// GET /api/whatsapp/messages?leadId=xxx
router.get('/messages', async (req: AuthRequest, res: Response) => {
  try {
    const { leadId } = req.query;
    const where: Record<string, unknown> = { userId: req.user!.userId };
    if (leadId) where.leadId = leadId as string;

    const messages = await prisma.whatsAppMessage.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      take: 50,
    });

    res.json(messages);
  } catch {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// POST /api/whatsapp/generate
// Uses Claude to generate a WhatsApp message for a lead
router.post('/generate', async (req: AuthRequest, res: Response) => {
  try {
    const { leadId } = z.object({ leadId: z.string() }).parse(req.body);

    const lead = await prisma.lead.findFirst({
      where: { id: leadId, userId: req.user!.userId },
    });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const settings = await prisma.settings.findUnique({
      where: { userId: req.user!.userId },
    });

    const apiKey = settings?.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'Anthropic API key not configured. Add it in Settings.',
      });
    }

    const senderName = settings?.senderName || 'Alex';
    const message = await generateWhatsAppMessage(lead, senderName, apiKey);

    res.json({ message });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    const message = err instanceof Error ? err.message : 'Failed to generate message';
    res.status(500).json({ error: message });
  }
});

export default router;
