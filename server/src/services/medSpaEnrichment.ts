import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../index';
import { decryptField } from './encryption';
import { scrapeWebsite, FirecrawlError } from './firecrawl';

// Status values stored in Lead.enrichmentStatus
export type EnrichmentStatus =
  | 'pending'
  | 'enriched'
  | 'no_website'
  | 'scrape_failed'
  | 'parse_failed'
  | 'no_email';

interface ExtractedFields {
  email: string | null;
  clinic_name: string | null;
  owner_name: string | null;
  signature_treatment: string | null;
  location_city: string | null;
  instagram_handle: string | null;
}

interface EnrichmentLead {
  id: string;
  businessName: string;
  email: string | null;
  websiteUrl: string | null;
}

// ─── Extract structured data from website markdown via Claude ──────────────

async function extractMedSpaFields(
  url: string,
  markdown: string,
  anthropicApiKey: string
): Promise<ExtractedFields | null> {
  const client = new Anthropic({ apiKey: anthropicApiKey });

  const systemPrompt =
    'You are extracting lead data from a med spa website. Output ONLY valid JSON matching the schema. If a field cannot be confidently determined from the content, use null. Do not invent data.';

  const userPrompt = `Schema:
{
  "email": "primary contact email (info@, hello@, contact@, or an owner's direct email if listed). Null if no email visible.",
  "clinic_name": "the trading name of the med spa, as it appears in the site header or footer",
  "owner_name": "first name only of the owner or lead practitioner, if clearly identifiable on About page or homepage. Null if not clear.",
  "signature_treatment": "the most prominently featured specific treatment (e.g. 'Profhilo', 'Morpheus8', 'Polynucleotides', 'CoolSculpting'). Must be a specific named treatment, NOT a generic category like 'injectables', 'skincare', 'facials', or 'body contouring'. Pick based on homepage prominence, repetition across pages, and dedicated service pages. Null if no single specific treatment clearly dominates.",
  "location_city": "city or town where the clinic is located, from contact page, footer, or homepage",
  "instagram_handle": "Instagram username without the @, from social links. Null if no Instagram link found."
}

Website URL: ${url}

Website content:
${markdown}

Output only the JSON object. No commentary, no markdown code fences.`;

  const message = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 600,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') return null;

  let raw = content.text.trim();
  // Strip code fences if Claude added them despite instructions
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');

  try {
    const parsed = JSON.parse(raw) as ExtractedFields;
    return parsed;
  } catch (err) {
    console.error('Med spa enrichment parse failed. Raw response:', raw);
    return null;
  }
}

// ─── Main: enrich a single med spa lead ─────────────────────────────────────

export interface EnrichmentResult {
  leadId: string;
  businessName: string;
  status: EnrichmentStatus;
  extracted?: ExtractedFields;
  error?: string;
}

export async function enrichMedSpaLead(
  lead: EnrichmentLead,
  firecrawlApiKey: string,
  anthropicApiKey: string
): Promise<EnrichmentResult> {
  // No website → skip
  if (!lead.websiteUrl) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { enrichmentStatus: 'no_website', enrichmentRunAt: new Date() },
    });
    return { leadId: lead.id, businessName: lead.businessName, status: 'no_website' };
  }

  // Scrape with Firecrawl
  let markdown: string;
  try {
    markdown = await scrapeWebsite(lead.websiteUrl, firecrawlApiKey);
  } catch (err) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { enrichmentStatus: 'scrape_failed', enrichmentRunAt: new Date() },
    });
    const errMsg = err instanceof FirecrawlError ? err.message : 'scrape failed';
    return { leadId: lead.id, businessName: lead.businessName, status: 'scrape_failed', error: errMsg };
  }

  // Extract structured fields with Claude
  const extracted = await extractMedSpaFields(lead.websiteUrl, markdown, anthropicApiKey);
  if (!extracted) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { enrichmentStatus: 'parse_failed', enrichmentRunAt: new Date() },
    });
    return { leadId: lead.id, businessName: lead.businessName, status: 'parse_failed' };
  }

  // Determine final email: prefer extracted email, fall back to lead.email
  const emailFromSite = isValidEmail(extracted.email) ? extracted.email : null;
  const finalEmail = emailFromSite || lead.email;

  // If no email anywhere → mark no_email but still save the other extracted data
  const status: EnrichmentStatus = finalEmail ? 'enriched' : 'no_email';

  const updateData: Record<string, unknown> = {
    enrichmentStatus: status,
    enrichmentRunAt: new Date(),
    signatureTreatment: extracted.signature_treatment,
    ownerFirstName: extracted.owner_name,
    instagramHandle: extracted.instagram_handle,
    emailFromSite,
    locationCity: extracted.location_city,
  };

  // If we found an email from the site and the lead didn't have one, populate lead.email too
  if (emailFromSite && !lead.email) {
    updateData.email = emailFromSite;
  }

  await prisma.lead.update({
    where: { id: lead.id },
    data: updateData,
  });

  return { leadId: lead.id, businessName: lead.businessName, status, extracted };
}

function isValidEmail(email: string | null): email is string {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Batch enrichment with summary stats ───────────────────────────────────

export interface BatchSummary {
  total_processed: number;
  enriched_successfully: number;
  queued_for_send: number;
  no_email: number;
  no_website: number;
  scrape_failed: number;
  parse_failed: number;
  results: EnrichmentResult[];
}

export async function enrichMedSpaLeads(
  userId: string,
  leadIds: string[]
): Promise<BatchSummary> {
  const settings = await prisma.settings.findUnique({ where: { userId } });
  const firecrawlApiKey =
    decryptField((settings as Record<string, unknown> | null)?.firecrawlApiKey as string | null | undefined) ||
    process.env.FIRECRAWL_API_KEY;
  const anthropicApiKey =
    decryptField(settings?.anthropicApiKey) || process.env.ANTHROPIC_API_KEY;

  if (!firecrawlApiKey) {
    throw new Error('Firecrawl API key not configured. Add it in Settings.');
  }
  if (!anthropicApiKey) {
    throw new Error('Anthropic API key not configured. Add it in Settings.');
  }

  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds }, userId },
    select: { id: true, businessName: true, email: true, websiteUrl: true },
  });

  const results: EnrichmentResult[] = [];
  const summary: BatchSummary = {
    total_processed: 0,
    enriched_successfully: 0,
    queued_for_send: 0,
    no_email: 0,
    no_website: 0,
    scrape_failed: 0,
    parse_failed: 0,
    results,
  };

  for (const lead of leads) {
    summary.total_processed++;
    try {
      const r = await enrichMedSpaLead(lead, firecrawlApiKey, anthropicApiKey);
      results.push(r);
      switch (r.status) {
        case 'enriched':
          summary.enriched_successfully++;
          summary.queued_for_send++;
          break;
        case 'no_email':
          summary.no_email++;
          break;
        case 'no_website':
          summary.no_website++;
          break;
        case 'scrape_failed':
          summary.scrape_failed++;
          break;
        case 'parse_failed':
          summary.parse_failed++;
          break;
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'unknown error';
      console.error(`Med spa enrichment failed for ${lead.businessName}:`, errMsg);
      results.push({
        leadId: lead.id,
        businessName: lead.businessName,
        status: 'scrape_failed',
        error: errMsg,
      });
      summary.scrape_failed++;
    }

    // Throttle: 500ms between leads to avoid hammering Firecrawl
    await new Promise((r) => setTimeout(r, 500));
  }

  return summary;
}
