// ─── Real Estate Cold Email — LOCKED TEMPLATES ─────────────────────────────
// Hardcoded in code so AI / template UI cannot rewrite them.
//
// Cadence: Day 1 (offset 0), Day 4 (offset 3), Day 9 (offset 8).
// Send window enforcement (Tue/Wed/Thu, 07–09 + 16–17 local) → Phase 2.
//
// Personalisation: {{agency_name}}, {{portal}}
// Portal derived from website URL TLD (Rightmove / Zillow / Realtor.ca / etc.).
// No demo URL in any email — single CTA is "reply 'demo'".

interface LockedTemplate {
  subject: string;
  body: string;
}

export const RE_TEMPLATE_1: LockedTemplate = {
  subject: 'enquiries after 6pm',
  body: `Hi {{agency_name}} team,

Quick one — when someone enquires on a {{portal}} listing at 9pm, who picks it up?

Most agencies don't reply until 9am. By then the lead has already messaged two or three other agents.

We build AI booking assistants for estate agencies that handle enquiries 24/7 across web chat, WhatsApp, and inbound calls — answering price and availability questions, qualifying the lead, and booking the viewing.

First reply wins the instruction. Reply "demo" and I'll fire across a live one.

Alistaire
Boss Digital Solutions
WhatsApp: +27 76 051 8635

P.S. If this isn't your area, mind passing to whoever handles lead management at {{agency_name}}? Appreciate it.`,
};

export const RE_TEMPLATE_2: LockedTemplate = {
  subject: 'whoever replies first',
  body: `Hi {{agency_name}} team,

Different angle to my last note.

Over 60% of {{portal}} enquiries now arrive outside 9-5 — when buyers are home from work browsing. By 9am the next morning, they've already messaged two or three other agencies.

Whoever replies first wins the instruction.

Our AI assistants close that gap, working across the channels your buyers actually use:
— Web chat for portal and website enquiries
— WhatsApp agent for buyer DMs
— Voice agent for after-hours calls

All three qualify and book the viewing.

Reply "demo" for a live walkthrough. Or WhatsApp me on +27 76 051 8635 — quicker if you're between viewings.

Alistaire
Boss Digital Solutions

P.S. If this isn't you, mind forwarding to whoever runs lead management? Cheers.`,
};

export const RE_TEMPLATE_3: LockedTemplate = {
  subject: 'last one',
  body: `Hi {{agency_name}} team,

Last note from me, promise.

If you're losing the odd enquiry to slow response times, one extra instruction a month covers our service for the year, several times over.

£300/month gets an AI agent on the channel that matters most:
— Web chat for your website and portal inbox
— WhatsApp agent for buyer DMs
— Voice agent on a dedicated overflow line

Bundle multiple for a discount. Set up in a week. Cancel anytime.

WhatsApp me on +27 76 051 8635 and I'll send the live demo straight to your phone. Or reply "demo" if email's easier.

Alistaire
Boss Digital Solutions

P.S. If you're not the right person, mind passing this on? Last ask, promise.`,
};

// ─── Industry detection ────────────────────────────────────────────────────
// Case-insensitive substring match on the lead.industry field.

const RE_INDUSTRY_KEYWORDS = [
  'real estate',
  'realtor',
  'estate agent',
  'realty',
  'lettings agency',
  'letting agent',
];

export function isRealEstateIndustry(industry?: string | null): boolean {
  if (!industry) return false;
  const norm = industry.toLowerCase().trim();
  return RE_INDUSTRY_KEYWORDS.some((kw) => norm.includes(kw));
}

// ─── Market + portal derivation from URL TLD ───────────────────────────────

export type Market = 'UK' | 'US' | 'CA' | 'AU' | 'NZ' | 'UNKNOWN';

export function deriveMarketFromUrl(url?: string | null): Market {
  if (!url) return 'UNKNOWN';
  const lower = url.toLowerCase();
  // Strip protocol + path to focus on host
  let host = lower.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  host = host.split('?')[0];

  if (host.endsWith('.com.au')) return 'AU';
  if (host.endsWith('.co.nz')) return 'NZ';
  if (host.endsWith('.co.uk') || host.endsWith('.uk')) return 'UK';
  if (host.endsWith('.ca')) return 'CA';
  // .com defaults to US (Phase 2 may add UK-signal detection)
  if (host.endsWith('.com') || host.endsWith('.net') || host.endsWith('.org')) return 'US';
  return 'UNKNOWN';
}

export function portalForMarket(market: Market): string {
  switch (market) {
    case 'UK':
      return 'Rightmove';
    case 'US':
      return 'Zillow';
    case 'CA':
      return 'Realtor.ca';
    case 'AU':
      return 'realestate.com.au';
    case 'NZ':
      return 'realestate.co.nz';
    case 'UNKNOWN':
    default:
      return 'your listing portal';
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function renderLockedTemplate(template: LockedTemplate, vars: Record<string, string>): LockedTemplate {
  let subject = template.subject;
  let body = template.body;
  for (const [key, value] of Object.entries(vars)) {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    subject = subject.replace(pattern, value);
    body = body.replace(pattern, value);
  }
  return { subject, body };
}

function hasUnresolvedPlaceholders(content: string): boolean {
  return /\{\{[^}]*\}\}/.test(content);
}

function isValidEmail(email: string | null | undefined): email is string {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Public: generate the 3-email sequence ────────────────────────────────
// Phase 1: scheduledAt uses naive offset days from now. Phase 2 will snap
// to the Tue/Wed/Thu 07–09 + 16–17 local window per market.

export interface RealEstateEmailDraft {
  subject: string;
  body: string;
  scheduledAt: Date;
  followupNumber: number; // 0, 1, 2
}

export interface RealEstateSequenceLead {
  businessName: string;
  email?: string | null;
  emailFromSite?: string | null;
  websiteUrl?: string | null;
}

export type RealEstateGenerationResult =
  | {
      ok: true;
      emails: RealEstateEmailDraft[];
      market: Market;
      portal: string;
    }
  | { ok: false; reason: 'no_email' | 'no_agency_name' | 'placeholder_unresolved' };

export function generateRealEstateSequence(
  lead: RealEstateSequenceLead
): RealEstateGenerationResult {
  const targetEmail = lead.emailFromSite || lead.email;
  if (!isValidEmail(targetEmail)) {
    return { ok: false, reason: 'no_email' };
  }

  const agencyName = lead.businessName?.trim();
  if (!agencyName) {
    return { ok: false, reason: 'no_agency_name' };
  }

  const market = deriveMarketFromUrl(lead.websiteUrl);
  const portal = portalForMarket(market);

  const vars = { agency_name: agencyName, portal };

  const r1 = renderLockedTemplate(RE_TEMPLATE_1, vars);
  const r2 = renderLockedTemplate(RE_TEMPLATE_2, vars);
  const r3 = renderLockedTemplate(RE_TEMPLATE_3, vars);

  // Validate no unresolved placeholders
  for (const r of [r1, r2, r3]) {
    if (hasUnresolvedPlaceholders(r.subject) || hasUnresolvedPlaceholders(r.body)) {
      return { ok: false, reason: 'placeholder_unresolved' };
    }
  }

  // Phase 1: naive offsets — Phase 2 will snap to Tue/Wed/Thu 07-09 / 16-17 local
  const now = new Date();
  const day0 = new Date(now);
  const day3 = new Date(now);
  day3.setDate(day3.getDate() + 3);
  const day8 = new Date(now);
  day8.setDate(day8.getDate() + 8);

  return {
    ok: true,
    market,
    portal,
    emails: [
      { subject: r1.subject, body: r1.body, scheduledAt: day0, followupNumber: 0 },
      { subject: r2.subject, body: r2.body, scheduledAt: day3, followupNumber: 1 },
      { subject: r3.subject, body: r3.body, scheduledAt: day8, followupNumber: 2 },
    ],
  };
}
