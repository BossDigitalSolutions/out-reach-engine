import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../index';
import { authenticate, AuthRequest } from '../middleware/auth';
import { searchBusinesses } from '../services/googlePlaces';
import { scrapeWebsite } from '../services/websiteScraper';
import { calculateScore } from '../services/scoring';
import { decryptField } from '../services/encryption';
import { classifyZaPhone, zaPhoneForStorage } from '../services/phoneUtils';

const router = Router();
router.use(authenticate);

const scraperLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many scrape requests, please wait a minute.' },
});

// A run is a list of (category × location) pairs — no vertical is assumed.
// e.g. [{ category: 'plumbers', location: 'Durbanville' }, ...]
const searchSchema = z.object({
  pairs: z
    .array(
      z.object({
        category: z.string().min(1),
        location: z.string().min(1),
      })
    )
    .min(1)
    .max(50),
  maxResults: z.number().min(1).max(60).optional().default(20),
});

// A Places "website" that is just a Facebook/Instagram page counts as NO website.
const SOCIAL_HOSTS = ['facebook.com', 'fb.com', 'fb.me', 'instagram.com', 'instagr.am'];
function isRealWebsite(url?: string | null): boolean {
  if (!url || url.trim().length === 0) return false;
  const lower = url.toLowerCase();
  return !SOCIAL_HOSTS.some((host) => lower.includes(host));
}

// ─── CSV helpers ────────────────────────────────────────────────────────────
const CSV_COLUMNS = ['business_name', 'phone', 'business_type', 'location', 'status'] as const;

function csvField(value: string): string {
  const s = value ?? '';
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Array<Record<(typeof CSV_COLUMNS)[number], string>>): string {
  const lines = [CSV_COLUMNS.join(',')];
  for (const row of rows) {
    lines.push(CSV_COLUMNS.map((col) => csvField(row[col])).join(','));
  }
  // Prepend a UTF-8 BOM so Excel/Sheets read accented SA business names correctly.
  return '﻿' + lines.join('\r\n');
}

// POST /api/scraper/search
// Runs each (category × location) pair through Google Places, keeps only
// businesses with NO website (a Facebook/Instagram link counts as no website),
// validates phones (kept, never dropped — see classifyZaPhone), dedupes by phone
// within the run, and streams back a CSV the browser downloads.
// No GHL push and no messaging — the CSV is imported into GHL manually.
router.post('/search', scraperLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { pairs, maxResults } = searchSchema.parse(req.body);

    const settings = await prisma.settings.findUnique({
      where: { userId: req.user!.userId },
    });

    const apiKey = decryptField(settings?.googleApiKey) || process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'Google Places API key not configured. Add it in Settings.',
      });
    }

    const rows: Array<Record<(typeof CSV_COLUMNS)[number], string>> = [];
    const seenPhones = new Set<string>();
    const skippedNoPhone: string[] = [];
    let skippedHasWebsite = 0;

    for (const { category, location } of pairs) {
      const results = await searchBusinesses(category, location, apiKey, maxResults);

      for (const r of results) {
        // Only businesses with no website (social-only counts as no website).
        if (isRealWebsite(r.websiteUrl)) {
          skippedHasWebsite++;
          continue;
        }

        // No phone at all → exclude from CSV, but log it.
        const phone = classifyZaPhone(r.phone);
        if (!phone) {
          skippedNoPhone.push(`${r.businessName} — ${category} / ${location}`);
          continue;
        }

        // Dedupe on phone within the run.
        if (seenPhones.has(phone.e164)) continue;
        seenPhones.add(phone.e164);

        rows.push({
          business_name: r.businessName,
          phone: phone.e164,
          business_type: category,
          location,
          status: phone.status,
        });
      }
    }

    if (skippedNoPhone.length > 0) {
      console.log(
        `[scraper] Excluded ${skippedNoPhone.length} business(es) with no phone number:`
      );
      for (const name of skippedNoPhone) console.log(`  - ${name}`);
    }
    console.log(
      `[scraper] CSV export: ${rows.length} rows ` +
        `(${skippedHasWebsite} skipped: has website, ${skippedNoPhone.length} skipped: no phone)`
    );

    const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="leads-${stamp}.csv"`);
    res.send(toCsv(rows));
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
      data: newLeads.map((lead) => {
        // SA-only tool → classify as ZA (+27). normalizePhone would default to UK.
        const za = zaPhoneForStorage(lead.phone);
        return {
          ...lead,
          phone: za.phone || lead.phone || null,
          phoneMobile: za.mobile,
          googleRating: lead.googleRating ?? null,
          reviewCount: lead.reviewCount ?? null,
          userId: req.user!.userId,
        };
      }),
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
