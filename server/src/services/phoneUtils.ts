// ─── E.164 Phone Number Normalization & Mobile Detection ─────────────────────
//
// All phone numbers must be stored and sent in E.164 format: +[country code][number]
// No spaces, no dashes, no parentheses.
//
// UK: +44XXXXXXXXXX  (e.g. +447875181141)
// US: +1XXXXXXXXXX   (e.g. +18607630120)
// ZA: +27XXXXXXXXX   (e.g. +27760518635)
// AU: +61XXXXXXXXX
// NZ: +64XXXXXXXXX

type PhoneType = 'mobile' | 'landline' | 'unknown';

export interface PhoneInfo {
  e164: string;        // E.164 formatted number
  type: PhoneType;     // mobile, landline, or unknown
  country: string;     // US, UK, ZA, AU, NZ, or UNKNOWN
  original: string;    // the raw input before normalization
}

function stripNonDigits(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

function stripAllNonDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

// ─── Normalize a phone number to E.164 format ───────────────────────────────

export function normalizePhone(
  rawPhone: string | null | undefined,
  countryHint?: string | null
): PhoneInfo | null {
  if (!rawPhone || rawPhone.trim().length === 0) return null;

  const original = rawPhone.trim();
  // Strip spaces, dashes, parentheses, dots — keep + and digits
  let cleaned = stripNonDigits(original);

  // Already in E.164 format
  if (cleaned.startsWith('+')) {
    const digits = stripAllNonDigits(cleaned);

    // UK: +44...
    if (cleaned.startsWith('+44')) {
      const national = digits.slice(2); // remove 44
      return {
        e164: `+44${national}`,
        type: classifyUkNumber(`0${national}`),
        country: 'UK',
        original,
      };
    }

    // US/CA: +1...
    if (cleaned.startsWith('+1') && digits.length === 11) {
      return {
        e164: `+1${digits.slice(1)}`,
        type: 'unknown', // can't reliably distinguish US mobile vs landline
        country: 'US',
        original,
      };
    }

    // ZA: +27...
    if (cleaned.startsWith('+27')) {
      const national = digits.slice(2);
      return {
        e164: `+27${national}`,
        type: national.startsWith('6') || national.startsWith('7') || national.startsWith('8') ? 'mobile' : 'landline',
        country: 'ZA',
        original,
      };
    }

    // AU: +61...
    if (cleaned.startsWith('+61')) {
      const national = digits.slice(2);
      return {
        e164: `+61${national}`,
        type: national.startsWith('4') ? 'mobile' : 'landline',
        country: 'AU',
        original,
      };
    }

    // NZ: +64...
    if (cleaned.startsWith('+64')) {
      const national = digits.slice(2);
      return {
        e164: `+64${national}`,
        type: national.startsWith('2') ? 'mobile' : 'landline',
        country: 'NZ',
        original,
      };
    }

    // Other international — return as-is
    return { e164: cleaned, type: 'unknown', country: 'UNKNOWN', original };
  }

  // No + prefix — local format. Use digits only.
  const digits = stripAllNonDigits(cleaned);

  // UK local format: starts with 0
  if (digits.startsWith('0') && (digits.length === 11 || digits.length === 10)) {
    const national = digits.slice(1); // remove leading 0
    return {
      e164: `+44${national}`,
      type: classifyUkNumber(digits),
      country: 'UK',
      original,
    };
  }

  // US local format: 10 digits, no leading 0 or 1
  if (digits.length === 10 && !digits.startsWith('0') && !digits.startsWith('1')) {
    return {
      e164: `+1${digits}`,
      type: 'unknown',
      country: 'US',
      original,
    };
  }

  // US with leading 1: 11 digits starting with 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return {
      e164: `+${digits}`,
      type: 'unknown',
      country: 'US',
      original,
    };
  }

  // ZA local: starts with 0, 10 digits
  if (digits.startsWith('0') && digits.length === 10 && countryHint?.toUpperCase() === 'ZA') {
    const national = digits.slice(1);
    return {
      e164: `+27${national}`,
      type: national.startsWith('6') || national.startsWith('7') || national.startsWith('8') ? 'mobile' : 'landline',
      country: 'ZA',
      original,
    };
  }

  // Fallback: if we can't parse, return null
  return null;
}

// ─── UK Number Classification ───────────────────────────────────────────────
// Input: UK local format like "07875181141", "01234567890"

function classifyUkNumber(localDigits: string): PhoneType {
  // 07 prefix = mobile (except 076xx which are pagers)
  if (localDigits.startsWith('07')) {
    if (localDigits.startsWith('076')) return 'landline'; // pagers
    return 'mobile';
  }
  // Everything else is landline/freephone/non-geographic
  // 01, 02 = geographic landlines
  // 03 = non-geographic (0300, 0345 etc.)
  // 0800, 0808 = freephone
  // 0845, 0870 = premium/non-geographic
  return 'landline';
}

// ─── Check if a phone number is SMS-eligible ────────────────────────────────

export function isSmsEligible(info: PhoneInfo): boolean {
  // UK: only mobile numbers (07 excluding 076 pagers)
  if (info.country === 'UK' && info.type !== 'mobile') return false;
  // US: allow all (can't reliably detect mobile vs landline)
  if (info.country === 'US') return true;
  // ZA: only mobile
  if (info.country === 'ZA' && info.type === 'landline') return false;
  // AU: only mobile
  if (info.country === 'AU' && info.type === 'landline') return false;
  // NZ: only mobile
  if (info.country === 'NZ' && info.type === 'landline') return false;
  // Unknown country: allow
  return true;
}

// ─── Quick helper: normalize and return E.164 string or null ────────────────

export function toE164(rawPhone: string | null | undefined, countryHint?: string | null): string | null {
  const info = normalizePhone(rawPhone, countryHint);
  return info?.e164 || null;
}

// ─── Quick helper: is this phone number a mobile? ───────────────────────────

export function isMobileNumber(rawPhone: string | null | undefined, countryHint?: string | null): boolean {
  const info = normalizePhone(rawPhone, countryHint);
  if (!info) return false;
  return isSmsEligible(info);
}
