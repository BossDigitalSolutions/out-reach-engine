import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import { prisma } from '../index';

export async function processFollowUps() {
  try {
    const settings = await prisma.settings.findMany({
      where: {
        followupsEnabled: true,
        anthropicApiKey: { not: null },
      },
    });

    for (const setting of settings) {
      const intervals = [
        setting.followupInterval1,
        setting.followupInterval2,
        setting.followupInterval3,
      ];

      for (let followupNum = 1; followupNum <= 3; followupNum++) {
        const daysSinceSent = intervals[followupNum - 1];
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - daysSinceSent);

        // Find leads that had their last email sent before the cutoff
        // and haven't had a follow-up at this number yet
        const eligibleLeads = await prisma.lead.findMany({
          where: {
            userId: setting.userId,
            followupsEnabled: true,
            unsubscribed: false,
            status: { in: ['CONTACTED', 'OPENED'] },
            email: { not: null },
          },
          include: {
            emails: {
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        });

        for (const lead of eligibleLeads) {
          // Count follow-ups already sent
          const followupsSent = lead.emails.filter(
            (e) => e.followupNumber > 0 && ['SENT', 'OPENED', 'CLICKED', 'REPLIED'].includes(e.status)
          ).length;

          // Already sent this many or more follow-ups
          if (followupsSent >= followupNum) continue;

          // Check if previous number follow-up was already sent
          if (followupNum > 1 && followupsSent < followupNum - 1) continue;

          // Find the most recent email sent to this lead
          const lastSentEmail = lead.emails.find(
            (e) => e.sentAt !== null && ['SENT', 'OPENED', 'CLICKED', 'REPLIED'].includes(e.status)
          );
          if (!lastSentEmail || !lastSentEmail.sentAt) continue;

          // Check if enough time has passed since last email
          if (lastSentEmail.sentAt > cutoff) continue;

          // Check if a follow-up at this number is already queued/sent
          const existingFollowup = lead.emails.find(
            (e) => e.followupNumber === followupNum
          );
          if (existingFollowup) continue;

          // Generate and queue the follow-up
          await generateFollowUp(lead, followupNum, lastSentEmail.subject, setting);
        }
      }
    }
  } catch (err) {
    console.error('Follow-up processor error:', err);
  }
}

async function generateFollowUp(
  lead: {
    id: string;
    userId: string;
    businessName: string;
    ownerName: string | null;
    industry: string | null;
    city: string | null;
    state: string | null;
    hasWebsite: boolean;
    googleRating: number | null;
    reviewCount: number | null;
  },
  followupNum: number,
  originalSubject: string,
  setting: {
    anthropicApiKey: string | null;
    senderName: string | null;
    emailSignature: string | null;
  }
) {
  try {
    const client = new Anthropic({ apiKey: setting.anthropicApiKey! });

    const urgencyMap = {
      1: 'a gentle, friendly check-in that adds a small piece of value',
      2: 'a slightly more direct follow-up that creates mild urgency without being pushy',
      3: 'a polite breakup email — the final message, leaving the door open but not pressing further',
    };

    const location = [lead.city, lead.state].filter(Boolean).join(', ');

    const prompt = `You are a web designer writing a follow-up cold email to a small business owner.

Business: ${lead.businessName}
Owner: ${lead.ownerName || 'Business Owner'}
Industry: ${lead.industry || 'local business'}
Location: ${location || 'their area'}
Has website: ${lead.hasWebsite ? 'Yes' : 'No'}
Google rating: ${lead.googleRating ?? 'unknown'}
Original email subject: "${originalSubject}"
This is follow-up #${followupNum} of 3.

Write ${urgencyMap[followupNum as 1 | 2 | 3]}.

Rules:
- Keep it SHORT (3–5 sentences max for the body)
- Sound human and conversational, not salesy
- Reference that you've reached out before
- Include {{demo_link}} naturally in the email
- Use {{owner_name}} as a greeting if appropriate
- End with your name as {{sender_name}}
- DO NOT include "Subject:" in the body

Respond with JSON in this exact format:
{"subject": "email subject line here", "body": "email body here"}`;

    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') return;

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const { subject, body } = JSON.parse(jsonMatch[0]);

    const fullBody = setting.emailSignature
      ? `${body}\n\n${setting.emailSignature}`
      : body;

    const unsubscribeToken = crypto.randomBytes(32).toString('hex');

    // Schedule for next available slot (now)
    await prisma.email.create({
      data: {
        userId: lead.userId,
        leadId: lead.id,
        subject: subject || `Re: ${originalSubject}`,
        body: fullBody,
        status: 'SCHEDULED',
        followupNumber: followupNum,
        scheduledAt: new Date(),
        unsubscribeToken,
      },
    });
  } catch (err) {
    console.error(`Failed to generate follow-up for lead ${lead.id}:`, err);
  }
}
