import { prisma } from '../index';
import { decryptField } from './encryption';
import { syncContactToGhl, sendGhlMessage } from './ghl';
import { normalizePhone, isSmsEligible } from './phoneUtils';

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
// 3-message sequence: Day 0 (Observation Hook), Day 3 (Proof Nudge), Day 7 (Gift Close)
// Messages 1 and 2 contain NO link. Only Message 3 contains the demo link.
// No "Reply STOP" — GHL appends opt-out language automatically.

interface TemplateVars {
  businessName: string;
  trade: string;      // singular: "plumber", "electrician", "roofer"
  tradePlural: string; // plural: "plumbers", "electricians", "roofers"
  demoLink: string;
}

function getMessage1(v: TemplateVars): string {
  return `Hey — had a look at ${v.businessName} online earlier. Noticed you're not really showing up when people in your area search for a ${v.trade} on Google. Is that intentional, or something you've been meaning to sort?`;
}

function getMessage2(v: TemplateVars): string {
  return `Reason I ask — the ${v.tradePlural} ranking page 1 in your area are pulling in most of the Google job enquiries. Had a thought on what ${v.businessName} could look like if you wanted that same setup. Worth me showing you, or not really your thing?`;
}

function getMessage3(v: TemplateVars): string {
  return `Went ahead and put together a quick example for ${v.businessName} — have a look if you want: ${v.demoLink}. If it's not for you no worries, I'll leave you to it. Alistaire, Boss Digital`;
}

// Normalise industry to singular trade name
function formatTrade(industry?: string | null): string {
  if (!industry) return 'tradesperson';
  return industry.toLowerCase().trim();
}

// Pluralise a trade name
function pluraliseTrade(trade: string): string {
  if (trade.endsWith('s')) return trade;
  if (trade.endsWith('man')) return trade.slice(0, -3) + 'men';
  return trade + 's';
}

// ─── Phone SMS Eligibility (delegates to phoneUtils) ────────────────────────

export function isUkNonMobile(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const info = normalizePhone(phone);
  if (!info) return false;
  return !isSmsEligible(info);
}

// ─── Send Window Logic ──────────────────────────────────────────────────────
// All sends locked to Europe/London timezone (DST-aware via Intl API).
// Allowed: Tuesday, Wednesday, Thursday — 18:30 to 20:30 UK local time.
// Sends are jittered randomly across the 120-minute window.

const SEND_TZ = 'Europe/London';

function getLondonTime(date?: Date): { dayOfWeek: number; hour: number; minute: number } {
  const d = date || new Date();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: SEND_TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const weekday = parts.find(p => p.type === 'weekday')?.value || '';
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');

  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = dayMap[weekday] ?? 0;

  return { dayOfWeek, hour, minute };
}

function isInSendWindow(): boolean {
  const { dayOfWeek, hour, minute } = getLondonTime();

  // Tuesday(2), Wednesday(3), Thursday(4) only
  if (dayOfWeek < 2 || dayOfWeek > 4) return false;

  // 18:30 to 20:30
  const timeMinutes = hour * 60 + minute;
  if (timeMinutes < 18 * 60 + 30 || timeMinutes >= 20 * 60 + 30) return false;

  return true;
}

function getNextSendWindow(daysFromNow: number = 0): Date {
  const now = new Date();

  // Start from daysFromNow offset
  const candidate = new Date(now);
  candidate.setDate(candidate.getDate() + daysFromNow);

  // Try up to 14 days to find a valid Tue/Wed/Thu
  for (let i = 0; i < 14; i++) {
    const test = new Date(candidate);
    test.setDate(test.getDate() + i);

    const { dayOfWeek } = getLondonTime(test);

    if (dayOfWeek >= 2 && dayOfWeek <= 4) {
      // Build 18:30 London time for this date
      // Get the date string in London timezone
      const dateParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: SEND_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(test); // "2026-04-23"

      // Create 18:30 in London time by computing the UTC offset
      const londonNoon = new Date(`${dateParts}T12:00:00Z`);
      const londonNoonLocal = new Date(londonNoon.toLocaleString('en-US', { timeZone: SEND_TZ }));
      const offsetMs = londonNoonLocal.getTime() - londonNoon.getTime();

      // 18:30 London = 18:30 local → convert to UTC
      const local1830 = new Date(`${dateParts}T18:30:00`);
      const utcTarget = new Date(local1830.getTime() - offsetMs);

      // Only return future dates
      if (utcTarget > now) {
        // Random jitter: 0–120 minutes across the 18:30–20:30 window
        utcTarget.setMinutes(utcTarget.getMinutes() + Math.floor(Math.random() * 120));
        return utcTarget;
      }
    }
  }

  // Fallback: next Tuesday at 18:30 UTC (close enough)
  const fallback = new Date(now);
  fallback.setDate(fallback.getDate() + ((9 - fallback.getDay()) % 7 || 7));
  fallback.setHours(18, 30, 0, 0);
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
  const trade = formatTrade(lead.industry);
  const v: TemplateVars = {
    businessName: lead.businessName,
    trade,
    tradePlural: pluraliseTrade(trade),
    demoLink,
  };

  return {
    message1: getMessage1(v),
    message2: getMessage2(v),
    message3: getMessage3(v),
  };
}

// ─── Core: Start a sequence for a lead ──────────────────────────────────────

export async function startSmsSequence(
  userId: string,
  leadId: string,
  demoLink: string,
  ghlCredentials?: { apiKey: string; locationId: string }
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

  // Immediately sync contact to GHL so it's visible before the first SMS fires
  if (ghlCredentials && !lead.ghlContactId) {
    try {
      const ghlContactId = await syncContactToGhl(
        {
          businessName: lead.businessName,
          ownerName: lead.ownerName,
          email: lead.email,
          phone: lead.phone,
          address: lead.address,
          city: lead.city,
          state: lead.state,
          industry: lead.industry,
          websiteUrl: lead.websiteUrl,
          googleRating: lead.googleRating,
          description: lead.description,
        },
        ghlCredentials.apiKey,
        ghlCredentials.locationId
      );
      await prisma.lead.update({
        where: { id: lead.id },
        data: { ghlContactId },
      });
    } catch (err) {
      console.error(`GHL sync on sequence start failed for ${lead.businessName}:`, err instanceof Error ? err.message : err);
    }
  }

  const messages = generateSequenceMessages(lead, demoLink);

  // Calculate first send time (Tue/Wed/Thu 18:30-20:30 Europe/London)
  const nextSendAt = isInSendWindow() ? new Date() : getNextSendWindow();

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

        // Double-check send window (Tue/Wed/Thu 18:30-20:30 Europe/London)
        if (!isInSendWindow()) {
          // Reschedule to next window
          const nextWindow = getNextSendWindow();
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
            stepUpdate.nextSendAt = getNextSendWindow(3);
          } else if (step === 2) {
            stepUpdate.message2SentAt = now;
            stepUpdate.ghlMessageId2 = ghlMessageId;
            // Schedule message 3 for Day 7 (4 days after message 2)
            stepUpdate.currentStep = 3;
            stepUpdate.nextSendAt = getNextSendWindow(4);
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
          const nextWindow = getNextSendWindow();
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
  phoneMobile?: boolean | null;
  industry?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
}): { valid: boolean; missing: string[]; nonMobile?: boolean } {
  const missing: string[] = [];
  if (!lead.phone) missing.push('phone');
  if (!lead.industry) missing.push('industry');

  // Use stored phoneMobile flag if available, otherwise check dynamically
  if (lead.phoneMobile === false) {
    return { valid: false, missing: [], nonMobile: true };
  }
  if (lead.phoneMobile == null && lead.phone) {
    const info = normalizePhone(lead.phone);
    if (info && !isSmsEligible(info)) {
      return { valid: false, missing: [], nonMobile: true };
    }
  }

  return { valid: missing.length === 0, missing };
}
