// ─── One-off migration: fix SA leads mis-normalized to +44 (UK) ─────────────
//
// Background: the old DB-write path used normalizePhone(), whose leading-0 branch
// defaults to UK, so South African national numbers (0XXXXXXXXX, 10 digits → 9
// national digits) were stored as "+44XXXXXXXXX" and SA mobiles mislabelled as
// landline. Genuine UK numbers are 10 national digits → "+44" + 10 digits.
//
// This script ONLY migrates rows that satisfy BOTH signals:
//   1. location is South African (state is an SA province code), AND
//   2. phone is "+44" + exactly 9 digits (the SA mis-normalization signature).
// It reconstructs the original local number ("0" + 9 digits) and reclassifies it
// with classifyZaPhone() — the SAME function the live CSV/DB paths use.
//
// Everything else is LEFT UNTOUCHED. Genuine UK (England/Scotland/Wales, 10-digit),
// US (+1), AU/NZ and any row that fails either signal are never modified. Rows
// that match one signal but not the other are reported as AMBIGUOUS and skipped
// for manual review — never guessed.
//
// Usage:
//   npx tsx src/migrateSaPhones.ts            # DRY RUN — shows what would change
//   npx tsx src/migrateSaPhones.ts --apply    # actually writes the changes

import { PrismaClient } from '@prisma/client';
import { classifyZaPhone } from './services/phoneUtils';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

// ISO 3166-2:ZA province short codes Google returns for administrative_area_level_1.
const SA_PROVINCES = new Set(['WC', 'EC', 'GP', 'NC', 'NW', 'FS', 'MP', 'LP', 'KZN', 'NL']);
const UK_COUNTRIES = new Set(['England', 'Scotland', 'Wales', 'Northern Ireland']);

interface Row {
  id: string;
  phone: string | null;
  businessName: string;
  city: string | null;
  state: string | null;
}

interface Plan {
  row: Row;
  rest: string; // 9 national digits
  newPhone: string;
  newMobile: boolean;
}

async function main() {
  console.log(`\n=== SA phone migration (${APPLY ? 'APPLY' : 'DRY RUN'}) ===\n`);

  const plus44 = await prisma.lead.findMany({
    where: { phone: { startsWith: '+44' } },
    select: { id: true, phone: true, businessName: true, city: true, state: true },
  });

  const toMigrate: Plan[] = [];
  const ambiguous: Array<{ row: Row; reason: string }> = [];
  const leaveByState = new Map<string, number>();

  for (const row of plus44) {
    const digits = (row.phone || '').replace(/\D/g, ''); // e.g. "44824682509"
    const rest = digits.startsWith('44') ? digits.slice(2) : digits; // strip country code
    const isSaShape = /^\d{9}$/.test(rest);
    const state = row.state || '';
    const isSA = SA_PROVINCES.has(state);
    const isUK = UK_COUNTRIES.has(state);

    if (isSA && isSaShape) {
      // Reconstruct the original local number and reclassify with the shared SA logic.
      const za = classifyZaPhone('0' + rest);
      if (!za || za.e164 !== '+27' + rest) {
        ambiguous.push({ row, reason: `unexpected reclassification: ${za?.e164}` });
        continue;
      }
      toMigrate.push({ row, rest, newPhone: za.e164, newMobile: za.status === 'verified' });
    } else if (isSaShape && !isSA) {
      ambiguous.push({ row, reason: `+44+9 SA-shape phone but location not SA (state="${state || 'null'}")` });
    } else if (isSA && !isSaShape) {
      ambiguous.push({ row, reason: `SA location (state="${state}") but phone is not +44+9 shape` });
    } else {
      // Genuine UK / other — leave untouched.
      const k = isUK ? state : state || '(other)';
      leaveByState.set(k, (leaveByState.get(k) || 0) + 1);
    }
  }

  // ── Report ──
  console.log(`+44 rows scanned: ${plus44.length}`);
  console.log(`  → MIGRATE (SA, +44→+27): ${toMigrate.length}`);
  console.log(`  → LEAVE   (UK/other):    ${plus44.length - toMigrate.length - ambiguous.length}`);
  console.log(`  → AMBIGUOUS (skip+list): ${ambiguous.length}\n`);

  const mob = toMigrate.filter((p) => p.newMobile).length;
  console.log(`Of the ${toMigrate.length} to migrate: ${mob} mobile (verified), ${toMigrate.length - mob} landline/non-mobile (unverified)\n`);

  console.log('Rows to migrate:');
  for (const p of toMigrate) {
    console.log(
      `  ${p.row.phone}  →  ${p.newPhone}  [${p.newMobile ? 'mobile' : 'landline'}]  ${p.row.businessName}  (${p.row.city || '?'}/${p.row.state || '?'})`
    );
  }

  console.log('\nLeft untouched (by state):');
  for (const [s, c] of [...leaveByState.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c.toString().padStart(4)}  ${s}`);
  }

  if (ambiguous.length) {
    console.log('\n⚠ AMBIGUOUS — NOT changed, please review manually:');
    for (const a of ambiguous) {
      console.log(`  ${a.row.phone}  ${a.row.businessName}  (${a.row.city || '?'}/${a.row.state || '?'})  — ${a.reason}`);
    }
  }

  // ── Apply ──
  if (!APPLY) {
    console.log('\nDRY RUN — no changes written. Re-run with --apply to commit.\n');
    return;
  }

  console.log('\nApplying...');
  await prisma.$transaction(
    toMigrate.map((p) =>
      prisma.lead.update({
        where: { id: p.row.id },
        data: { phone: p.newPhone, phoneMobile: p.newMobile },
      })
    )
  );
  console.log(`✓ Updated ${toMigrate.length} rows.\n`);
}

main()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
