import axios from 'axios';
import Anthropic from '@anthropic-ai/sdk';

interface LeadData {
  businessName: string;
  ownerName?: string | null;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  hasWebsite: boolean;
  websiteUrl?: string | null;
  googleRating?: number | null;
  reviewCount?: number | null;
  description?: string | null;
  websiteData?: {
    services?: string[];
    aboutText?: string;
  } | null;
}

// ─── Send via Meta WhatsApp Cloud API ────────────────────────────────────────

export async function sendWhatsAppMessage(
  to: string,
  message: string,
  phoneNumberId: string,
  accessToken: string
): Promise<string> {
  // Strip everything except digits — Meta requires E.164 without the +
  const normalizedPhone = to.replace(/\D/g, '');
  if (normalizedPhone.length < 7) {
    throw new Error(`Invalid phone number: ${to}`);
  }

  const res = await axios.post(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to: normalizedPhone,
      type: 'text',
      text: { body: message, preview_url: false },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 12000,
    }
  );

  return (res.data.messages?.[0]?.id as string) || '';
}

// ─── Generate a WhatsApp message via Claude ───────────────────────────────────

export async function generateWhatsAppMessage(
  lead: LeadData,
  senderName: string,
  apiKey: string
): Promise<string> {
  const client = new Anthropic({ apiKey });

  const ownerName = lead.ownerName;
  const services = (lead.websiteData?.services || []).slice(0, 3);
  const locationContext = lead.city
    ? `in ${lead.city}${lead.state ? `, ${lead.state}` : ''}`
    : '';
  const ratingContext =
    lead.googleRating
      ? `${lead.googleRating} stars on Google (${lead.reviewCount || 'several'} reviews)`
      : '';
  const websiteContext = lead.hasWebsite
    ? `Has a website at ${lead.websiteUrl || 'their domain'} — pitch a redesign/upgrade`
    : `Has NO website — pitch building their first professional site`;
  const aboutContext = lead.websiteData?.aboutText
    ? `About them: "${lead.websiteData.aboutText.slice(0, 150)}"`
    : lead.description
      ? `Description: ${lead.description}`
      : '';

  const prompt = `You are writing a WhatsApp outreach message for a web designer reaching out to a local business to offer website services.

Business details:
- Name: ${lead.businessName}
- Industry: ${lead.industry || 'local business'}
- Location: ${locationContext || 'local area'}
${ownerName ? `- Owner: ${ownerName}` : ''}
- ${websiteContext}
${ratingContext ? `- Google: ${ratingContext}` : ''}
${services.length > 0 ? `- Services they offer: ${services.join(', ')}` : ''}
${aboutContext ? `- ${aboutContext}` : ''}
Sender name: ${senderName}

Rules for the message:
- 3–5 sentences MAX — WhatsApp messages must be SHORT
- Conversational and warm — this is a chat, not an email
- Personalise it to THIS specific business (mention their industry, services, or location)
- Get straight to the point — no lengthy intros
- End with a low-pressure question or CTA ("Would you be open to a quick chat?" or "Want me to show you some ideas?")
- Do NOT sound like a robot or copy-paste template
- Do NOT use emojis unless it feels very natural (max 1)
- Do NOT mention AI, automation, or that this was generated
- Sound like a real person who just noticed their business and had an idea

Return ONLY the message text — no quotes, no JSON, no explanation.`;

  const msg = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = msg.content[0];
  if (content.type !== 'text') throw new Error('Unexpected Claude response');
  return content.text.trim();
}
