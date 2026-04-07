import { prisma } from '../index';
import { decryptField } from './encryption';
import { syncContactToGhl, sendGhlMessage } from './ghl';

// ─── Industry Classification ────────────────────────────────────────────────

type IndustryCategory = 'TRADES' | 'BEAUTY' | 'FOOD' | 'REAL_ESTATE' | 'MEDICAL' | 'DEFAULT';

const INDUSTRY_MAP: Record<string, IndustryCategory> = {
  plumber: 'TRADES', plumbing: 'TRADES', electrician: 'TRADES', electrical: 'TRADES',
  hvac: 'TRADES', heating: 'TRADES', cooling: 'TRADES', roofer: 'TRADES', roofing: 'TRADES',
  landscaper: 'TRADES', landscaping: 'TRADES', painter: 'TRADES', painting: 'TRADES',
  contractor: 'TRADES', construction: 'TRADES', handyman: 'TRADES', locksmith: 'TRADES',
  garage: 'TRADES', pest: 'TRADES', cleaning: 'TRADES', pressure: 'TRADES', solar: 'TRADES',
  fencing: 'TRADES', flooring: 'TRADES', tiling: 'TRADES', carpentry: 'TRADES',

  salon: 'BEAUTY', hair: 'BEAUTY', nails: 'BEAUTY', nail: 'BEAUTY', spa: 'BEAUTY',
  tattoo: 'BEAUTY', lash: 'BEAUTY', aesthetician: 'BEAUTY', beauty: 'BEAUTY',
  barber: 'BEAUTY', wax: 'BEAUTY', brow: 'BEAUTY', makeup: 'BEAUTY', cosmetic: 'BEAUTY',
  skincare: 'BEAUTY', massage: 'BEAUTY',

  restaurant: 'FOOD', cafe: 'FOOD', café: 'FOOD', catering: 'FOOD', bakery: 'FOOD',
  food: 'FOOD', pizza: 'FOOD', bar: 'FOOD', pub: 'FOOD', diner: 'FOOD',
  coffee: 'FOOD', juice: 'FOOD', kitchen: 'FOOD',

  'real estate': 'REAL_ESTATE', realtor: 'REAL_ESTATE', realty: 'REAL_ESTATE',
  agent: 'REAL_ESTATE', property: 'REAL_ESTATE', estate: 'REAL_ESTATE',

  dentist: 'MEDICAL', dental: 'MEDICAL', chiro: 'MEDICAL', chiropractic: 'MEDICAL',
  physio: 'MEDICAL', physiotherapy: 'MEDICAL', doctor: 'MEDICAL', clinic: 'MEDICAL',
  medical: 'MEDICAL', gp: 'MEDICAL', skin: 'MEDICAL', dermatology: 'MEDICAL',
  optometrist: 'MEDICAL', veterinary: 'MEDICAL', vet: 'MEDICAL', pharmacy: 'MEDICAL',
};

function classifyIndustry(industry?: string | null): IndustryCategory {
  if (!industry) return 'DEFAULT';
  const lower = industry.toLowerCase();
  for (const [keyword, category] of Object.entries(INDUSTRY_MAP)) {
    if (lower.includes(keyword)) return category;
  }
  return 'DEFAULT';
}

// ─── Message Templates ──────────────────────────────────────────────────────

interface TemplateVars {
  firstName: string;
  businessName: string;
  city: string;
  demoLink: string;
}

function getMessage1(category: IndustryCategory, v: TemplateVars): string {
  switch (category) {
    case 'TRADES':
      return `Hey ${v.firstName} — noticed ${v.businessName} doesn't have a website yet. Built a free demo of what yours could look like: ${v.demoLink} — Alistaire`;
    case 'BEAUTY':
      return `Hey ${v.firstName} — looks like ${v.businessName} runs off Instagram with no booking site. Made a free demo for you: ${v.demoLink} — Alistaire`;
    case 'FOOD':
      return `Hey ${v.firstName} — noticed ${v.businessName} only has a Facebook page. Built a free demo of what a proper site looks like: ${v.demoLink} — Alistaire`;
    case 'REAL_ESTATE':
      return `Hey ${v.firstName} — saw you're listed under your agency page with no personal site. Made a free demo: ${v.demoLink} — Alistaire`;
    case 'MEDICAL':
      return `Hey ${v.firstName} — noticed ${v.businessName} has no website yet. Built a free demo for practices like yours: ${v.demoLink} — Alistaire`;
    default:
      return `Hey ${v.firstName} — noticed ${v.businessName} doesn't have a website yet. Built a free demo of what yours could look like: ${v.demoLink} — Alistaire`;
  }
}

function getMessage2(category: IndustryCategory, v: TemplateVars): string {
  switch (category) {
    case 'TRADES':
      return `Hey ${v.firstName} — trades businesses in ${v.city} that launched a site last month are averaging 6 extra calls/week from Google. Worth 30 seconds: ${v.demoLink} — Alistaire`;
    case 'BEAUTY':
      return `Hey ${v.firstName} — salons in ${v.city} that added online booking last quarter cut no-shows by half and stopped losing clients to competitors. Did you see the demo? — Alistaire`;
    case 'FOOD':
      return `Hey ${v.firstName} — restaurants in ${v.city} that launched a proper site in Q1 are seeing 30% more reservation requests within 60 days. Did it come through okay? — Alistaire`;
    case 'REAL_ESTATE':
      return `Hey ${v.firstName} — agents in ${v.city} who launched their own site this year are getting direct enquiries instead of sharing leads with 40 others. Worth a look? — Alistaire`;
    case 'MEDICAL':
      return `Hey ${v.firstName} — practices in ${v.city} that added an online booking page this year cut receptionist call volume by 40% in 30 days. Did you see it? — Alistaire`;
    default:
      return `Hey ${v.firstName} — businesses in ${v.city} that launched a site last month are averaging 6 extra calls/week from Google. Worth 30 seconds: ${v.demoLink} — Alistaire`;
  }
}

function getMessage3(category: IndustryCategory, v: TemplateVars): string {
  switch (category) {
    case 'TRADES':
      return `Hey ${v.firstName} — last one I promise. I'll build you a free homepage with ${v.businessName} on it. No catch. Want me to? — Alistaire`;
    case 'BEAUTY':
      return `Hey ${v.firstName} — I'll do a free version with ${v.businessName} name and services on it. Zero cost, done in 24hrs. Just say yes — Alistaire`;
    case 'FOOD':
      return `Hey ${v.firstName} — happy to build a free version with ${v.businessName}'s actual menu on it. No strings. Want me to? — Alistaire`;
    case 'REAL_ESTATE':
      return `Hey ${v.firstName} — I'll build your personal agent homepage for free. Your name, your brand. Want it? — Alistaire`;
    case 'MEDICAL':
      return `Hey ${v.firstName} — I'll do a free version for ${v.businessName}, your name and services on it. Just reply yes — Alistaire`;
    default:
      return `Hey ${v.firstName} — last one I promise. I'll build you a free homepage with ${v.businessName} on it. No catch. Want me to? — Alistaire`;
  }
}

// ─── Send Window Logic ──────────────────────────────────────────────────────

// Permitted: Tuesday-Thursday, 10:00am-2:00pm recipient local time
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
  // Others
  AK: 'America/Anchorage', HI: 'Pacific/Honolulu',
  // South Africa
  'WESTERN CAPE': 'Africa/Johannesburg', 'GAUTENG': 'Africa/Johannesburg',
  'KWAZULU-NATAL': 'Africa/Johannesburg',
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
  // 10:00am - 2:00pm (10 to 13 inclusive, before 14:00)
  if (hour < 10 || hour >= 14) return false;

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
      // Set to 10:00am in the recipient's timezone
      // We approximate by getting the current UTC offset for that timezone
      const localNoon = new Date(test.toLocaleString('en-US', { timeZone: tz }));
      const utcNoon = new Date(test);

      // Build 10:00 AM local in that timezone
      const targetLocal = test.toLocaleString('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
      const [month, day, year] = targetLocal.split('/').map(Number);
      const localTarget = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T10:00:00`);

      // Get offset: difference between local interpretation and UTC
      const sampleUtc = test.getTime();
      const sampleLocal = new Date(test.toLocaleString('en-US', { timeZone: tz })).getTime();
      const offsetMs = sampleLocal - sampleUtc;

      const utcTarget = new Date(localTarget.getTime() - offsetMs);

      // Only return future dates
      if (utcTarget > now) {
        // Add random 0-120 minutes to spread sends within the window
        utcTarget.setMinutes(utcTarget.getMinutes() + Math.floor(Math.random() * 120));
        return utcTarget;
      }
    }
  }

  // Fallback: next Tuesday at 10am UTC
  const fallback = new Date(now);
  fallback.setDate(fallback.getDate() + ((9 - fallback.getDay()) % 7 || 7));
  fallback.setHours(10, 0, 0, 0);
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
  industry?: string | null;
  customDemoLink?: string | null;
  ghlContactId?: string | null;
}

export function generateSequenceMessages(
  lead: SequenceLead,
  demoLink: string
): { message1: string; message2: string; message3: string } {
  const category = classifyIndustry(lead.industry);
  const firstName = lead.ownerName?.split(' ')[0] || 'there';
  const v: TemplateVars = {
    firstName,
    businessName: lead.businessName,
    city: lead.city || 'your area',
    demoLink,
  };

  return {
    message1: getMessage1(category, v),
    message2: getMessage2(category, v),
    message3: getMessage3(category, v),
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
}): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!lead.ownerName) missing.push('ownerName (First Name)');
  if (!lead.phone) missing.push('phone');
  if (!lead.industry) missing.push('industry');
  if (!lead.city) missing.push('city');
  return { valid: missing.length === 0, missing };
}
