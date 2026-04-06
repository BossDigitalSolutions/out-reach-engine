import Anthropic from '@anthropic-ai/sdk';

interface WebsiteData {
  emails?: string[];
  ownerName?: string;
  ownerTitle?: string;
  linkedinUrl?: string;
  services?: string[];
  aboutText?: string;
  tagline?: string;
}

interface LeadData {
  businessName: string;
  ownerName?: string | null;
  ownerTitle?: string | null;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  websiteUrl?: string | null;
  hasWebsite: boolean;
  googleRating?: number | null;
  reviewCount?: number | null;
  description?: string | null;
  websiteData?: WebsiteData | null;
  linkedinUrl?: string | null;
}

interface GenerateEmailOptions {
  lead: LeadData;
  demoLink?: string | null;
  tone?: string;
  senderName?: string;
  templateBody?: string | null;
}

export async function generateEmail(
  options: GenerateEmailOptions,
  apiKey: string
): Promise<{ subject: string; body: string }> {
  const { lead, demoLink, tone = 'professional', senderName = 'Alex', templateBody } = options;

  const client = new Anthropic({ apiKey });

  const toneGuide: Record<string, string> = {
    professional: 'professional and polished, but warm and approachable',
    casual: 'casual and conversational, like writing to a neighbor',
    friendly: 'friendly and enthusiastic, upbeat energy',
    bold: 'bold and direct, confident without being pushy',
  };

  const websiteData = lead.websiteData as WebsiteData | null;

  // Build context from scraped website data
  const ownerName = lead.ownerName || websiteData?.ownerName;
  const ownerTitle = lead.ownerTitle || websiteData?.ownerTitle;
  const services = websiteData?.services?.filter(Boolean).slice(0, 5) || [];
  const aboutText = websiteData?.aboutText;
  const hasLinkedIn = !!(lead.linkedinUrl || websiteData?.linkedinUrl);

  const websiteContext = lead.hasWebsite
    ? `They currently have a website at ${lead.websiteUrl || 'their domain'}. The goal is to pitch an upgrade, redesign, or improvement.`
    : `They don't appear to have a website yet — this is a prime opportunity to pitch building their first professional site.`;

  const ratingContext =
    lead.googleRating
      ? `They have a ${lead.googleRating}-star Google rating with ${lead.reviewCount || 'many'} reviews.`
      : '';

  const locationContext =
    lead.city ? `based in ${lead.city}${lead.state ? `, ${lead.state}` : ''}` : '';

  const ownerContext = ownerName
    ? `Owner/contact: ${ownerName}${ownerTitle ? ` (${ownerTitle})` : ''}`
    : '';

  const servicesContext = services.length > 0
    ? `Their services/offerings include: ${services.join(', ')}`
    : '';

  const aboutContext = aboutText
    ? `About their business: "${aboutText.slice(0, 250)}"`
    : lead.description
      ? `Business description: ${lead.description}`
      : '';

  const linkedInContext = hasLinkedIn
    ? 'They have a LinkedIn presence (professionally active online).'
    : '';

  const templateContext = templateBody
    ? `\n\nUse this as a style/structure reference (adapt it, don't copy verbatim):\n${templateBody}`
    : '';

  const industryLabel = lead.industry || 'local business';

  const prompt = `You are an expert cold email copywriter. Generate a cold outreach email for a web design business reaching out to local businesses.

You MUST follow every rule below — no exceptions.

---
BUSINESS DETAILS:
- Business name: ${lead.businessName}
- Industry: ${industryLabel}
- Location: ${locationContext || 'local area'}
${ownerContext ? `- ${ownerContext}` : ''}
- ${websiteContext}
${ratingContext ? `- ${ratingContext}` : ''}
${servicesContext ? `- ${servicesContext}` : ''}
${aboutContext ? `- ${aboutContext}` : ''}
${demoLink ? `- Demo link to include naturally in the email: ${demoLink}` : ''}

Sender name: ${senderName}
Tone: ${toneGuide[tone] || toneGuide.professional}
${templateContext}
---

STRICT RULES — ALL MUST BE FOLLOWED:

1. LENGTH: The email body must be NO MORE than 5–6 sentences total (excluding greeting and sign-off). Max 2 sentences per paragraph. Short. Every sentence must earn its place.

2. INDUSTRY SOCIAL PROOF (MANDATORY): Include exactly ONE sentence like:
   "We've recently helped other [INDUSTRY] businesses in the area build modern, high-converting websites..."
   Replace [INDUSTRY] with "${industryLabel}" — be specific (e.g. "plumbing companies", "dental practices", "restaurants"). Never be generic.

3. SEO BENEFIT (ONE sentence only): Mention that the website is built to rank higher on Google so more customers find them first. Frame it as a business result, not a technical feature.

4. FREE CUSTOM DEMO OFFER (THE HOOK — mandatory CTA): Offer to build a FREE custom 1-page demo website built specifically for THEIR business — featuring their business name, their services, their information. This is NOT a generic template. Frame it as zero-risk: "I'll put together a free custom demo page featuring ${lead.businessName} so you can see exactly how it could look — no obligation, no cost."

5. TWO REPLY OPTIONS: Close with: "Simply reply to this email or send me a quick message on WhatsApp at 076 051 8635 and I'll get it done for you."

6. SUBJECT LINE: Short, curiosity-driven, personalised with the business name. Example: "Quick question about ${lead.businessName}'s website"

7. NEVER use spam trigger words: "guaranteed", "act now", "limited time", "buy now", "100%", "free money"

8. TONE: Like a confident, professional peer — not a salesperson. No corporate speak. No "I hope this email finds you well."

9. GREETING: Start with "Hi [first name or business name]," — keep it natural.

10. DO NOT mention AI or that this was generated.

---

EXAMPLE STRUCTURE TO FOLLOW:

Subject: Quick question about [Business Name]'s website

Hi [First Name],

I came across [Business Name] and noticed there might be an opportunity to strengthen your online presence.

We've recently helped other [industry] businesses in the area build modern, high-converting websites designed to rank higher on Google — so more customers find them first.

I'd love to put together a free custom demo page featuring [Business Name] so you can see exactly how a premium online presence could look for your business. No obligation, no cost.

Simply reply to this email or send me a quick message on WhatsApp at 076 051 8635 and I'll get it done for you.

Looking forward to hearing from you,
[Sender name]

---

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{"subject": "email subject line here", "body": "full email body here with \\n for line breaks"}`;

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response from Claude');

  const text = content.text.trim();
  const parsed = JSON.parse(text) as { subject: string; body: string };
  return parsed;
}

// ─── SMS Generation ──────────────────────────────────────────────────────────

export async function generateSms(
  options: { lead: LeadData; senderName?: string; demoLink?: string | null },
  apiKey: string
): Promise<string> {
  const { lead, senderName = 'Alistaire', demoLink } = options;

  const client = new Anthropic({ apiKey });

  const industryLabel = lead.industry || 'local business';
  const ownerName = lead.ownerName || (lead.websiteData as WebsiteData | null)?.ownerName;
  const greeting = ownerName ? `Hi ${ownerName.split(' ')[0]}` : `Hi there`;
  const locationContext = lead.city ? `in ${lead.city}` : 'in your area';

  const prompt = `You are an expert SMS copywriter for a web design business reaching out to local businesses.

Write a cold outreach SMS message. Follow every rule below — no exceptions.

---
BUSINESS DETAILS:
- Business name: ${lead.businessName}
- Industry: ${industryLabel}
- Location: ${locationContext}
${ownerName ? `- Owner/contact: ${ownerName}` : ''}
- ${lead.hasWebsite ? `Has a website at ${lead.websiteUrl || 'their domain'}` : 'No website found'}
${demoLink ? `- Demo link to include: ${demoLink}` : ''}

Sender name: ${senderName}
---

STRICT SMS RULES:

1. FORMAT: Write 4-5 short paragraphs, each separated by a blank line. Each paragraph is 1-2 sentences max. The message should feel spaced out and easy to read — NOT one dense block.

2. GREETING: Start with "${greeting}," — natural and personal. First paragraph is the greeting + how you found them.

3. INDUSTRY SOCIAL PROOF: Second paragraph mentions you've been helping other ${industryLabel} businesses ${locationContext} build modern websites that bring in more customers.

4. THE OFFER: Third paragraph offers to build a FREE custom demo website specifically for ${lead.businessName} — featuring their business name, services, and info. Not a generic template. Zero cost, zero obligation.${demoLink ? ` Include this demo link naturally: ${demoLink} — say something like "Here's an example of what I've done for a similar business: ${demoLink}"` : ''}

5. CTA: Fourth paragraph — "If you're interested, just reply to this text or send me a WhatsApp at 076 051 8635 and I'll get it done for you."

6. SIGN OFF: End with "- ${senderName}" on its own line.

7. NO spam words ("guaranteed", "act now", "limited time"). NO hashtags. NO emojis.

8. TONE: Like a friendly professional reaching out — confident but not pushy.

9. DO NOT mention AI or technical jargon. Keep it conversational.

---

EXAMPLE:

${greeting}, I came across ${lead.businessName} and noticed there might be an opportunity to strengthen your online presence.

I've been helping other ${industryLabel} businesses ${locationContext} build modern websites that bring in more customers and look great on any device.${demoLink ? `\n\nHere's an example of what I put together for a similar business: ${demoLink}` : ''}

I'd love to build a free custom demo page specifically for ${lead.businessName} — featuring your services and info so you can see exactly how it'd look. No cost, no obligation.

If you're interested, just reply here or send me a WhatsApp at 076 051 8635 and I'll get it done for you.

- ${senderName}

---

Return ONLY the SMS message text. No JSON, no quotes, no markdown. Use actual line breaks between paragraphs.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response from Claude');

  return content.text.trim();
}
