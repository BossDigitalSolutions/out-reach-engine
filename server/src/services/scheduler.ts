import cron from 'node-cron';
import { prisma } from '../index';
import { sendEmail } from './sendgrid';
import { processFollowUps } from './followup';
import { decryptField } from './encryption';
import { syncContactToGhl, sendGhlMessage, getGhlRecentConversations, getGhlMessages } from './ghl';
import { processSmsSequences, stopSequencesForLead } from './smsSequence';

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
        if (!email.lead.email || email.lead.unsubscribed) {
          await prisma.email.update({
            where: { id: email.id },
            data: { status: 'FAILED' },
          });
          continue;
        }

        try {
          const sendgridKey = decryptField(setting.sendgridApiKey) || process.env.SENDGRID_API_KEY;
          if (!sendgridKey) {
            console.error(`No SendGrid key for user ${setting.userId}`);
            continue;
          }
          const messageId = await sendEmail(
            {
              to: email.lead.email,
              from: 'info@ma.bossdigitalsolutions.tech',
              fromName: setting.senderName || 'Boss Digital Solutions',
              subject: email.subject,
              body: email.body,
              unsubscribeToken: email.unsubscribeToken || undefined,
              serverUrl: process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3001}`,
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

          // Sync to GHL so the email shows in GoHighLevel conversation
          try {
            const ghlApiKey = decryptField(setting.ghlApiKey) || process.env.GHL_API_KEY;
            const ghlLocationId = setting.ghlLocationId || process.env.GHL_LOCATION_ID;
            if (ghlApiKey && ghlLocationId) {
              let ghlContactId = email.lead.ghlContactId;
              if (!ghlContactId) {
                ghlContactId = await syncContactToGhl(
                  {
                    businessName: email.lead.businessName,
                    ownerName: email.lead.ownerName,
                    email: email.lead.email,
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
            }
          } catch (ghlErr) {
            console.error('GHL sync failed (non-blocking):', ghlErr instanceof Error ? ghlErr.message : ghlErr);
          }

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
