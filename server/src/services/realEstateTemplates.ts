// ─── Real Estate Cold Email — LOCKED TEMPLATES ─────────────────────────────
// Hardcoded in code so AI / template UI cannot rewrite them.
//
// Cadence: Day 1 (offset 0), Day 4 (offset 3), Day 9 (offset 8).
// Send window: Tue/Wed/Thu, 07:00–09:00 local (market timezone), random
// distribution. Skip-day shift is applied uniformly to all 3 emails: any
// candidate date landing on Mon/Fri/Sat/Sun is pushed forward to the next
// valid Tue/Wed/Thu.
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
  let host = lower.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  host = host.split('?')[0];

  if (host.endsWith('.com.au')) return 'AU';
  if (host.endsWith('.co.nz')) return 'NZ';
  if (host.endsWith('.co.uk') || host.endsWith('.uk')) return 'UK';
  if (host.endsWith('.ca')) return 'CA';
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

const MARKET_TIMEZONE: Record<Market, string> = {
  UK: 'Europe/London',
  US: 'America/New_York',
  CA: 'America/Toronto',
  AU: 'Australia/Sydney',
  NZ: 'Pacific/Auckland',
  UNKNOWN: 'Europe/London',
};

export function timezoneForMarket(market: Market): string {
  return MARKET_TIMEZONE[market] || 'Europe/London';
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

// ─── Send-slot snap: Tue/Wed/Thu 07:00–09:00 local, random distribution ────

function getDayOfWeekInTz(date: Date, tz: string): number {
  const dayStr = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(date);
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return dayMap[dayStr] ?? 0;
}

// Compute UTC offset (ms) for a given instant in a given timezone, DST-aware.
// Server-timezone-independent — uses Intl.DateTimeFormat parts rather than
// the locale-fragile `toLocaleString` round-trip.
function getTzOffsetMs(date: Date, tz: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value])
  );
  const hour = parts.hour === '24' ? '00' : parts.hour;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - date.getTime();
}

// Check whether `at` falls inside a real estate send window:
//   Tue/Wed/Thu, 07:00–09:00 in the market's local timezone.
// Used by the dispatcher to gate sends, regardless of how scheduledAt was set.
export function isInRealEstateSendWindow(at: Date, market: Market): boolean {
  const tz = timezoneForMarket(market);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(at).map((p) => [p.type, p.value])
  );
  const weekday = parts.weekday;
  if (weekday !== 'Tue' && weekday !== 'Wed' && weekday !== 'Thu') return false;
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  return hour >= 7 && hour < 9;
}

// Subject lines for the 3 RE templates — used to detect real estate emails
// at dispatch time (when we don't have a `source` field on the Email row).
export const RE_LOCKED_SUBJECTS = new Set([
  RE_TEMPLATE_1.subject,
  RE_TEMPLATE_2.subject,
  RE_TEMPLATE_3.subject,
]);

// Snap `from` forward to the next valid send slot:
//   - Day: Tue / Wed / Thu in market timezone
//   - Time: random within 07:00:00 .. 08:59:59 local
//   - Must be strictly in the future relative to `from`
//
// Used uniformly for Emails 1, 2, and 3.
export function snapToNextRealEstateSendSlot(from: Date, market: Market): Date {
  const tz = timezoneForMarket(market);

  for (let i = 0; i < 14; i++) {
    const candidate = new Date(from);
    candidate.setDate(candidate.getDate() + i);
    const dow = getDayOfWeekInTz(candidate, tz);
    if (dow < 2 || dow > 4) continue; // skip Mon/Fri/Sat/Sun

    // Build YYYY-MM-DD for this candidate in the target timezone
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(candidate);

    // Random time in 07:00:00 .. 08:59:59 (window is [07:00, 09:00))
    const totalSeconds = 2 * 60 * 60; // 7200
    const offsetSec = Math.floor(Math.random() * totalSeconds);
    const hh = 7 + Math.floor(offsetSec / 3600);
    const mm = Math.floor((offsetSec % 3600) / 60);
    const ss = offsetSec % 60;
    const hhStr = String(hh).padStart(2, '0');
    const mmStr = String(mm).padStart(2, '0');
    const ssStr = String(ss).padStart(2, '0');

    // Compute UTC offset on this specific date in this tz (DST-aware)
    const sampleUtc = new Date(`${dateStr}T12:00:00Z`);
    const offsetMs = getTzOffsetMs(sampleUtc, tz);

    // Interpret `${dateStr}T${hhStr}:${mmStr}:${ssStr}` as local-in-tz,
    // then convert to UTC by subtracting the offset.
    const localAsUtc = new Date(`${dateStr}T${hhStr}:${mmStr}:${ssStr}Z`);
    const utcTarget = new Date(localAsUtc.getTime() - offsetMs);

    if (utcTarget > from) return utcTarget;
  }

  // Defensive fallback: 7 days out (should never hit — 14-day window covers 6 valid days)
  const fb = new Date(from);
  fb.setDate(fb.getDate() + 7);
  return fb;
}

// ─── Public: generate the 3-email sequence ────────────────────────────────

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

  for (const r of [r1, r2, r3]) {
    if (hasUnresolvedPlaceholders(r.subject) || hasUnresolvedPlaceholders(r.body)) {
      return { ok: false, reason: 'placeholder_unresolved' };
    }
  }

  // Cadence: Day 1, Day 4, Day 9 with skip-day shift applied uniformly.
  // Each follow-up's target = previous send + offset days, then snap forward
  // to the next valid Tue/Wed/Thu 07:00–09:00 slot.
  const now = new Date();
  const day1 = snapToNextRealEstateSendSlot(now, market);

  const day2Target = new Date(day1);
  day2Target.setDate(day2Target.getDate() + 3);
  const day2 = snapToNextRealEstateSendSlot(day2Target, market);

  const day3Target = new Date(day2);
  day3Target.setDate(day3Target.getDate() + 5);
  const day3 = snapToNextRealEstateSendSlot(day3Target, market);

  return {
    ok: true,
    market,
    portal,
    emails: [
      { subject: r1.subject, body: r1.body, scheduledAt: day1, followupNumber: 0 },
      { subject: r2.subject, body: r2.body, scheduledAt: day2, followupNumber: 1 },
      { subject: r3.subject, body: r3.body, scheduledAt: day3, followupNumber: 2 },
    ],
  };
}
