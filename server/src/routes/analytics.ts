import { Router, Response } from 'express';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const [
      totalLeads,
      leadsByStatus,
      totalEmails,
      emailsByStatus,
      recentEmails,
      recentLeads,
    ] = await Promise.all([
      prisma.lead.count({ where: { userId } }),
      prisma.lead.groupBy({ by: ['status'], where: { userId }, _count: true }),
      prisma.email.count({ where: { userId } }),
      prisma.email.groupBy({ by: ['status'], where: { userId }, _count: true }),
      prisma.email.findMany({
        where: { userId, sentAt: { not: null } },
        orderBy: { sentAt: 'desc' },
        take: 10,
        include: { lead: { select: { businessName: true } } },
      }),
      prisma.lead.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, businessName: true, status: true, createdAt: true },
      }),
    ]);

    const statusMap = Object.fromEntries(leadsByStatus.map((g) => [g.status, g._count]));
    const emailStatusMap = Object.fromEntries(emailsByStatus.map((g) => [g.status, g._count]));

    const sent =
      (emailStatusMap['SENT'] || 0) +
      (emailStatusMap['OPENED'] || 0) +
      (emailStatusMap['CLICKED'] || 0) +
      (emailStatusMap['REPLIED'] || 0);
    const opened =
      (emailStatusMap['OPENED'] || 0) +
      (emailStatusMap['CLICKED'] || 0) +
      (emailStatusMap['REPLIED'] || 0);
    const replied = emailStatusMap['REPLIED'] || 0;
    const converted = statusMap['CONVERTED'] || 0;

    res.json({
      leads: {
        total: totalLeads,
        byStatus: statusMap,
        new: statusMap['NEW'] || 0,
        contacted: statusMap['CONTACTED'] || 0,
        converted,
      },
      emails: {
        total: totalEmails,
        sent,
        opened,
        clicked: emailStatusMap['CLICKED'] || 0,
        replied,
        bounced: emailStatusMap['BOUNCED'] || 0,
        scheduled: emailStatusMap['SCHEDULED'] || 0,
        openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
        replyRate: sent > 0 ? Math.round((replied / sent) * 100) : 0,
        conversionRate: totalLeads > 0 ? Math.round((converted / totalLeads) * 100) : 0,
      },
      recentEmails,
      recentLeads,
    });
  } catch {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Chart data endpoint
router.get('/charts', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const now = new Date();

    // ── Daily emails sent (last 30 days) ─────────────────────────────────────
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const sentEmails = await prisma.email.findMany({
      where: {
        userId,
        sentAt: { gte: thirtyDaysAgo },
        status: { in: ['SENT', 'OPENED', 'CLICKED', 'REPLIED'] },
      },
      select: { sentAt: true },
    });

    const dailyMap: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      dailyMap[d.toISOString().split('T')[0]] = 0;
    }
    for (const e of sentEmails) {
      if (e.sentAt) {
        const key = e.sentAt.toISOString().split('T')[0];
        if (key in dailyMap) dailyMap[key]++;
      }
    }
    const dailyEmails = Object.entries(dailyMap).map(([date, sent]) => ({ date, sent }));

    // ── Funnel ────────────────────────────────────────────────────────────────
    const [totalLeads, contacted, opened, replied, callBooked, converted] = await Promise.all([
      prisma.lead.count({ where: { userId } }),
      prisma.lead.count({ where: { userId, status: { in: ['CONTACTED', 'OPENED', 'REPLIED', 'CALL_BOOKED', 'CONVERTED'] } } }),
      prisma.lead.count({ where: { userId, status: { in: ['OPENED', 'REPLIED', 'CALL_BOOKED', 'CONVERTED'] } } }),
      prisma.lead.count({ where: { userId, status: { in: ['REPLIED', 'CALL_BOOKED', 'CONVERTED'] } } }),
      prisma.lead.count({ where: { userId, status: { in: ['CALL_BOOKED', 'CONVERTED'] } } }),
      prisma.lead.count({ where: { userId, status: 'CONVERTED' } }),
    ]);

    const funnel = [
      { stage: 'Scraped', count: totalLeads },
      { stage: 'Contacted', count: contacted },
      { stage: 'Opened', count: opened },
      { stage: 'Replied', count: replied },
      { stage: 'Call Booked', count: callBooked },
      { stage: 'Converted', count: converted },
    ];

    // ── By industry ───────────────────────────────────────────────────────────
    const emailsWithLeads = await prisma.email.findMany({
      where: { userId, status: { in: ['SENT', 'OPENED', 'CLICKED', 'REPLIED'] } },
      select: { status: true, lead: { select: { industry: true } } },
    });

    const industryMap: Record<string, { sent: number; opened: number; replied: number }> = {};
    for (const e of emailsWithLeads) {
      const industry = e.lead.industry || 'Unknown';
      if (!industryMap[industry]) industryMap[industry] = { sent: 0, opened: 0, replied: 0 };
      industryMap[industry].sent++;
      if (['OPENED', 'CLICKED', 'REPLIED'].includes(e.status)) industryMap[industry].opened++;
      if (e.status === 'REPLIED') industryMap[industry].replied++;
    }
    const byIndustry = Object.entries(industryMap)
      .map(([industry, stats]) => ({ industry, ...stats }))
      .sort((a, b) => b.sent - a.sent)
      .slice(0, 10);

    // ── Heatmap: opens by day of week × hour of day ───────────────────────────
    const openedEmails = await prisma.email.findMany({
      where: { userId, openedAt: { not: null } },
      select: { openedAt: true },
    });

    const heatmap: Record<string, number> = {};
    for (const e of openedEmails) {
      if (e.openedAt) {
        const day = e.openedAt.getDay(); // 0=Sun
        const hour = e.openedAt.getHours();
        const key = `${day}-${hour}`;
        heatmap[key] = (heatmap[key] || 0) + 1;
      }
    }
    const heatmapData = Object.entries(heatmap).map(([key, opens]) => {
      const [day, hour] = key.split('-').map(Number);
      return { day, hour, opens };
    });

    res.json({ dailyEmails, funnel, byIndustry, heatmapData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch chart data' });
  }
});

export default router;
