import { Lead, Settings } from '@prisma/client';

const DEFAULT_INDUSTRY_WEIGHTS: Record<string, number> = {
  'restaurants': 20,
  'gyms': 20,
  'salons': 20,
  'barbershops': 20,
  'dental': 25,
  'dentists': 25,
  'contractors': 25,
  'home services': 25,
  'real estate': 15,
  'auto repair': 20,
  'auto': 20,
};

function normalizeIndustry(industry: string): string {
  return industry.toLowerCase().trim();
}

function getIndustryWeight(industry: string | null | undefined, weights: Record<string, number> | null): number {
  if (!industry) return 15;
  const norm = normalizeIndustry(industry);
  if (weights) {
    // Check for partial match in user-configured weights
    for (const [key, val] of Object.entries(weights)) {
      if (norm.includes(key.toLowerCase()) || key.toLowerCase().includes(norm)) {
        return Math.min(25, Math.max(0, val));
      }
    }
  }
  // Fallback to defaults
  for (const [key, val] of Object.entries(DEFAULT_INDUSTRY_WEIGHTS)) {
    if (norm.includes(key) || key.includes(norm)) {
      return val;
    }
  }
  return 15;
}

export function calculateScore(
  lead: Pick<Lead, 'hasWebsite' | 'googleRating' | 'reviewCount' | 'industry'> & { websiteScore?: number | null },
  settings: Pick<Settings, 'industryWeights'> | null
): number {
  let score = 0;

  // No website: biggest signal they need help (+40)
  if (!lead.hasWebsite) {
    score += 40;
  } else if (lead.websiteScore != null) {
    // Has a website — but how bad is it?
    if (lead.websiteScore <= 3) score += 25;       // Critical: basically unusable
    else if (lead.websiteScore <= 5) score += 15;  // Poor: clear upgrade opportunity
    else if (lead.websiteScore <= 7) score += 6;   // Fair: some room to improve
    // 8–10 (Good): no bonus — already decent
  }

  // Google rating: lower = more room for improvement
  if (lead.googleRating !== null && lead.googleRating !== undefined) {
    if (lead.googleRating < 3.0) score += 15;
    else if (lead.googleRating < 3.5) score += 12;
    else if (lead.googleRating < 4.0) score += 8;
    else if (lead.googleRating < 4.5) score += 5;
    else score += 2;
  }

  // Review count: more reviews = more established = worth contacting
  if (lead.reviewCount !== null && lead.reviewCount !== undefined) {
    if (lead.reviewCount >= 50) score += 20;
    else if (lead.reviewCount >= 20) score += 15;
    else if (lead.reviewCount >= 5) score += 10;
    else if (lead.reviewCount >= 1) score += 5;
    else score += 2;
  }

  // Industry weight (0–25 based on user's success history)
  const weights = (settings?.industryWeights as Record<string, number> | null) ?? null;
  score += getIndustryWeight(lead.industry, weights);

  return Math.max(0, Math.min(100, score));
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'hot';
  if (score >= 60) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}
