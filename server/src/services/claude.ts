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

  const prompt = `You are an expert cold email copywriter helping a web designer reach out to local businesses.

Write a highly personalised cold email to the following business pitching professional website design services.

Business Details:
- Name: ${lead.businessName}
- Industry: ${lead.industry || 'local business'}
- Location: ${locationContext || 'local area'}
${ownerContext ? `- ${ownerContext}` : ''}
- ${websiteContext}
${ratingContext ? `- ${ratingContext}` : ''}
${servicesContext ? `- ${servicesContext}` : ''}
${aboutContext ? `- ${aboutContext}` : ''}
${linkedInContext ? `- ${linkedInContext}` : ''}
${demoLink ? `- Include this demo website link naturally in the email: ${demoLink}` : ''}

Sender name: ${senderName}
Tone: ${toneGuide[tone] || toneGuide.professional}
${templateContext}

Requirements:
- Keep the email SHORT (under 200 words for the body)
- DEEPLY personalise it — reference their specific services, location, or something unique about their business
- If you know their services, mention 1-2 specifically to prove you visited their site ("I noticed you offer X and Y...")
- If you know the owner's name, use it naturally (not as an opener, but within the body)
- If they have no website, lead with that opportunity. If they have one, pitch an upgrade that would benefit their specific business.
- Reference their location or reviews naturally if possible
- The CTA should be to reply or book a quick call (no booking link — just ask them to reply)
- Sound human — no corporate speak, no "I hope this email finds you well"
- Do NOT start with "Hi [name]" or "Hello" — start with something that grabs attention immediately
- The email should feel like it was written by someone who spent 5 minutes researching their business
- Do NOT mention AI or that this email was generated
- Do NOT be generic — every sentence should be specific to THIS business

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
