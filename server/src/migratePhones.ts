// ─── One-time migration: Normalize all existing phone numbers to E.164 ──────
//
// Usage: npx tsx src/migratePhones.ts
//
// This script:
// 1. Reads all leads with a phone number
// 2. Normalizes each to E.164 format
// 3. Sets phoneMobile flag (true = SMS-eligible, false = landline/non-mobile)
// 4. Updates leads in-place
// 5. Logs a summary

import { PrismaClient } from '@prisma/client';
import { normalizePhone, isSmsEligible } from './services/phoneUtils';

const prisma = new PrismaClient();

async function migrate() {
  console.log('Starting phone number migration...\n');

  const leads = await prisma.lead.findMany({
    where: { phone: { not: null } },
    select: { id: true, phone: true, state: true, address: true, businessName: true },
  });

  console.log(`Found ${leads.length} leads with phone numbers.\n`);

  let updated = 0;
  let mobile = 0;
  let landline = 0;
  let unparseable = 0;
  let alreadyE164 = 0;

  for (const lead of leads) {
    if (!lead.phone) continue;

    const info = normalizePhone(lead.phone);
    if (!info) {
      console.log(`  SKIP (unparseable): ${lead.businessName} — "${lead.phone}"`);
      unparseable++;
      continue;
    }

    const isMobile = isSmsEligible(info);
    const changed = info.e164 !== lead.phone;

    if (changed || lead.phone !== info.e164) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          phone: info.e164,
          phoneMobile: isMobile,
        },
      });
      updated++;
    } else {
      // Phone already E.164 but phoneMobile may not be set
      await prisma.lead.update({
        where: { id: lead.id },
        data: { phoneMobile: isMobile },
      });
      alreadyE164++;
    }

    if (isMobile) {
      mobile++;
    } else {
      landline++;
      console.log(`  LANDLINE: ${lead.businessName} — ${info.e164} (${info.country})`);
    }
  }

  console.log('\n─── Migration Summary ───');
  console.log(`Total leads with phone:  ${leads.length}`);
  console.log(`Updated (reformatted):   ${updated}`);
  console.log(`Already E.164:           ${alreadyE164}`);
  console.log(`Unparseable (skipped):   ${unparseable}`);
  console.log(`Mobile (SMS-eligible):   ${mobile}`);
  console.log(`Landline (non-mobile):   ${landline}`);
  console.log('─────────────────────────\n');
}

migrate()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
