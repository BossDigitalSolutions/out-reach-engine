// ─── Med Spa Cold Email — LOCKED TEMPLATES ─────────────────────────────────
// Hardcoded in code so they cannot be rewritten by AI or accidentally edited
// via the Email Templates UI. These are the single source of truth for the
// med spa cold outreach sequence.
//
// Cadence: Day 0, Day 3, Day 8 (= 1/4/9 in human terms, where Day 1 is start).
// Send window: Tue/Wed/Thu 08:30 recipient local time. Falls back to next
// valid Tue/Wed/Thu if scheduled date lands on Mon/Fri/Sat/Sun.

interface LockedTemplate {
  subject: string;
  body: string;
}

export const MED_SPA_TEMPLATE_1: LockedTemplate = {
  subject: '10pm sundays',
  body: `Hi {{clinic_name}} team,

Had a look at your site — {{signature_treatment}}'s clearly your headline treatment, and most {{signature_treatment}} enquiries hit at 10pm on a Sunday, not 10am on a Tuesday.

Whoever replies first wins the consultation, and industry data says you lose 80% of leads not answered within 10 minutes.

We build AI booking assistants for med spas — answers in under 30 seconds across WhatsApp, Instagram and your website chat, and books consultations straight into your calendar 24/7. Takes the after-hours and repetitive enquiries off your front desk so the team can focus on patients in clinic.

Quick 90-second video showing one we built — worth a look?

Alistaire
Boss Digital Solutions

P.S. If this isn't your area, mind passing to whoever handles marketing at {{clinic_name}}?`,
};

export const MED_SPA_TEMPLATE_2: LockedTemplate = {
  subject: 'paying twice',
  body: `Hi {{clinic_name}} team,

Different angle from my last note.

Most med spas spend real money on Instagram and Google ads to bring leads in. Then those leads message at 9pm asking about pricing or availability, hear nothing back, and book with whoever replies first the next morning.

You end up paying twice — once to acquire the lead, once when they walk to a competitor.

Our AI booking assistant catches them in under 30 seconds across WhatsApp, Instagram and your website chat, and books straight into your calendar 24/7. Recovers leads you've already paid to generate.

Quick 2-minute video, or 15 minutes on a call — whichever's easier?

Alistaire
Boss Digital Solutions`,
};

export const MED_SPA_TEMPLATE_3: LockedTemplate = {
  subject: 'should i close the file?',
  body: `Hi {{clinic_name}} team,

Last note from me — don't want to clog your inbox.

If the AI booking assistant isn't a fit for {{clinic_name}} right now, totally fair. Should I close the file?

If it's just bad timing, let me know when's better and I'll circle back.

Alistaire
Boss Digital Solutions`,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export function isMedSpaIndustry(industry?: string | null): boolean {
  if (!industry) return false;
  const norm = industry.toLowerCase().trim();
  return norm === 'med spa' || norm === 'spa' || norm === 'medspa';
}

// Plain regex merge — no template engine
export function renderLockedTemplate(
  template: LockedTemplate,
  vars: Record<string, string>
): LockedTemplate {
  let subject = template.subject;
  let body = template.body;
  for (const [key, value] of Object.entries(vars)) {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    subject = subject.replace(pattern, value);
    body = body.replace(pattern, value);
  }
  return { subject, body };
}

// Validate no unresolved {{...}} placeholders remain
export function hasUnresolvedPlaceholders(content: string): boolean {
  return /\{\{[^}]*\}\}/.test(content);
}

// ─── Schedule helpers — Tue/Wed/Thu 08:30 Europe/London ───────────────────

const SEND_TZ = 'Europe/London';

function getLondonDayOfWeek(date: Date): number {
  const dayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: SEND_TZ,
    weekday: 'short',
  }).format(date);
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return dayMap[dayStr] ?? 0;
}

// Snap a date to the next valid Tue/Wed/Thu at 08:30 London local time
// (DST-aware via Intl.DateTimeFormat)
export function snapToNextSendSlot(from: Date): Date {
  for (let i = 0; i < 14; i++) {
    const candidate = new Date(from);
    candidate.setDate(candidate.getDate() + i);
    const dow = getLondonDayOfWeek(candidate);
    if (dow >= 2 && dow <= 4) {
      // Build 08:30 London time for this date
      const dateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: SEND_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(candidate);

      // Compute UTC offset for this date in London (DST-aware)
      const sampleUtc = new Date(`${dateStr}T12:00:00Z`);
      const sampleLocal = new Date(sampleUtc.toLocaleString('en-US', { timeZone: SEND_TZ }));
      const offsetMs = sampleLocal.getTime() - sampleUtc.getTime();

      const local0830 = new Date(`${dateStr}T08:30:00`);
      const utcTarget = new Date(local0830.getTime() - offsetMs);

      // Only future
      if (utcTarget > from) return utcTarget;
    }
  }
  // Fallback: 7 days from now
  const fallback = new Date(from);
  fallback.setDate(fallback.getDate() + 7);
  fallback.setHours(8, 30, 0, 0);
  return fallback;
}

// ─── Public: generate the 3-email locked sequence with schedule ────────────

export interface MedSpaEmailDraft {
  subject: string;
  body: string;
  scheduledAt: Date;
  followupNumber: number; // 0, 1, 2
}

export interface MedSpaSequenceLead {
  businessName: string;
  email?: string | null;
  emailFromSite?: string | null;
  signatureTreatment?: string | null;
}

export type MedSpaGenerationResult =
  | { ok: true; emails: MedSpaEmailDraft[]; usedFallbackTreatment: boolean }
  | { ok: false; reason: 'no_email' | 'no_clinic_name' | 'placeholder_unresolved' };

export function generateMedSpaSequence(lead: MedSpaSequenceLead): MedSpaGenerationResult {
  // Pre-flight: must have a usable email
  const targetEmail = lead.emailFromSite || lead.email;
  if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
    return { ok: false, reason: 'no_email' };
  }

  const clinicName = lead.businessName?.trim();
  if (!clinicName) {
    return { ok: false, reason: 'no_clinic_name' };
  }

  const sigTreatment = lead.signatureTreatment?.trim() || 'your treatments';
  const usedFallbackTreatment = !lead.signatureTreatment?.trim();

  const vars1 = { clinic_name: clinicName, signature_treatment: sigTreatment };
  const vars23 = { clinic_name: clinicName };

  const rendered1 = renderLockedTemplate(MED_SPA_TEMPLATE_1, vars1);
  const rendered2 = renderLockedTemplate(MED_SPA_TEMPLATE_2, vars23);
  const rendered3 = renderLockedTemplate(MED_SPA_TEMPLATE_3, vars23);

  // Validate no unresolved placeholders
  for (const r of [rendered1, rendered2, rendered3]) {
    if (hasUnresolvedPlaceholders(r.subject) || hasUnresolvedPlaceholders(r.body)) {
      return { ok: false, reason: 'placeholder_unresolved' };
    }
  }

  // Schedule
  const now = new Date();
  const day0 = snapToNextSendSlot(now);

  const day3from = new Date(day0);
  day3from.setDate(day3from.getDate() + 3);
  const day3 = snapToNextSendSlot(day3from);

  const day8from = new Date(day3);
  day8from.setDate(day8from.getDate() + 5);
  const day8 = snapToNextSendSlot(day8from);

  const emails: MedSpaEmailDraft[] = [
    { subject: rendered1.subject, body: rendered1.body, scheduledAt: day0, followupNumber: 0 },
    { subject: rendered2.subject, body: rendered2.body, scheduledAt: day3, followupNumber: 1 },
    { subject: rendered3.subject, body: rendered3.body, scheduledAt: day8, followupNumber: 2 },
  ];

  return { ok: true, emails, usedFallbackTreatment };
}
