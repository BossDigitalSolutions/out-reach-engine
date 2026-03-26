import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { LeadStatus } from '@prisma/client';
import { calculateScore } from '../services/scoring';
import { scrapeWebsite } from '../services/websiteScraper';

const router = Router();
router.use(authenticate);

const leadSchema = z.object({
  businessName: z.string().min(1),
  ownerName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  industry: z.string().optional(),
  websiteUrl: z.string().optional(),
  hasWebsite: z.boolean().optional(),
  googleRating: z.number().optional(),
  reviewCount: z.number().optional(),
  description: z.string().optional(),
  customDemoLink: z.string().optional(),
  placeId: z.string().optional(),
});

// GET /api/leads
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const {
      status,
      industry,
      hasWebsite,
      search,
      sortBy,
      page = '1',
      limit = '50',
    } = req.query;

    const where: Record<string, unknown> = { userId: req.user!.userId };

    if (status && status !== 'ALL') {
      where.status = status as LeadStatus;
    }
    if (industry) {
      where.industry = { contains: industry as string, mode: 'insensitive' };
    }
    if (hasWebsite !== undefined && hasWebsite !== '') {
      where.hasWebsite = hasWebsite === 'true';
    }
    if (search) {
      where.OR = [
        { businessName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { city: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const orderBy =
      sortBy === 'score'
        ? [{ score: 'desc' as const }, { createdAt: 'desc' as const }]
        : sortBy === 'websiteScore'
          ? [{ websiteScore: 'asc' as const }, { createdAt: 'desc' as const }]  // worst website first
          : [{ createdAt: 'desc' as const }];

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: parseInt(limit as string),
        orderBy,
        include: {
          _count: { select: { emails: true, notes: true } },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    res.json({ leads, total, page: parseInt(page as string), limit: parseInt(limit as string) });
  } catch {
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// GET /api/leads/industries — distinct industry values for current user
router.get('/industries', async (req: AuthRequest, res: Response) => {
  try {
    const rows = await prisma.lead.findMany({
      where: { userId: req.user!.userId, industry: { not: null } },
      select: { industry: true },
      distinct: ['industry'],
      orderBy: { industry: 'asc' },
    });
    const industries = rows.map((r) => r.industry).filter(Boolean) as string[];
    res.json(industries);
  } catch {
    res.status(500).json({ error: 'Failed to fetch industries' });
  }
});

// GET /api/leads/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
      include: {
        emails: { orderBy: { createdAt: 'desc' } },
        notes: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch {
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// POST /api/leads
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const data = leadSchema.parse(req.body);
    const settings = await prisma.settings.findUnique({ where: { userId: req.user!.userId } });
    const score = calculateScore(data, settings);
    const lead = await prisma.lead.create({
      data: { ...data, userId: req.user!.userId, score },
    });
    res.status(201).json(lead);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// PUT /api/leads/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const data = leadSchema.partial().parse(req.body);
    const lead = await prisma.lead.updateMany({
      where: { id: req.params.id, userId: req.user!.userId },
      data,
    });
    if (lead.count === 0) return res.status(404).json({ error: 'Lead not found' });
    const updated = await prisma.lead.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// PATCH /api/leads/:id/status
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const { status } = z.object({ status: z.nativeEnum(LeadStatus) }).parse(req.body);
    const lead = await prisma.lead.updateMany({
      where: { id: req.params.id, userId: req.user!.userId },
      data: { status },
    });
    if (lead.count === 0) return res.status(404).json({ error: 'Lead not found' });
    const updated = await prisma.lead.findUnique({ where: { id: req.params.id } });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE /api/leads/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await prisma.lead.deleteMany({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Lead not found' });
    res.json({ message: 'Lead deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// DELETE /api/leads (bulk)
router.delete('/', async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = z.object({ ids: z.array(z.string()) }).parse(req.body);
    await prisma.lead.deleteMany({
      where: { id: { in: ids }, userId: req.user!.userId },
    });
    res.json({ message: 'Leads deleted' });
  } catch {
    res.status(500).json({ error: 'Failed to delete leads' });
  }
});

// PATCH /api/leads/:id/followups — stop or resume follow-ups for a lead
router.patch('/:id/followups', async (req: AuthRequest, res: Response) => {
  try {
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    const result = await prisma.lead.updateMany({
      where: { id: req.params.id, userId: req.user!.userId },
      data: { followupsEnabled: enabled },
    });
    if (result.count === 0) return res.status(404).json({ error: 'Lead not found' });
    res.json({ followupsEnabled: enabled });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to update follow-up setting' });
  }
});

// POST /api/leads/:id/enrich — scrape website + LinkedIn for contact info & personalization data
router.post('/:id/enrich', async (req: AuthRequest, res: Response) => {
  try {
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    if (!lead.websiteUrl) {
      return res.status(400).json({ error: 'Lead has no website URL to scrape' });
    }

    const scraped = await scrapeWebsite(lead.websiteUrl);

    const updates: Record<string, unknown> = { websiteData: scraped };

    // Only auto-fill email if not already set — prefer best-ranked email
    if (!lead.email && scraped.emails.length > 0) {
      updates.email = scraped.emails[0];
    }
    if (!lead.ownerName && scraped.ownerName) {
      updates.ownerName = scraped.ownerName;
    }
    if (scraped.ownerTitle) updates.ownerTitle = scraped.ownerTitle;
    if (scraped.linkedinUrl) updates.linkedinUrl = scraped.linkedinUrl;

    // Store website quality score and recalculate lead priority
    if (scraped.quality) {
      updates.websiteScore = scraped.quality.score;
      const settings = await prisma.settings.findUnique({ where: { userId: lead.userId } });
      const freshLead = { ...lead, websiteScore: scraped.quality.score };
      updates.score = calculateScore(freshLead as Parameters<typeof calculateScore>[0], settings);
    }

    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: updates,
    });

    res.json({
      lead: updated,
      enriched: {
        emailFound: !!updates.email,
        ownerFound: !!(updates.ownerName || updates.ownerTitle),
        linkedinFound: !!updates.linkedinUrl,
        servicesFound: (scraped.services || []).length,
        allEmailsFound: scraped.allEmailsFound || scraped.emails,
        websiteQuality: scraped.quality ?? null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Enrichment failed';
    res.status(500).json({ error: message });
  }
});

// POST /api/leads/:id/notes
router.post('/:id/notes', async (req: AuthRequest, res: Response) => {
  try {
    const { content } = z.object({ content: z.string().min(1) }).parse(req.body);
    // Verify lead belongs to user
    const lead = await prisma.lead.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const note = await prisma.note.create({
      data: { content, leadId: req.params.id, userId: req.user!.userId },
    });
    res.status(201).json(note);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to add note' });
  }
});

export default router;
