import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { searchBusinesses, type SearchResult } from '../services/googlePlaces';
import { searchBusinessesApify } from '../services/apifyPlaces';
import { scrapeWebsite } from '../services/websiteScraper';
import { calculateScore } from '../services/scoring';
import { decryptField } from '../services/encryption';
import { classifyZaPhone, zaPhoneForStorage } from '../services/phoneUtils';

const router = Router();
router.use(authenticate);

// ─── Lead data source ────────────────────────────────────────────────────────
// Apify (compass/crawler-google-places) is the active scraper — far cheaper than
// the Google Places API, which once ran up a $600 bill in days. The Google
// integration (services/googlePlaces.ts + its API key) is kept intact as disabled
// dead-code fallback and ONLY runs if this constant is manually switched back to
// 'google'. This is deliberately NOT exposed in the UI — change it here, in code.
const SCRAPER_PROVIDER: 'apify' | 'google' = 'apify';

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
// Scrapes Google Places for (industry × location) and returns ALL results as JSON
// — no website filter. Phones are classified as ZA (+27 E.164) so the UI display
// and the saved leads agree. The UI saves these straight to the DB via /scraper/save.
router.post('/search', scraperLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { industry, location, maxResults } = searchSchema.parse(req.body);

    const settings = await prisma.settings.findUnique({
      where: { userId: req.user!.userId },
    });

    // Fetch from the active provider. Both return the identical SearchResult[] shape,
    // so everything below (phone classification, save, dedupe, GHL sync) is unchanged.
    let results: SearchResult[];
    if (SCRAPER_PROVIDER === 'apify') {
      const apifyToken = decryptField(settings?.apifyApiKey) || process.env.APIFY_TOKEN;
      if (!apifyToken) {
        return res.status(400).json({
          error: 'Apify API token not configured. Add it in Settings.',
        });
      }
      results = await searchBusinessesApify(industry, location, apifyToken, maxResults);
    } else {
      const apiKey = decryptField(settings?.googleApiKey) || process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: 'Google Places API key not configured. Add it in Settings.',
        });
      }
      results = await searchBusinesses(industry, location, apiKey, maxResults);
    }

    // Normalize phones to ZA (+27). classifyZaPhone never drops a number; businesses
    // with no phone keep an empty string here and are excluded at save time.
    const enriched = results.map((r) => {
      const za = classifyZaPhone(r.phone);
      return {
        ...r,
        phone: za ? za.e164 : '',
        phoneStatus: (za ? za.status : 'none') as 'verified' | 'unverified' | 'none',
      };
    });

    res.json({ results: enriched, count: enriched.length });
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

    // Classify phones as ZA (+27), exclude businesses with no phone, and dedupe by
    // phone within this batch. (SA-only tool — zaPhoneForStorage; normalizePhone
    // defaulted to UK.) ALL websites are kept — website status is persisted, not filtered.
    const seenPhones = new Set<string>();
    let skippedNoPhone = 0;
    let skippedDuplicatePhone = 0;
    const candidates: Array<{ lead: (typeof leads)[number]; phone: string; mobile: boolean | null }> = [];
    for (const lead of leads) {
      const za = zaPhoneForStorage(lead.phone);
      if (!za.phone) {
        skippedNoPhone++;
        continue;
      }
      if (seenPhones.has(za.phone)) {
        skippedDuplicatePhone++;
        continue;
      }
      seenPhones.add(za.phone);
      candidates.push({ lead, phone: za.phone, mobile: za.mobile });
    }

    // Avoid duplicates across runs by placeId.
    const existingPlaceIds = new Set(
      (
        await prisma.lead.findMany({
          where: {
            userId: req.user!.userId,
            placeId: { in: candidates.map((c) => c.lead.placeId).filter(Boolean) as string[] },
          },
          select: { placeId: true },
        })
      ).map((l) => l.placeId)
    );

    const newCandidates = candidates.filter(
      (c) => !c.lead.placeId || !existingPlaceIds.has(c.lead.placeId)
    );
    const skippedDuplicatePlace = candidates.length - newCandidates.length;

    const created = await prisma.lead.createMany({
      data: newCandidates.map(({ lead, phone, mobile }) => ({
        ...lead,
        phone,
        phoneMobile: mobile,
        googleRating: lead.googleRating ?? null,
        reviewCount: lead.reviewCount ?? null,
        userId: req.user!.userId,
      })),
    });

    const newLeads = newCandidates.map((c) => c.lead);
    const websiteLeadCount = newLeads.filter((l) => l.websiteUrl).length;

    res.status(201).json({
      saved: created.count,
      skipped: leads.length - created.count,
      skippedNoPhone,
      skippedDuplicate: skippedDuplicatePhone + skippedDuplicatePlace,
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
