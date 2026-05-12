import axios from 'axios';

const FIRECRAWL_BASE = 'https://api.firecrawl.dev/v1';
const PAGE_CHAR_CAP = 8000;
const MAX_PAGES_PER_SITE = 4;

export class FirecrawlError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'FirecrawlError';
  }
}

interface ScrapeResponse {
  success: boolean;
  data?: {
    markdown?: string;
    metadata?: { title?: string; url?: string };
  };
  error?: string;
}

async function scrapeSinglePage(url: string, apiKey: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await axios.post<ScrapeResponse>(
        `${FIRECRAWL_BASE}/scrape`,
        { url, formats: ['markdown'] },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );
      const md = res.data?.data?.markdown;
      if (!md) return '';
      return md.slice(0, PAGE_CHAR_CAP);
    } catch (err) {
      lastError = err;
      const status = (err as { response?: { status?: number } })?.response?.status;
      // Retry on 429 and 5xx; bail on other errors
      if (status === 429 || (status && status >= 500)) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      throw new FirecrawlError(
        `Firecrawl scrape failed: ${err instanceof Error ? err.message : 'unknown'}`,
        status
      );
    }
  }
  throw new FirecrawlError(
    `Firecrawl scrape failed after retry: ${lastError instanceof Error ? lastError.message : 'unknown'}`
  );
}

// ─── Scrape a website (homepage + likely sub-pages) ─────────────────────────
// Returns concatenated markdown. Throws FirecrawlError if nothing usable.

export async function scrapeWebsite(url: string, apiKey: string): Promise<string> {
  if (!url) throw new FirecrawlError('No URL provided');

  // Normalise URL
  let baseUrl = url.trim();
  if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
  baseUrl = baseUrl.replace(/\/$/, '');

  // Pages to try, in priority order
  const candidatePaths = ['', '/services', '/treatments', '/about'];
  const pages: string[] = [];

  for (const path of candidatePaths) {
    if (pages.length >= MAX_PAGES_PER_SITE) break;
    const fullUrl = `${baseUrl}${path}`;
    try {
      const md = await scrapeSinglePage(fullUrl, apiKey);
      if (md && md.length > 100) {
        pages.push(`# Page: ${fullUrl}\n\n${md}`);
      }
    } catch (err) {
      // 404 on sub-pages is fine, just skip
      const status = (err as FirecrawlError).status;
      if (status === 404 || status === 403) continue;
      // For homepage, propagate the error
      if (path === '') throw err;
    }
  }

  if (pages.length === 0) {
    throw new FirecrawlError('No usable content scraped from site');
  }

  return pages.join('\n\n---\n\n');
}
