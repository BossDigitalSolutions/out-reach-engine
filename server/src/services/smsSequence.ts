import { prisma } from '../index';
import { decryptField } from './encryption';
import { syncContactToGhl, sendGhlMessage } from './ghl';

// ─── Country Classification ─────────────────────────────────────────────────

type Country = 'US' | 'UK' | 'AU' | 'NZ' | 'ZA' | 'DEFAULT';

// US states (50 + DC)
const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
  'ALABAMA','ALASKA','ARIZONA','ARKANSAS','CALIFORNIA','COLORADO','CONNECTICUT',
  'DELAWARE','FLORIDA','GEORGIA','HAWAII','IDAHO','ILLINOIS','INDIANA','IOWA',
  'KANSAS','KENTUCKY','LOUISIANA','MAINE','MARYLAND','MASSACHUSETTS','MICHIGAN',
  'MINNESOTA','MISSISSIPPI','MISSOURI','MONTANA','NEBRASKA','NEVADA','NEW HAMPSHIRE',
  'NEW JERSEY','NEW MEXICO','NEW YORK','NORTH CAROLINA','NORTH DAKOTA','OHIO',
  'OKLAHOMA','OREGON','PENNSYLVANIA','RHODE ISLAND','SOUTH CAROLINA','SOUTH DAKOTA',
  'TENNESSEE','TEXAS','UTAH','VERMONT','VIRGINIA','WASHINGTON','WEST VIRGINIA',
  'WISCONSIN','WYOMING',
]);

// UK regions / countries
const UK_REGIONS = new Set([
  'ENGLAND','SCOTLAND','WALES','NORTHERN IRELAND','UK','UNITED KINGDOM','GB',
  'GREATER LONDON','LONDON','MANCHESTER','BIRMINGHAM','LEEDS','GLASGOW',
  'LIVERPOOL','BRISTOL','SHEFFIELD','EDINBURGH','CARDIFF','BELFAST',
]);

// Australian states
const AU_STATES = new Set([
  'NSW','VIC','QLD','WA','SA','TAS','ACT','NT',
  'NEW SOUTH WALES','VICTORIA','QUEENSLAND','WESTERN AUSTRALIA',
  'SOUTH AUSTRALIA','TASMANIA','AUSTRALIAN CAPITAL TERRITORY','NORTHERN TERRITORY',
  'AUSTRALIA','AU',
]);

// New Zealand regions
const NZ_REGIONS = new Set([
  'NZ','NEW ZEALAND','AUCKLAND','WELLINGTON','CANTERBURY','OTAGO','WAIKATO',
  'BAY OF PLENTY','MANAWATU','NORTHLAND','TARANAKI','HAWKES BAY','SOUTHLAND',
  'NELSON','MARLBOROUGH','TASMAN','GISBORNE','WEST COAST',
]);

// South African provinces (existing support)
const ZA_REGIONS = new Set([
  'WESTERN CAPE','GAUTENG','KWAZULU-NATAL','EASTERN CAPE','FREE STATE',
  'LIMPOPO','MPUMALANGA','NORTH WEST','NORTHERN CAPE','ZA','SOUTH AFRICA',
]);

function classifyCountry(state?: string | null, address?: string | null): Country {
  const s = (state || '').toUpperCase().trim();
  const a = (address || '').toUpperCase();

  if (US_STATES.has(s) || a.includes('USA') || a.includes('UNITED STATES')) return 'US';
  if (UK_REGIONS.has(s) || a.includes('UNITED KINGDOM') || a.includes(', UK')) return 'UK';
  if (AU_STATES.has(s) || a.includes('AUSTRALIA')) return 'AU';
  if (NZ_REGIONS.has(s) || a.includes('NEW ZEALAND')) return 'NZ';
  if (ZA_REGIONS.has(s) || a.includes('SOUTH AFRICA')) return 'ZA';
  return 'DEFAULT';
}

// ─── Message Templates ──────────────────────────────────────────────────────

interface TemplateVars {
  businessName: string;
  city: string;
  industry: string;
  demoLink: string;
}

type Variant = 'NO_WEBSITE' | 'BAD_WEBSITE';

function getMessage1(country: Country, variant: Variant, v: TemplateVars): string {
  const noWebsite = variant === 'NO_WEBSITE';
  switch (country) {
    case 'US':
      return noWebsite
        ? `Hey — noticed ${v.businessName} doesn't have a website yet. Here's an example of what one could look like for a ${v.industry} business: ${v.demoLink} — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`
        : `Hey — found ${v.businessName} online. Wanted to show you an example of what a modern site could look like for a ${v.industry} business: ${v.demoLink} — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`;
    case 'UK':
      return noWebsite
        ? `Hi — noticed ${v.businessName} doesn't have a website. Here's an example of what one could look like for a ${v.industry} business: ${v.demoLink} — Alistaire, Boss Digital Solutions. Reply STOP to opt out.`
        : `Hi — came across ${v.businessName} online. Wanted to show you what a more modern site could look like for a ${v.industry} business: ${v.demoLink} — Alistaire, Boss Digital Solutions. Reply STOP to opt out.`;
    case 'AU':
      return noWebsite
        ? `Hey — noticed ${v.businessName} doesn't have a website. Here's an example of what one could look like for a ${v.industry} business: ${v.demoLink} — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`
        : `Hey — found ${v.businessName} online. Wanted to show you what a modern ${v.industry} site could look like: ${v.demoLink} — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`;
    case 'NZ':
      return noWebsite
        ? `Hey — noticed ${v.businessName} doesn't have a website. Here's an example of what one could look like for a ${v.industry} business: ${v.demoLink} — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`
        : `Hey — came across ${v.businessName} online. Wanted to show you what a modern ${v.industry} site could look like: ${v.demoLink} — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`;
    case 'ZA':
    case 'DEFAULT':
    default:
      return noWebsite
        ? `Hey — noticed ${v.businessName} doesn't have a website yet. Here's an example of what one could look like for a ${v.industry} business: ${v.demoLink} — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`
        : `Hey — found ${v.businessName} online. Wanted to show you an example of what a modern site could look like for a ${v.industry} business: ${v.demoLink} — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`;
  }
}

function getMessage2(country: Country, variant: Variant, v: TemplateVars): string {
  const noWebsite = variant === 'NO_WEBSITE';
  switch (country) {
    case 'US':
      return noWebsite
        ? `${v.industry} businesses in ${v.city} that launched a site last month are averaging 6 extra calls/week from Google. This is the kind of site that does it: ${v.demoLink} — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`
        : `${v.industry} businesses in ${v.city} that refreshed their site last month are averaging 6 extra calls/week from Google. Here's the kind of site that drives it: ${v.demoLink} — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`;
    case 'UK':
      return noWebsite
        ? `${v.industry} businesses in ${v.city} with a proper site are showing up on the first page of Google for local searches. This is the kind of site that gets them there: ${v.demoLink} — Alistaire, Boss Digital Solutions. Reply STOP to opt out.`
        : `${v.industry} businesses in ${v.city} that updated their site this quarter are showing up on the first page of Google. Here's the kind of site that makes the difference: ${v.demoLink} — Alistaire, Boss Digital Solutions. Reply STOP to opt out.`;
    case 'AU':
      return noWebsite
        ? `${v.industry} businesses in ${v.city} that got a site up last month are pulling 5–7 more leads/week from Google. This is the kind of site that does it: ${v.demoLink} — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`
        : `${v.industry} businesses in ${v.city} that refreshed their site last month are pulling 5–7 more leads/week from Google. Here's the kind of site driving that: ${v.demoLink} — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`;
    case 'NZ':
      return noWebsite
        ? `${v.industry} businesses in ${v.city} that launched a site this year are getting 4–5 more enquiries/week through Google. This is the kind of site that gets them there: ${v.demoLink} — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`
        : `${v.industry} businesses in ${v.city} that refreshed their site this year are getting 4–5 more enquiries/week through Google. Here's the kind of site making that happen: ${v.demoLink} — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`;
    case 'ZA':
    case 'DEFAULT':
    default:
      return noWebsite
        ? `${v.industry} businesses in ${v.city} that launched a site last month are averaging 6 extra calls/week from Google. This is the kind of site that does it: ${v.demoLink} — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`
        : `${v.industry} businesses in ${v.city} that refreshed their site last month are averaging 6 extra calls/week from Google. Here's the kind of site that drives it: ${v.demoLink} — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`;
  }
}

function getMessage3(country: Country, variant: Variant, v: TemplateVars): string {
  const noWebsite = variant === 'NO_WEBSITE';
  switch (country) {
    case 'US':
      return noWebsite
        ? `Last one, promise. I'll build ${v.businessName} a free homepage just like this — no catch. Want me to? — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`
        : `Last one, promise. I'll build ${v.businessName} a free upgraded homepage like this — no catch. Want me to? — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`;
    case 'UK':
      return noWebsite
        ? `Last message from me. Happy to build ${v.businessName} a free homepage along these lines — no obligation. — Alistaire, Boss Digital Solutions. Reply STOP to opt out.`
        : `Last message from me. Happy to build ${v.businessName} a free refreshed homepage along these lines — no obligation. — Alistaire, Boss Digital Solutions. Reply STOP to opt out.`;
    case 'AU':
      return noWebsite
        ? `Last one from me. I'll build ${v.businessName} a free homepage like this — no strings. Want it? — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`
        : `Last one from me. I'll build ${v.businessName} a free upgraded homepage like this — no strings. Want it? — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`;
    case 'NZ':
      return noWebsite
        ? `Last message from us. Happy to build ${v.businessName} a free homepage like this — no cost, no catch. Just say the word. — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`
        : `Last message from us. Happy to build ${v.businessName} a free refreshed homepage like this — no cost, no catch. Just say the word. — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`;
    case 'ZA':
    case 'DEFAULT':
    default:
      return noWebsite
        ? `Last one, promise. I'll build ${v.businessName} a free homepage just like this — no catch. Want me to? — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`
        : `Last one, promise. I'll build ${v.businessName} a free upgraded homepage like this — no catch. Want me to? — Alistaire @ Boss Digital Solutions. Reply STOP to opt out.`;
  }
}

// Normalise industry value for use in message templates
function formatIndustry(industry?: string | null): string {
  if (!industry) return 'local';
  return industry.toLowerCase().trim();
}

// ─── UK Non-Mobile Number Detection ─────────────────────────────────────────
// Only UK numbers starting with 07 or +447 are mobile.
// 0800, 0300, 0345, 01, 02 are landline/freephone — not SMS-eligible.

export function isUkNonMobile(phone: string | null | undefined, state?: string | null, address?: string | null): boolean {
  if (!phone) return false;
  const country = classifyCountry(state, address);
  if (country !== 'UK') return false;

  const cleaned = phone.replace(/[\s\-()]/g, '');
  // UK mobile: starts with 07 (local) or +447 (international)
  if (cleaned.startsWith('+447') || cleaned.startsWith('07')) return false;
  // Everything else for a UK lead is non-mobile
  return true;
}

// ─── Send Window Logic ──────────────────────────────────────────────────────

// Permitted: Tuesday-Thursday, 9:00am-2:00pm recipient local time
// For simplicity, we use the lead's state/city to approximate timezone.
// Falls back to a reasonable US timezone assumption.

const STATE_TIMEZONE: Record<string, string> = {
  // US Eastern
  CT: 'America/New_York', DC: 'America/New_York', DE: 'America/New_York',
  FL: 'America/New_York', GA: 'America/New_York', IN: 'America/Indiana/Indianapolis',
  KY: 'America/New_York', MA: 'America/New_York', MD: 'America/New_York',
  ME: 'America/New_York', MI: 'America/Detroit', NC: 'America/New_York',
  NH: 'America/New_York', NJ: 'America/New_York', NY: 'America/New_York',
  OH: 'America/New_York', PA: 'America/New_York', RI: 'America/New_York',
  SC: 'America/New_York', TN: 'America/New_York', VA: 'America/New_York',
  VT: 'America/New_York', WV: 'America/New_York',
  // US Central
  AL: 'America/Chicago', AR: 'America/Chicago', IA: 'America/Chicago',
  IL: 'America/Chicago', KS: 'America/Chicago', LA: 'America/Chicago',
  MN: 'America/Chicago', MO: 'America/Chicago', MS: 'America/Chicago',
  ND: 'America/Chicago', NE: 'America/Chicago', OK: 'America/Chicago',
  SD: 'America/Chicago', TX: 'America/Chicago', WI: 'America/Chicago',
  // US Mountain
  AZ: 'America/Phoenix', CO: 'America/Denver', ID: 'America/Boise',
  MT: 'America/Denver', NM: 'America/Denver', UT: 'America/Denver',
  WY: 'America/Denver',
  // US Pacific
  CA: 'America/Los_Angeles', NV: 'America/Los_Angeles', OR: 'America/Los_Angeles',
  WA: 'America/Los_Angeles',
  // US Other
  AK: 'America/Anchorage', HI: 'Pacific/Honolulu',
  // UK
  ENGLAND: 'Europe/London', SCOTLAND: 'Europe/London', WALES: 'Europe/London',
  'NORTHERN IRELAND': 'Europe/London', UK: 'Europe/London',
  'UNITED KINGDOM': 'Europe/London', GB: 'Europe/London', LONDON: 'Europe/London',
  'GREATER LONDON': 'Europe/London', MANCHESTER: 'Europe/London',
  BIRMINGHAM: 'Europe/London', LEEDS: 'Europe/London', GLASGOW: 'Europe/London',
  LIVERPOOL: 'Europe/London', BRISTOL: 'Europe/London', SHEFFIELD: 'Europe/London',
  EDINBURGH: 'Europe/London', CARDIFF: 'Europe/London', BELFAST: 'Europe/London',
  // Australia
  NSW: 'Australia/Sydney', 'NEW SOUTH WALES': 'Australia/Sydney',
  VIC: 'Australia/Melbourne', VICTORIA: 'Australia/Melbourne',
  QLD: 'Australia/Brisbane', QUEENSLAND: 'Australia/Brisbane',
  'WESTERN AUSTRALIA': 'Australia/Perth',
  SA: 'Australia/Adelaide', 'SOUTH AUSTRALIA': 'Australia/Adelaide',
  TAS: 'Australia/Hobart', TASMANIA: 'Australia/Hobart',
  ACT: 'Australia/Sydney', 'AUSTRALIAN CAPITAL TERRITORY': 'Australia/Sydney',
  NT: 'Australia/Darwin', 'NORTHERN TERRITORY': 'Australia/Darwin',
  AUSTRALIA: 'Australia/Sydney', AU: 'Australia/Sydney',
  // New Zealand
  NZ: 'Pacific/Auckland', 'NEW ZEALAND': 'Pacific/Auckland',
  AUCKLAND: 'Pacific/Auckland', WELLINGTON: 'Pacific/Auckland',
  CANTERBURY: 'Pacific/Auckland', OTAGO: 'Pacific/Auckland',
  WAIKATO: 'Pacific/Auckland', 'BAY OF PLENTY': 'Pacific/Auckland',
  MANAWATU: 'Pacific/Auckland', NORTHLAND: 'Pacific/Auckland',
  TARANAKI: 'Pacific/Auckland', 'HAWKES BAY': 'Pacific/Auckland',
  SOUTHLAND: 'Pacific/Auckland', NELSON: 'Pacific/Auckland',
  MARLBOROUGH: 'Pacific/Auckland', TASMAN: 'Pacific/Auckland',
  GISBORNE: 'Pacific/Auckland', 'WEST COAST': 'Pacific/Auckland',
  // South Africa
  'WESTERN CAPE': 'Africa/Johannesburg', GAUTENG: 'Africa/Johannesburg',
  'KWAZULU-NATAL': 'Africa/Johannesburg', 'EASTERN CAPE': 'Africa/Johannesburg',
  'FREE STATE': 'Africa/Johannesburg', LIMPOPO: 'Africa/Johannesburg',
  MPUMALANGA: 'Africa/Johannesburg', 'NORTH WEST': 'Africa/Johannesburg',
  'NORTHERN CAPE': 'Africa/Johannesburg', 'SOUTH AFRICA': 'Africa/Johannesburg',
  ZA: 'Africa/Johannesburg',
};

function getTimezone(state?: string | null): string {
  if (!state) return 'America/New_York'; // sensible default
  const upper = state.toUpperCase().trim();
  return STATE_TIMEZONE[upper] || 'America/New_York';
}

function getLocalHour(timezone: string): { dayOfWeek: number; hour: number } {
  const now = new Date();
  const formatted = now.toLocaleString('en-US', { timeZone: timezone, hour12: false });
  // formatted = "4/7/2026, 14:30:00"
  const [datePart, timePart] = formatted.split(', ');
  const hour = parseInt(timePart.split(':')[0]);

  // Get day of week in recipient timezone
  const dayStr = now.toLocaleString('en-US', { timeZone: timezone, weekday: 'short' });
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = dayMap[dayStr] ?? now.getDay();

  return { dayOfWeek, hour };
}

function isInSendWindow(state?: string | null): boolean {
  const tz = getTimezone(state);
  const { dayOfWeek, hour } = getLocalHour(tz);

  // Tuesday(2), Wednesday(3), Thursday(4) only
  if (dayOfWeek < 2 || dayOfWeek > 4) return false;
  // 9:00am - 2:00pm (9 to 13 inclusive, before 14:00)
  if (hour < 9 || hour >= 14) return false;

  return true;
}

function getNextSendWindow(state?: string | null, daysFromNow: number = 0): Date {
  const tz = getTimezone(state);
  const now = new Date();

  // Start from daysFromNow offset
  const candidate = new Date(now);
  candidate.setDate(candidate.getDate() + daysFromNow);

  // Try up to 14 days to find a valid Tue/Wed/Thu
  for (let i = 0; i < 14; i++) {
    const test = new Date(candidate);
    test.setDate(test.getDate() + i);

    const dayStr = test.toLocaleString('en-US', { timeZone: tz, weekday: 'short' });
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const dow = dayMap[dayStr] ?? 0;

    if (dow >= 2 && dow <= 4) {
      // Build 9:00 AM local in that timezone
      const targetLocal = test.toLocaleString('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
      const [month, day, year] = targetLocal.split('/').map(Number);
      const localTarget = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T09:00:00`);

      // Get offset: difference between local interpretation and UTC
      const sampleUtc = test.getTime();
      const sampleLocal = new Date(test.toLocaleString('en-US', { timeZone: tz })).getTime();
      const offsetMs = sampleLocal - sampleUtc;

      const utcTarget = new Date(localTarget.getTime() - offsetMs);

      // Only return future dates
      if (utcTarget > now) {
        // Add random 0-300 minutes to spread sends across the 9am-2pm window
        utcTarget.setMinutes(utcTarget.getMinutes() + Math.floor(Math.random() * 300));
        return utcTarget;
      }
    }
  }

  // Fallback: next Tuesday at 9am UTC
  const fallback = new Date(now);
  fallback.setDate(fallback.getDate() + ((9 - fallback.getDay()) % 7 || 7));
  fallback.setHours(9, 0, 0, 0);
  return fallback;
}

// ─── SMS Volume Limits ──────────────────────────────────────────────────────
// Warmup: 50 → 150 → 300 → 500/day over 4 weeks

function getSmsLimit(settings: { smsWarmupStartDate: Date | null; smsDailyLimit: number }): number {
  if (!settings.smsWarmupStartDate) return settings.smsDailyLimit;

  const daysSinceStart = Math.floor(
    (Date.now() - settings.smsWarmupStartDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceStart < 7) return Math.min(50, settings.smsDailyLimit);
  if (daysSinceStart < 14) return Math.min(150, settings.smsDailyLimit);
  if (daysSinceStart < 21) return Math.min(300, settings.smsDailyLimit);
  return Math.min(500, settings.smsDailyLimit);
}

// ─── Core: Generate messages for a sequence ─────────────────────────────────

interface SequenceLead {
  id: string;
  businessName: string;
  ownerName?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  industry?: string | null;
  hasWebsite?: boolean;
  customDemoLink?: string | null;
  ghlContactId?: string | null;
}

export function generateSequenceMessages(
  lead: SequenceLead,
  demoLink: string
): { message1: string; message2: string; message3: string } {
  const country = classifyCountry(lead.state, lead.address);
  const variant: Variant = lead.hasWebsite ? 'BAD_WEBSITE' : 'NO_WEBSITE';
  const v: TemplateVars = {
    businessName: lead.businessName,
    city: lead.city || 'your area',
    industry: formatIndustry(lead.industry),
    demoLink,
  };

  return {
    message1: getMessage1(country, variant, v),
    message2: getMessage2(country, variant, v),
    message3: getMessage3(country, variant, v),
  };
}

// ─── Core: Start a sequence for a lead ──────────────────────────────────────

export async function startSmsSequence(
  userId: string,
  leadId: string,
  demoLink: string
): Promise<{ id: string; message1: string; message2: string; message3: string }> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, userId },
  });
  if (!lead) throw new Error('Lead not found');
  if (!lead.phone) throw new Error('Lead has no phone number');

  // Check for existing active sequence
  const existing = await prisma.smsSequence.findFirst({
    where: { leadId, userId, status: { in: ['PENDING', 'ACTIVE'] } },
  });
  if (existing) throw new Error('Lead already has an active SMS sequence');

  const messages = generateSequenceMessages(lead, demoLink);

  // Calculate first send time
  const nextSendAt = isInSendWindow(lead.state) ? new Date() : getNextSendWindow(lead.state);

  const sequence = await prisma.smsSequence.create({
    data: {
      userId,
      leadId,
      status: 'PENDING',
      currentStep: 1,
      message1: messages.message1,
      message2: messages.message2,
      message3: messages.message3,
      nextSendAt,
    },
  });

  return { id: sequence.id, ...messages };
}

// ─── Core: Stop a sequence ──────────────────────────────────────────────────

export async function stopSmsSequence(sequenceId: string, userId: string, reason: 'REPLIED' | 'STOPPED' = 'STOPPED') {
  await prisma.smsSequence.updateMany({
    where: { id: sequenceId, userId },
    data: {
      status: reason,
      nextSendAt: null,
      ...(reason === 'REPLIED' ? { repliedAt: new Date() } : {}),
    },
  });
}

// ─── Core: Stop all active sequences for a lead (on reply) ─────────────────

export async function stopSequencesForLead(leadId: string) {
  await prisma.smsSequence.updateMany({
    where: { leadId, status: { in: ['PENDING', 'ACTIVE'] } },
    data: { status: 'REPLIED', repliedAt: new Date(), nextSendAt: null },
  });
}

// ─── Scheduler: Process due SMS sequence messages ───────────────────────────

export async function processSmsSequences() {
  try {
    const now = new Date();

    // Find all sequences that are due to send
    const dueSequences = await prisma.smsSequence.findMany({
      where: {
        status: { in: ['PENDING', 'ACTIVE'] },
        nextSendAt: { lte: now },
      },
      include: { lead: true },
    });

    if (dueSequences.length === 0) return;

    // Group by userId to check daily limits
    const byUser = new Map<string, typeof dueSequences>();
    for (const seq of dueSequences) {
      const list = byUser.get(seq.userId) || [];
      list.push(seq);
      byUser.set(seq.userId, list);
    }

    for (const [userId, sequences] of byUser) {
      const settings = await prisma.settings.findUnique({ where: { userId } });
      if (!settings) continue;

      const ghlApiKey = decryptField(settings.ghlApiKey) || process.env.GHL_API_KEY;
      const ghlLocationId = settings.ghlLocationId || process.env.GHL_LOCATION_ID;
      if (!ghlApiKey || !ghlLocationId) {
        console.error(`SMS sequence: no GHL credentials for user ${userId}`);
        continue;
      }

      // Check daily send limit
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const sentToday = await prisma.smsSequence.count({
        where: {
          userId,
          OR: [
            { message1SentAt: { gte: todayStart } },
            { message2SentAt: { gte: todayStart } },
            { message3SentAt: { gte: todayStart } },
          ],
        },
      });

      const limit = getSmsLimit(settings);
      let remaining = limit - sentToday;
      if (remaining <= 0) continue;

      for (const seq of sequences) {
        if (remaining <= 0) break;

        // Double-check send window for this lead's timezone
        if (!isInSendWindow(seq.lead.state)) {
          // Reschedule to next window
          const nextWindow = getNextSendWindow(seq.lead.state);
          await prisma.smsSequence.update({
            where: { id: seq.id },
            data: { nextSendAt: nextWindow },
          });
          continue;
        }

        // Ensure lead still has phone and hasn't unsubscribed
        if (!seq.lead.phone || seq.lead.unsubscribed) {
          await prisma.smsSequence.update({
            where: { id: seq.id },
            data: { status: 'STOPPED', nextSendAt: null },
          });
          continue;
        }

        try {
          // Ensure contact is synced to GHL
          let ghlContactId = seq.lead.ghlContactId;
          if (!ghlContactId) {
            ghlContactId = await syncContactToGhl(
              {
                businessName: seq.lead.businessName,
                ownerName: seq.lead.ownerName,
                email: seq.lead.email,
                phone: seq.lead.phone,
                address: seq.lead.address,
                city: seq.lead.city,
                state: seq.lead.state,
                industry: seq.lead.industry,
                websiteUrl: seq.lead.websiteUrl,
                googleRating: seq.lead.googleRating,
                description: seq.lead.description,
              },
              ghlApiKey,
              ghlLocationId
            );
            await prisma.lead.update({
              where: { id: seq.leadId },
              data: { ghlContactId },
            });
          }

          // Get the message for the current step
          const step = seq.currentStep;
          const message = step === 1 ? seq.message1 : step === 2 ? seq.message2 : seq.message3;
          if (!message) {
            await prisma.smsSequence.update({
              where: { id: seq.id },
              data: { status: 'COMPLETED', nextSendAt: null },
            });
            continue;
          }

          // Send via GHL
          const ghlMessageId = await sendGhlMessage(
            ghlContactId,
            message,
            'SMS',
            ghlApiKey,
            ghlLocationId
          );

          // Update sequence record
          const stepUpdate: Record<string, unknown> = {};
          if (step === 1) {
            stepUpdate.message1SentAt = now;
            stepUpdate.ghlMessageId1 = ghlMessageId;
            stepUpdate.status = 'ACTIVE';
            // Schedule message 2 for Day 3
            stepUpdate.currentStep = 2;
            stepUpdate.nextSendAt = getNextSendWindow(seq.lead.state, 3);
          } else if (step === 2) {
            stepUpdate.message2SentAt = now;
            stepUpdate.ghlMessageId2 = ghlMessageId;
            // Schedule message 3 for Day 10 (7 days after message 2)
            stepUpdate.currentStep = 3;
            stepUpdate.nextSendAt = getNextSendWindow(seq.lead.state, 7);
          } else if (step === 3) {
            stepUpdate.message3SentAt = now;
            stepUpdate.ghlMessageId3 = ghlMessageId;
            // Sequence complete
            stepUpdate.status = 'COMPLETED';
            stepUpdate.nextSendAt = null;
          }

          await prisma.smsSequence.update({
            where: { id: seq.id },
            data: stepUpdate,
          });

          // Update lead status
          await prisma.lead.updateMany({
            where: { id: seq.leadId, status: 'NEW' },
            data: { status: 'CONTACTED' },
          });

          remaining--;

          // Throttle: 2 second delay between sends
          await new Promise((r) => setTimeout(r, 2000));
        } catch (err) {
          console.error(`SMS sequence send failed for ${seq.lead.businessName}:`, err instanceof Error ? err.message : err);
          // Don't stop the sequence — retry at next window
          const nextWindow = getNextSendWindow(seq.lead.state);
          await prisma.smsSequence.update({
            where: { id: seq.id },
            data: { nextSendAt: nextWindow },
          });
        }
      }
    }
  } catch (err) {
    console.error('SMS sequence processor error:', err);
  }
}

// ─── Validate lead has required fields ──────────────────────────────────────

export function validateLeadForSequence(lead: {
  ownerName?: string | null;
  businessName: string;
  phone?: string | null;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
}): { valid: boolean; missing: string[]; nonMobile?: boolean } {
  const missing: string[] = [];
  if (!lead.phone) missing.push('phone');
  if (!lead.industry) missing.push('industry');
  // city is no longer required — falls back to "your area" in templates
  if (isUkNonMobile(lead.phone, lead.state, lead.address)) {
    return { valid: false, missing: [], nonMobile: true };
  }
  return { valid: missing.length === 0, missing };
}
