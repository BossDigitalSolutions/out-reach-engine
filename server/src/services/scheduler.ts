import cron from 'node-cron';
import { prisma } from '../index';
import { sendEmail } from './sendgrid';
import { processFollowUps } from './followup';
import { decryptField } from './encryption';
import {
  syncContactToGhl,
  sendGhlMessage,
  getGhlRecentConversations,
  getGhlMessages,
  addGhlContactTags,
  updateGhlContactField,
} from './ghl';
import { processSmsSequences, stopSequencesForLead } from './smsSequence';
import {
  isRealEstateIndustry,
  isInRealEstateSendWindow,
  RE_LOCKED_SUBJECTS,
  type Market,
} from './realEstateTemplates';

// ─── Real-estate campaign tuning ─────────────────────────────────────────
// Ramped daily cap is anchored to the per-user earliest scheduledAt of any
// RE email. Day 1-7 = 20/day, Day 8-14 = 50/day, Day 15+ = 100/day.
const RE_CAP_WEEK_1 = Number(process.env.RE_CAP_WEEK_1 || 20);
const RE_CAP_WEEK_2 = Number(process.env.RE_CAP_WEEK_2 || 50);
const RE_CAP_WEEK_3_PLUS = Number(process.env.RE_CAP_WEEK_3_PLUS || 100);
// Minimum gap (ms) between any two real-estate sends, applied per-user.
const RE_MIN_SEND_SPACING_MS = Number(process.env.RE_MIN_SEND_SPACING_MS || 60_000);

function isRealEstateEmail(email: {
  subject: string;
  lead: { industry: string | null };
}): boolean {
  if (RE_LOCKED_SUBJECTS.has(email.subject)) return true;
  return isRealEstateIndustry(email.lead.industry);
}

function reMarketForLead(lead: { market: string | null }): Market {
  const m = (lead.market || 'UNKNOWN') as Market;
  if (['UK', 'US', 'CA', 'AU', 'NZ', 'UNKNOWN'].includes(m)) return m;
  return 'UNKNOWN';
}

function reDailyCapForCampaignDay(campaignDay: number): number {
  if (campaignDay <= 7) return RE_CAP_WEEK_1;
  if (campaignDay <= 14) return RE_CAP_WEEK_2;
  return RE_CAP_WEEK_3_PLUS;
}

export function startScheduler() {
  // Every 5 minutes: process scheduled emails
  cron.schedule('*/5 * * * *', async () => {
    await processScheduledEmails();
  });

  // Every hour: check for follow-ups needed
  cron.schedule('0 * * * *', async () => {
    await processFollowUps();
  });

  // Every 5 minutes: process SMS sequences (send due messages)
  cron.schedule('*/5 * * * *', async () => {
    await processSmsSequences();
  });

  // Every 10 minutes: poll GHL for inbound replies
  cron.schedule('*/10 * * * *', async () => {
    await pollGhlReplies();
  });

  // Daily at midnight: increment warmup day
  cron.schedule('0 0 * * *', async () => {
    await incrementWarmupDays();
  });

  console.log('Email scheduler started');
}

async function processScheduledEmails() {
  try {
    const settings = await prisma.settings.findMany({
      where: { sendgridApiKey: { not: null } },
    });

    for (const setting of settings) {
      const limit = setting.warmupMode
        ? Math.min(setting.warmupDay * 2, setting.dailySendLimit)
        : setting.dailySendLimit;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sentToday = await prisma.email.count({
        where: {
          userId: setting.userId,
          sentAt: { gte: today },
          status: { in: ['SENT', 'OPENED', 'CLICKED', 'REPLIED'] },
        },
      });

      if (sentToday >= limit) continue;

      const remaining = limit - sentToday;

      // ─── Real-estate ramped cap ───────────────────────────────────────
      // Day 1 = the earliest scheduled RE email for this user. From there
      // RE_CAP_WEEK_1/2/3_PLUS applies as a per-day ceiling on RE sends only.
      const firstReEmail = await prisma.email.findFirst({
        where: {
          userId: setting.userId,
          subject: { in: Array.from(RE_LOCKED_SUBJECTS) },
        },
        orderBy: { scheduledAt: 'asc' },
        select: { scheduledAt: true },
      });
      const campaignStart = firstReEmail?.scheduledAt || null;
      let reSentToday = 0;
      let reCapToday = Infinity;
      if (campaignStart) {
        const startMidnight = new Date(campaignStart);
        startMidnight.setHours(0, 0, 0, 0);
        const dayN = Math.floor((today.getTime() - startMidnight.getTime()) / (24 * 60 * 60 * 1000)) + 1;
        reCapToday = reDailyCapForCampaignDay(Math.max(1, dayN));
        reSentToday = await prisma.email.count({
          where: {
            userId: setting.userId,
            sentAt: { gte: today },
            status: { in: ['SENT', 'OPENED', 'CLICKED', 'REPLIED'] },
            subject: { in: Array.from(RE_LOCKED_SUBJECTS) },
          },
        });
      }

      // Last-real-estate-send timestamp (for 1-min spacing)
      const lastReSend = await prisma.email.findFirst({
        where: {
          userId: setting.userId,
          subject: { in: Array.from(RE_LOCKED_SUBJECTS) },
          sentAt: { not: null },
        },
        orderBy: { sentAt: 'desc' },
        select: { sentAt: true },
      });
      let lastReSentAt = lastReSend?.sentAt?.getTime() || 0;

      const emails = await prisma.email.findMany({
        where: {
          userId: setting.userId,
          status: 'SCHEDULED',
          scheduledAt: { lte: new Date() },
        },
        take: remaining,
        include: { lead: true },
        orderBy: { scheduledAt: 'asc' },
      });

      for (const email of emails) {
        const reEmail = isRealEstateEmail(email);

        // ─── Phase 3 #3: atomic reply check ─────────────────────────────
        // Re-fetch lead state right before send (could have replied since queue).
        const freshLead = await prisma.lead.findUnique({
          where: { id: email.leadId },
          select: { status: true, unsubscribed: true, email: true, ghlContactId: true },
        });
        if (!freshLead || !freshLead.email || freshLead.unsubscribed) {
          await prisma.email.update({ where: { id: email.id }, data: { status: 'FAILED' } });
          continue;
        }
        if (['REPLIED', 'CALL_BOOKED', 'CONVERTED'].includes(freshLead.status)) {
          // Lead already replied — cancel this send and any later scheduled
          // emails in the same sequence for the same lead.
          await prisma.email.updateMany({
            where: {
              leadId: email.leadId,
              status: 'SCHEDULED',
            },
            data: { status: 'FAILED' },
          });
          continue;
        }

        // ─── Phase 2 #1: window enforcement for real-estate emails ──────
        if (reEmail) {
          const market = reMarketForLead(email.lead);
          if (!isInRealEstateSendWindow(new Date(), market)) {
            // Out of window — leave SCHEDULED, picked up next valid tick.
            continue;
          }

          // ─── Phase 2 #3: ramped daily cap for RE sends ────────────────
          if (reSentToday >= reCapToday) {
            continue;
          }

          // ─── Phase 2 #2: 1-min spacing between RE sends ───────────────
          const sinceLast = Date.now() - lastReSentAt;
          if (lastReSentAt > 0 && sinceLast < RE_MIN_SEND_SPACING_MS) {
            // Skip this tick; another scheduler run will pick it up.
            continue;
          }
        }

        try {
          const sendgridKey = decryptField(setting.sendgridApiKey) || process.env.SENDGRID_API_KEY;
          if (!sendgridKey) {
            console.error(`No SendGrid key for user ${setting.userId}`);
            continue;
          }
          const replyTo = reEmail && process.env.RE_REPLY_TO_ADDRESS
            ? process.env.RE_REPLY_TO_ADDRESS
            : undefined;
          const messageId = await sendEmail(
            {
              to: freshLead.email,
              from: 'info@ma.bossdigitalsolutions.tech',
              fromName: setting.senderName || 'Boss Digital Solutions',
              subject: email.subject,
              body: email.body,
              unsubscribeToken: email.unsubscribeToken || undefined,
              serverUrl: process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3001}`,
              replyTo,
            },
            sendgridKey
          );

          await prisma.email.update({
            where: { id: email.id },
            data: { status: 'SENT', sentAt: new Date(), messageId },
          });

          await prisma.lead.update({
            where: { id: email.leadId },
            data: { status: 'CONTACTED' },
          });

          if (reEmail) {
            reSentToday++;
            lastReSentAt = Date.now();
          }

          // Sync to GHL so the email shows in GoHighLevel conversation
          try {
            const ghlApiKey = decryptField(setting.ghlApiKey) || process.env.GHL_API_KEY;
            const ghlLocationId = setting.ghlLocationId || process.env.GHL_LOCATION_ID;
            if (ghlApiKey && ghlLocationId) {
              let ghlContactId = freshLead.ghlContactId;
              if (!ghlContactId) {
                ghlContactId = await syncContactToGhl(
                  {
                    businessName: email.lead.businessName,
                    ownerName: email.lead.ownerName,
                    email: freshLead.email,
                    phone: email.lead.phone,
                    address: email.lead.address,
                    city: email.lead.city,
                    state: email.lead.state,
                    industry: email.lead.industry,
                    websiteUrl: email.lead.websiteUrl,
                    googleRating: email.lead.googleRating,
                    description: email.lead.description,
                  },
                  ghlApiKey,
                  ghlLocationId
                );
                await prisma.lead.update({
                  where: { id: email.leadId },
                  data: { ghlContactId },
                });
              }
              await sendGhlMessage(ghlContactId, email.body, 'Email', ghlApiKey, ghlLocationId, email.subject);

              // ─── Phase 2 #4: GHL tag push per RE send ─────────────────
              if (reEmail) {
                const stageNum = (email.followupNumber ?? 0) + 1; // 1, 2, 3
                const market = reMarketForLead(email.lead);
                const tags = [
                  'real_estate_outreach',
                  `market_${market.toLowerCase()}`,
                  `sequence_stage_${stageNum}`,
                ];
                try {
                  await addGhlContactTags(ghlContactId, tags, ghlApiKey);
                } catch (tagErr) {
                  console.error('GHL tag push failed (non-blocking):', tagErr instanceof Error ? tagErr.message : tagErr);
                }
                try {
                  await updateGhlContactField(ghlContactId, 'last_sent_at', new Date().toISOString(), ghlApiKey);
                } catch (fieldErr) {
                  console.error('GHL last_sent_at update failed (non-blocking):', fieldErr instanceof Error ? fieldErr.message : fieldErr);
                }
              }
            }
          } catch (ghlErr) {
            console.error('GHL sync failed (non-blocking):', ghlErr instanceof Error ? ghlErr.message : ghlErr);
          }

          // Existing 2s soft delay (kept for non-RE flows); RE flow uses
          // the per-user RE_MIN_SEND_SPACING_MS gate at the top of the loop.
          await new Promise((r) => setTimeout(r, 2000));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Failed to send email ${email.id}:`, msg);
          await prisma.email.update({
            where: { id: email.id },
            data: { status: 'FAILED' },
          });
        }
      }
    }
  } catch (err) {
    console.error('Scheduler error:', err);
  }
}

async function pollGhlReplies() {
  try {
    const settingsList = await prisma.settings.findMany({
      where: { ghlApiKey: { not: null }, ghlLocationId: { not: null } },
    });

    for (const setting of settingsList) {
      const ghlApiKey = decryptField(setting.ghlApiKey);
      const ghlLocationId = setting.ghlLocationId;
      if (!ghlApiKey || !ghlLocationId) continue;

      try {
        const conversations = await getGhlRecentConversations(ghlApiKey, ghlLocationId);

        for (const convo of conversations) {
          // Only care about conversations with inbound replies
          if (convo.lastMessageDirection !== 'inbound') continue;

          // Find the lead by GHL contact ID
          const lead = await prisma.lead.findFirst({
            where: { ghlContactId: convo.contactId, userId: setting.userId },
          });
          if (!lead) continue;

          // Skip if lead is already marked as REPLIED or further in the funnel
          if (['REPLIED', 'CALL_BOOKED', 'CONVERTED'].includes(lead.status)) continue;

          // Check if the inbound message is recent (within last 15 min to avoid re-processing)
          const lastMsgDate = new Date(convo.lastMessageDate);
          const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
          if (lastMsgDate < fifteenMinAgo) continue;

          // Mark lead as REPLIED
          await prisma.lead.update({
            where: { id: lead.id },
            data: { status: 'REPLIED' },
          });

          // Stop any active SMS sequences for this lead
          await stopSequencesForLead(lead.id);

          // Mark the most recent sent email as replied
          const latestEmail = await prisma.email.findFirst({
            where: {
              leadId: lead.id,
              status: { in: ['SENT', 'OPENED', 'CLICKED'] },
            },
            orderBy: { sentAt: 'desc' },
          });

          if (latestEmail) {
            await prisma.email.update({
              where: { id: latestEmail.id },
              data: { status: 'REPLIED', repliedAt: new Date() },
            });
          }

          console.log(`GHL poll: marked lead ${lead.businessName} as REPLIED`);
        }
      } catch (err) {
        console.error(`GHL poll error for user ${setting.userId}:`, err instanceof Error ? err.message : err);
      }
    }
  } catch (err) {
    console.error('GHL reply poll error:', err);
  }
}

async function incrementWarmupDays() {
  await prisma.settings.updateMany({
    where: { warmupMode: true },
    data: { warmupDay: { increment: 1 } },
  });
}
