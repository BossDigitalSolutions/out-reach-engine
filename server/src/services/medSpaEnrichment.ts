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
  | 'no_email'
  | 'not_qualified';

// ─── Claude system prompt for med spa qualification + extraction ────────────
// Exported so the debug endpoint reuses the exact same prompt.

export const MED_SPA_EXTRACTION_SYSTEM_PROMPT = `You are extracting structured data from a business's website to determine if it qualifies as a medical spa (med spa) for a B2B marketing campaign. Output ONLY valid JSON. No markdown code fences, no commentary, no explanatory text.

DEFINITION OF A QUALIFIED MED SPA

A business qualifies as a med spa ONLY if its website explicitly mentions, by name, at least one treatment from this list:

INJECTABLES:
- Botulinum toxin / anti-wrinkle injections (Botox, Bocouture, Azzalure, Dysport, Xeomin, Nuceiva)
- Dermal filler — including any of: lip filler, cheek filler, chin filler, jawline filler, tear trough filler, nasolabial fold filler, non-surgical rhinoplasty, hand rejuvenation filler, branded fillers like Juvéderm, Restylane, Teosyal, Belotero
- Profhilo
- Polynucleotides (Lumi Eyes, PhilArt, Plinest, Nucleofill)
- Skin boosters (Volite, Restylane Vital, Sunekos, Profhilo Body)
- Biostimulators (Sculptra, Radiesse, Ellansé, Lanluma)
- Sclerotherapy (vein treatment via injection)

ENERGY-BASED OR DEVICE TREATMENTS:
- Morpheus8
- Sofwave
- HIFU / Ultherapy
- RF microneedling (Morpheus8, Genius RF, Secret RF, Vivace, Potenza)
- Laser resurfacing (Fraxel, CO2 laser, erbium laser)
- IPL (intense pulsed light) for pigmentation, vascular, photofacial
- CoolSculpting / cryolipolysis
- Emsculpt / EMSculpt NEO
- Laser hair removal (only counts if combined with other med spa treatments — alone it does NOT qualify)

OTHER MEDICAL AESTHETIC PROCEDURES:
- PRP / platelet-rich plasma / "vampire facial"
- PDO threads / thread lift / non-surgical facelift
- Medical-grade chemical peels (TCA, jessner, phenol — NOT simple glycolic or basic enzyme peels)
- Microneedling / collagen induction therapy (only when offered by medical practitioners)
- Hyperhidrosis treatment (Botox for sweating)
- Medical weight loss injectables (GLP-1, semaglutide, Mounjaro, Ozempic for weight management)
- Hair restoration (PRP for hair loss, prescription minoxidil, finasteride consultations)
- Acne scarring treatments via laser, microneedling, or peels

DEFINITION OF NOT-A-MED-SPA

A business does NOT qualify as a med spa if it ONLY offers any combination of:
- Massages of any kind (Swedish, deep tissue, hot stone, Thai, sports, lymphatic, prenatal)
- Standard facials, "luxury" facials, "advanced" facials without naming specific medical brands or active devices
- Manicures, pedicures, nail extensions, gel nails
- Eyelash extensions, lash lifts, brow lamination, brow tinting, brow shaping
- Hair cuts, colouring, styling, blow-dries, hair extensions
- Sauna, steam room, hot tub, ice plunge, hammam
- Yoga, pilates, meditation, breathwork
- Hotel-style "wellness" or "relaxation" packages or "spa days"
- Tanning (spray or UV)
- Reiki, reflexology, holistic therapies, energy work, crystal healing
- Waxing, threading, hair removal (without laser)
- Standard body wraps, scrubs, exfoliation (without medical components)
- Makeup application, bridal makeup, special occasion services

KEY DISAMBIGUATION RULES

1. A hotel spa offering "luxury facials" and "wellness packages" is NOT a med spa, even if it uses words like "advanced," "rejuvenating," or "anti-ageing." Without a named injectable or medical device treatment, it doesn't qualify.

2. A beauty salon that adds Botox or filler to its menu IS a med spa, even if the rest of its services are non-medical. Presence of any qualifying treatment overrides the salon classification.

3. A medical aesthetic clinic that ALSO offers massage or facials is still a med spa. The qualifying treatments determine the classification.

4. If the site is sparse, generic, or you can't determine treatments clearly, default business_type to "other" and is_qualified_med_spa to false. Do not guess.

5. Med spas can operate inside hotels, gyms, or department stores. The location is irrelevant — only the treatment menu matters.

JSON SCHEMA TO RETURN

{
  "email": "string | null — primary contact email visible on the site (info@, hello@, contact@, or an owner's direct email). Null if no email is visible.",
  "clinic_name": "string — trading name of the business as shown in header or footer",
  "owner_name": "string | null — first name only of the owner or lead practitioner, only if clearly identified on About page or homepage",
  "location_city": "string | null — city or town the business is located in",
  "instagram_handle": "string | null — Instagram username without the @ symbol",
  "business_type": "one of: 'med_spa', 'hotel_spa', 'day_spa', 'hair_salon', 'nail_salon', 'beauty_salon', 'wellness_centre', 'fitness_centre_with_spa', 'massage_clinic', 'tanning_salon', 'other'",
  "is_qualified_med_spa": "boolean — true ONLY if business_type is 'med_spa' AND at least one named qualifying treatment from the list above appears on the site",
  "signature_treatment": "string | null — populate ONLY if is_qualified_med_spa is true. Use the exact named treatment that is most prominently featured (homepage hero, dedicated service page, or repeated mentions across the site). Use exact branded names like 'Profhilo' or 'Morpheus8', not generic categories like 'injectables' or 'skincare'. Null if no single treatment clearly dominates, or if business is not qualified.",
  "qualifying_treatments_found": "array of strings — list every named qualifying treatment found on the site. Empty array if none. This helps with auditing."
}

Output ONLY the JSON object. No commentary before or after. No code fences.`;

interface ExtractedFields {
  email: string | null;
  clinic_name: string | null;
  owner_name: string | null;
  signature_treatment: string | null;
  location_city: string | null;
  instagram_handle: string | null;
  business_type: string | null;
  is_qualified_med_spa: boolean | null;
  qualifying_treatments_found: string[] | null;
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

  const systemPrompt = MED_SPA_EXTRACTION_SYSTEM_PROMPT;
  const userPrompt = `Website URL: ${url}

Website content:
${markdown}`;

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

  // Qualification check — must be a real med spa to be enriched for the campaign
  const isQualified = extracted.is_qualified_med_spa === true;

  // Status: not_qualified > no_email > enriched
  let status: EnrichmentStatus;
  if (!isQualified) status = 'not_qualified';
  else if (!finalEmail) status = 'no_email';
  else status = 'enriched';

  const updateData: Record<string, unknown> = {
    enrichmentStatus: status,
    enrichmentRunAt: new Date(),
    signatureTreatment: extracted.signature_treatment,
    ownerFirstName: extracted.owner_name,
    instagramHandle: extracted.instagram_handle,
    emailFromSite,
    locationCity: extracted.location_city,
    businessType: extracted.business_type,
    isQualifiedMedSpa: isQualified,
    qualifyingTreatmentsFound: extracted.qualifying_treatments_found ?? [],
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
  not_qualified: number;
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
    not_qualified: 0,
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
        case 'not_qualified':
          summary.not_qualified++;
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
