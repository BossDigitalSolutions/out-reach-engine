import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { searchBusinesses } from '../services/googlePlaces';
import { scrapeWebsite } from '../services/websiteScraper';
import { calculateScore } from '../services/scoring';
import { decryptField } from '../services/encryption';

const router = Router();
router.use(authenticate);

const scraperLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many scrape requests, please wait a minute.' },
});

const searchSchema = z.object({
  industry: z.string().min(1),
  location: z.string().min(1),
  maxResults: z.number().min(1).max(60).optional().default(20),
});

// POST /api/scraper/search
router.post('/search', scraperLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { industry, location, maxResults } = searchSchema.parse(req.body);

    const settings = await prisma.settings.findUnique({
      where: { userId: req.user!.userId },
    });

    const apiKey = decryptField(settings?.googleApiKey) || process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'Google Places API key not configured. Add it in Settings.',
      });
    }

    const results = await searchBusinesses(industry, location, apiKey, maxResults);
    res.json({ results, count: results.length });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    const message = err instanceof Error ? err.message : 'Scrape failed';
    res.status(500).json({ error: message });
  }
});

// POST /api/scraper/save - save selected leads to database
router.post('/save', async (req: AuthRequest, res: Response) => {
  try {
    const { leads } = z
      .object({
        leads: z.array(
          z.object({
            businessName: z.string(),
            ownerName: z.string().optional(),
            email: z.string().optional(),
            phone: z.string().optional(),
            address: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            zip: z.string().optional(),
            industry: z.string().optional(),
            websiteUrl: z.string().optional(),
            hasWebsite: z.boolean().optional(),
            googleRating: z.number().nullable().optional(),
            reviewCount: z.number().nullable().optional(),
            description: z.string().optional(),
            placeId: z.string().optional(),
          })
        ),
      })
      .parse(req.body);

    // Avoid duplicates by placeId
    const existingPlaceIds = new Set(
      (
        await prisma.lead.findMany({
          where: {
            userId: req.user!.userId,
            placeId: { in: leads.map((l) => l.placeId).filter(Boolean) as string[] },
          },
          select: { placeId: true },
        })
      ).map((l) => l.placeId)
    );

    const newLeads = leads.filter(
      (l) => !l.placeId || !existingPlaceIds.has(l.placeId)
    );

    const created = await prisma.lead.createMany({
      data: newLeads.map((lead) => ({
        ...lead,
        googleRating: lead.googleRating ?? null,
        reviewCount: lead.reviewCount ?? null,
        userId: req.user!.userId,
      })),
    });

    const websiteLeadCount = newLeads.filter((l) => l.websiteUrl).length;

    res.status(201).json({
      saved: created.count,
      skipped: leads.length - created.count,
    });

    // Auto-enrich in background AFTER response is sent — wrapped in its own try-catch
    if (websiteLeadCount > 0) {
      (async () => {
        try {
          const savedLeads = await prisma.lead.findMany({
            where: {
              userId: req.user!.userId,
              websiteUrl: { not: null },
              websiteData: null,
            },
            select: { id: true, websiteUrl: true, email: true, ownerName: true },
            orderBy: { createdAt: 'desc' },
            take: websiteLeadCount,
          });

          for (const lead of savedLeads) {
            try {
              const scraped = await scrapeWebsite(lead.websiteUrl!);
              const updates: Record<string, unknown> = { websiteData: scraped };
              if (!lead.email && scraped.emails.length > 0) updates.email = scraped.emails[0];
              if (!lead.ownerName && scraped.ownerName) updates.ownerName = scraped.ownerName;
              if (scraped.ownerTitle) updates.ownerTitle = scraped.ownerTitle;
              if (scraped.linkedinUrl) updates.linkedinUrl = scraped.linkedinUrl;
              if (scraped.quality) {
                updates.websiteScore = scraped.quality.score;
                const settings = await prisma.settings.findUnique({ where: { userId: req.user!.userId } });
                const leadForScore = { ...lead, websiteScore: scraped.quality.score } as Parameters<typeof calculateScore>[0];
                updates.score = calculateScore(leadForScore, settings);
              }
              await prisma.lead.update({ where: { id: lead.id }, data: updates });
            } catch {
              // Skip individual failures silently
            }
          }
        } catch {
          // Skip if DB query fails
        }
      })();
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0].message });
    }
    res.status(500).json({ error: 'Failed to save leads' });
  }
});

export default router;
