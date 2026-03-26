import cron from 'node-cron';
import { prisma } from '../index';
import { sendEmail } from './sendgrid';
import { processFollowUps } from './followup';
import { decryptField } from './encryption';

export function startScheduler() {
  // Every 5 minutes: process scheduled emails
  cron.schedule('*/5 * * * *', async () => {
    await processScheduledEmails();
  });

  // Every hour: check for follow-ups needed
  cron.schedule('0 * * * *', async () => {
    await processFollowUps();
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
              from: 'info@bossdigitalsolutions.tech',
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

async function incrementWarmupDays() {
  await prisma.settings.updateMany({
    where: { warmupMode: true },
    data: { warmupDay: { increment: 1 } },
  });
}
