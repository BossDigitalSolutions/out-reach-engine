import axios from 'axios';
import * as cheerio from 'cheerio';

export interface WebsiteQuality {
  score: number;            // 1–10 (1 = terrible, 10 = excellent)
  urgency: 'critical' | 'poor' | 'fair' | 'good';
  issues: string[];         // human-readable list of problems found
}

export interface WebsiteData {
  emails: string[];           // ranked best-first
  allEmailsFound: string[];   // every candidate found (for UI display/selection)
  ownerName?: string;
  ownerTitle?: string;
  linkedinUrl?: string;
  services: string[];
  aboutText?: string;
  quality?: WebsiteQuality;
  enrichedAt: string;
}

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT = 9000;

// ─── Email filters ────────────────────────────────────────────────────────────

// These prefixes are always system/automated — never a real person's contact email
const BLOCKED_PREFIXES = new Set([
  'noreply', 'no-reply', 'donotreply', 'do-not-reply', 'no.reply',
  'postmaster', 'webmaster', 'mailer-daemon', 'mailer', 'mailerdaemon',
  'bounce', 'bounces', 'bounce-handler', 'bounce_handler',
  'admin', 'administrator', 'root', 'hostmaster', 'dns', 'abuse',
  'wordpress', 'wp', 'drupal', 'joomla', 'wix', 'squarespace', 'shopify',
  'notifications', 'notify', 'alerts', 'alert', 'notification',
  'newsletter', 'updates', 'digest', 'bulletins',
  'security', 'privacy', 'legal', 'compliance', 'gdpr',
  'careers', 'jobs', 'hr', 'hiring', 'recruitment',
  'unsubscribe', 'subscribe', 'list', 'listserv',
  'devnull', 'dev-null', 'blackhole', 'null', 'void',
  'system', 'automated', 'auto', 'autoresponder',
  'daemon', 'robot', 'bot',
]);

// Known third-party infrastructure domains — never the actual business email
const BLOCKED_DOMAINS = new Set([
  'sentry.io', 'sentry.com',
  'example.com', 'example.org', 'example.net', 'test.com',
  'mailchimp.com', 'mc.com', 'list-manage.com',
  'sendgrid.net', 'sendgrid.com',
  'mailgun.org', 'mailgun.net',
  'amazonaws.com', 'amazonses.com',
  'sparkpostmail.com', 'sparkpost.com',
  'postmarkapp.com', 'mandrillapp.com',
  'constantcontact.com',
  'hubspot.com', 'hubspotlinks.com',
  'salesforce.com', 'exacttarget.com',
  'zendesk.com', 'freshdesk.com',
  'intercom.io', 'intercom.com',
  'wordpress.com', 'wpengine.com',
  'godaddy.com', 'bluehost.com', 'hostgator.com',
  'cloudflare.com', 'fastly.net',
  'schema.org', 'w3.org',
  'google.com', 'googlemail.com', 'googleapis.com',
]);

// These prefixes are "outreach-friendly" — info@, hello@, contact@ etc.
const GOOD_PREFIXES = [
  'info', 'hello', 'contact', 'enquiries', 'enquiry', 'inquiry', 'inquiries',
  'sales', 'hi', 'hey', 'team', 'office', 'mail', 'email', 'general', 'main',
  'reach', 'connect', 'get-in-touch', 'getintouch', 'help', 'reception',
  'studio', 'clinic', 'shop', 'store', 'accounts',
];

// Nav/page items that are definitely not services
const NON_SERVICE_WORDS = new Set([
  'home', 'about', 'contact', 'blog', 'news', 'faq', 'privacy', 'terms',
  'login', 'signup', 'sign up', 'sign in', 'register', 'cart', 'checkout',
  'portfolio', 'gallery', 'testimonials', 'reviews', 'sitemap',
  'facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok',
  'back', 'next', 'prev', 'menu', 'more', 'less', 'read more', 'learn more',
  'click here', 'submit', 'send', 'get a quote', 'free quote', 'contact us',
]);

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cache-Control': 'no-cache',
      },
      timeout: FETCH_TIMEOUT,
      maxRedirects: 5,
      // Don't throw on 4xx — some sites return 404 for sub-pages but still have content
      validateStatus: (s) => s < 500,
    });
    if (typeof res.data !== 'string') return null;
    if (res.data.length < 100) return null; // Empty or redirect-only response
    return res.data;
  } catch {
    return null;
  }
}

// ─── Email extraction & ranking ───────────────────────────────────────────────

function getEmailDomain(email: string): string {
  return email.split('@')[1] || '';
}

function getEmailPrefix(email: string): string {
  return (email.split('@')[0] || '').toLowerCase();
}

function isStructurallyValid(email: string): boolean {
  if (!email || email.length > 100) return false;
  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) return false;

  const domain = getEmailDomain(email);
  // Must have at least one dot in domain
  if (!domain.includes('.')) return false;
  // Domain shouldn't start/end with hyphen
  if (domain.startsWith('-') || domain.endsWith('-')) return false;

  return true;
}

function isBlockedEmail(email: string): boolean {
  const prefix = getEmailPrefix(email);
  const domain = getEmailDomain(email);

  if (BLOCKED_DOMAINS.has(domain)) return true;
  if (BLOCKED_PREFIXES.has(prefix)) return true;

  // Block image/asset false positives
  const assetExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.css', '.js', '.woff', '.ttf', '.mp4', '.mp3'];
  if (assetExtensions.some((ext) => email.endsWith(ext))) return true;

  // Block clearly auto-generated patterns
  if (/^\d+@/.test(email)) return true; // starts with numbers only
  if (/@\d+\.\d+\.\d+/.test(email)) return true; // IP address domain

  return false;
}

function scoreEmail(email: string, websiteDomain?: string): number {
  if (isBlockedEmail(email)) return -1;

  let score = 10; // base score
  const prefix = getEmailPrefix(email);
  const domain = getEmailDomain(email);

  // +40 if from the same domain as the website (very strong signal)
  if (websiteDomain && domain === websiteDomain) score += 40;

  // +30 for a well-known good contact prefix
  if (GOOD_PREFIXES.includes(prefix)) score += 30;

  // +15 for a name-like prefix (firstname.lastname, firstname, etc.)
  if (/^[a-z]+\.[a-z]+$/.test(prefix) || /^[a-z]{3,12}$/.test(prefix)) score += 15;

  // -10 for very long prefixes (likely auto-generated)
  if (prefix.length > 20) score -= 10;

  // -20 for free email providers when we have other options
  const freeProviders = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com', 'icloud.com', 'aol.com'];
  if (freeProviders.includes(domain)) score -= 20;

  return score;
}

function extractWebsiteDomain(url: string): string {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    // Normalize: remove www. prefix for comparison
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function extractEmails(html: string, websiteDomain: string): string[] {
  const $ = cheerio.load(html);

  // Remove script, style, template tags — they cause false positives
  $('script, style, noscript, template, code, pre').remove();

  const emailScores = new Map<string, number>();

  // P1: mailto: links — most reliable, always intentional
  $('a[href^="mailto:"], a[href^="MAILTO:"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const raw = href.replace(/^mailto:/i, '').split(/[?&]/)[0].trim().toLowerCase();
    if (!raw || !isStructurallyValid(raw)) return;
    const score = scoreEmail(raw, websiteDomain);
    if (score > 0) {
      const existing = emailScores.get(raw) ?? 0;
      // mailto links get a +20 bonus over text-only finds
      emailScores.set(raw, Math.max(existing, score + 20));
    }
  });

  // P2: Text content scan — only on cleaned HTML (scripts removed)
  const bodyText = $('body').text();
  const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  let match;
  while ((match = emailRegex.exec(bodyText)) !== null) {
    const raw = match[0].toLowerCase();
    if (!isStructurallyValid(raw)) continue;
    const score = scoreEmail(raw, websiteDomain);
    if (score > 0 && !emailScores.has(raw)) {
      emailScores.set(raw, score);
    }
  }

  return Array.from(emailScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([email]) => email);
}

// ─── LinkedIn ────────────────────────────────────────────────────────────────

function extractLinkedIn(html: string): string | undefined {
  const $ = cheerio.load(html);
  let found: string | undefined;

  $('a[href*="linkedin.com"]').each((_, el) => {
    const href = ($(el).attr('href') || '').trim();
    if (href.includes('linkedin.com/in/') || href.includes('linkedin.com/company/')) {
      // Normalize URL
      found = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
      // Strip tracking params
      try {
        const u = new URL(found);
        found = u.origin + u.pathname;
      } catch {}
      return false;
    }
  });

  return found;
}

// ─── Owner info ───────────────────────────────────────────────────────────────

const OWNER_TITLES = [
  'owner', 'founder', 'co-founder', 'cofounder',
  'ceo', 'chief executive', 'president',
  'managing director', 'principal', 'proprietor', 'operator',
  'manager', 'general manager',
];

function extractOwnerInfo(html: string): { ownerName?: string; ownerTitle?: string } {
  const $ = cheerio.load(html);
  $('script, style, nav, footer').remove();

  // Try structured team/bio sections first
  const teamSelectors = [
    '[class*="team-member"]', '[class*="staff-member"]',
    '[class*="person"]', '[class*="bio"]',
    '[class*="about-us"] h3', '[class*="about-us"] h4',
    '[class*="owner"]', '[class*="founder"]',
  ];

  for (const selector of teamSelectors) {
    let found: { ownerName?: string; ownerTitle?: string } = {};
    $(selector).each((_, el) => {
      if (found.ownerName) return false;
      const text = $(el).text().trim();
      const lower = text.toLowerCase();
      for (const title of OWNER_TITLES) {
        if (lower.includes(title)) {
          const nameMatch = text.match(/^([A-Z][a-z]+(?: [A-Z]\.? ?)?[A-Z][a-z]+)/);
          if (nameMatch) {
            found = {
              ownerName: nameMatch[1].trim(),
              ownerTitle: title.charAt(0).toUpperCase() + title.slice(1),
            };
            return false;
          }
        }
      }
    });
    if (found.ownerName) return found;
  }

  // Fallback: regex on body text — look for "Name, Title" or "Name - Title" patterns
  const bodyText = $('body').text().replace(/\s+/g, ' ');
  const titlePattern = new RegExp(
    `([A-Z][a-z]+(?: [A-Z]\\.? ?)?[A-Z][a-z]+)[,\\s\\-–—]+(?:${OWNER_TITLES.join('|')})`,
    'i'
  );
  const m = titlePattern.exec(bodyText);
  if (m) {
    const rawTitle = m[0].replace(m[1], '').replace(/^[,\s\-–—]+/, '').trim();
    // Sanity check: name shouldn't be a common word or too long
    if (m[1].split(' ').length <= 3 && m[1].length < 40) {
      return {
        ownerName: m[1].trim(),
        ownerTitle: rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1),
      };
    }
  }

  return {};
}

// ─── Services ────────────────────────────────────────────────────────────────

function extractServices(html: string): string[] {
  const $ = cheerio.load(html);
  const candidates = new Set<string>();

  // Target service-specific sections, not nav
  const serviceSelectors = [
    '[class*="service"]:not(nav [class*="service"]) li',
    '[id*="service"] li',
    '[class*="offering"] li',
    '[class*="treatment"] li',
    '[class*="product"] li',
    '[class*="procedure"] li',
    '[class*="menu-item"]:not(.navigation *)',
    'section[class*="service"] p',
    '.services-grid li',
    '.service-list li',
    '.what-we-do li',
    '.what-we-offer li',
  ];

  for (const selector of serviceSelectors) {
    $(selector).each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      const lower = text.toLowerCase();

      if (!text || text.length < 3 || text.length > 80) return;
      if (/^\d+$/.test(text)) return; // pure number
      if (NON_SERVICE_WORDS.has(lower)) return;
      if (lower.includes('©') || lower.includes('copyright')) return;
      // Skip if it looks like a nav link (very short, common words)
      if (text.split(' ').length === 1 && NON_SERVICE_WORDS.has(lower)) return;

      candidates.add(text);
    });
    if (candidates.size >= 10) break;
  }

  return Array.from(candidates).slice(0, 8);
}

// ─── About text ───────────────────────────────────────────────────────────────

function extractAboutText(html: string): string | undefined {
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer').remove();

  const aboutSelectors = [
    '[class*="about"] p',
    '[id*="about"] p',
    '[class*="hero"] p',
    '[class*="intro"] p',
    '[class*="tagline"]',
    '.company-description p',
    '.about-text',
    'main p',
    'article p',
    'section p',
  ];

  for (const selector of aboutSelectors) {
    const el = $(selector).first();
    const text = el.text().trim().replace(/\s+/g, ' ');
    if (text.length > 50 && text.length < 600) return text;
  }

  // Fall back to first real paragraph
  let result: string | undefined;
  $('p').each((_, el) => {
    if (result) return false;
    const text = $(el).text().trim().replace(/\s+/g, ' ');
    if (text.length > 60 && text.length < 500) result = text;
  });

  return result;
}

// ─── Website quality analysis ────────────────────────────────────────────────

const DIY_BUILDERS: Array<{ pattern: string; label: string }> = [
  { pattern: 'wix.com', label: 'Built on Wix' },
  { pattern: 'wixsite.com', label: 'Built on Wix' },
  { pattern: 'weebly.com', label: 'Built on Weebly' },
  { pattern: 'jimdo.com', label: 'Built on Jimdo' },
  { pattern: 'yola.com', label: 'Built on Yola' },
  { pattern: 'website-builder.godaddy', label: 'GoDaddy Website Builder' },
  { pattern: 'godaddysites.com', label: 'GoDaddy Website Builder' },
  { pattern: 'websitebuilder.com', label: 'DIY website builder' },
  { pattern: 'site123.com', label: 'Built on SITE123' },
  { pattern: 'strikingly.com', label: 'Built on Strikingly' },
  { pattern: 'ucraft.com', label: 'Built on uCraft' },
];

export function analyzeWebsiteQuality(html: string, url: string): WebsiteQuality {
  const $ = cheerio.load(html);
  const issues: string[] = [];
  let deductions = 0;
  const rawHtml = html.toLowerCase();

  // ── Pre-count raw DOM elements before stripping scripts ──────────────────
  const tdCount = $('td').length;
  const fontTagCount = $('font').length;
  const marqueeCount = $('marquee, blink').length;
  const frameCount = $('frameset, frame').length;
  const inlineStyleCount = $('[style]').length;
  const bgcolorCount = $('[bgcolor]').length;
  const brCount = $('br').length;
  const h1Count = $('h1').length;
  const imgCount = $('img[src]:not([src=""])').length;
  const gifCount = $('img[src$=".gif"]').length;
  const externalScriptCount = $('script[src]').length;
  const hasFavicon = $('link[rel*="icon"]').length > 0;
  const hasViewport = $('meta[name="viewport"]').length > 0;
  const metaDesc = $('meta[name="description"]').attr('content')?.trim() || '';

  // Clean before extracting visible text
  $('script, style, noscript, template').remove();
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const textLength = bodyText.length;

  // ── 1. Completely dead technology ────────────────────────────────────────
  if (rawHtml.includes('application/x-shockwave-flash') || rawHtml.includes('.swf')) {
    issues.push('Uses Adobe Flash — no longer works in any browser');
    deductions += 4;
  }

  // ── 2. Ancient / pre-CSS HTML patterns ───────────────────────────────────
  if (frameCount > 0) {
    issues.push('Uses HTML frames — obsolete layout from the early 2000s');
    deductions += 3.5;
  }
  if (fontTagCount > 5) {
    issues.push('Uses <font> tags — pre-CSS design from the late 1990s');
    deductions += 3;
  }
  if (marqueeCount > 0) {
    issues.push('Uses <marquee>/<blink> tags — 1990s-era gimmick');
    deductions += 3;
  }
  if (bgcolorCount > 5) {
    issues.push('Uses bgcolor attributes for colour — HTML 3.2-era design');
    deductions += 1;
  }

  // ── 3. Not mobile-friendly (critical in 2024) ────────────────────────────
  if (!hasViewport) {
    issues.push('Not mobile-friendly — no viewport meta tag');
    deductions += 3;
  }

  // ── 4. Table-based layout (pre-CSS layout technique) ─────────────────────
  if (tdCount > 20) {
    issues.push('Table-based layout — design pattern from the early 2000s');
    deductions += 3;
  } else if (tdCount > 8) {
    issues.push('Heavy use of layout tables');
    deductions += 1.5;
  }

  // ── 5. Visual clutter — excessive inline styles ───────────────────────────
  // High count signals no CSS architecture: hand-coded, disorganised markup
  if (inlineStyleCount > 40) {
    issues.push('Heavily inline-styled — disorganised, hard-to-read layout');
    deductions += 2;
  } else if (inlineStyleCount > 20) {
    issues.push('Heavy inline styling — suggests messy, hand-coded layout');
    deductions += 1;
  }

  // ── 6. Visual clutter — image overload vs thin text ──────────────────────
  // Many images + little text = picture-farm / cluttered homepage
  if (imgCount > 25 && textLength < 1200) {
    issues.push('Image-heavy with little text — visually cluttered, hard to read');
    deductions += 2;
  } else if (imgCount > 15 && textLength < 700) {
    issues.push('Too many images relative to content');
    deductions += 1;
  }

  // ── 7. Animated GIFs ─────────────────────────────────────────────────────
  if (gifCount > 3) {
    issues.push('Multiple animated GIFs — visually distracting, dated look');
    deductions += 1.5;
  } else if (gifCount > 1) {
    issues.push('Uses animated GIFs');
    deductions += 0.75;
  }

  // ── 8. Line-break spam — old technique for faking spacing ────────────────
  if (brCount > 25) {
    issues.push('Overuses <br> tags for spacing — old design practice');
    deductions += 1;
  }

  // ── 9. No HTTPS ──────────────────────────────────────────────────────────
  if (!url.startsWith('https://')) {
    issues.push('No SSL certificate (HTTP only)');
    deductions += 2;
  }

  // ── 10. DIY website builder ───────────────────────────────────────────────
  for (const { pattern, label } of DIY_BUILDERS) {
    if (rawHtml.includes(pattern)) {
      issues.push(label);
      deductions += 2;
      break;
    }
  }

  // ── 11. Stale or old copyright year ───────────────────────────────────────
  const currentYear = new Date().getFullYear();
  $('footer, [class*="footer"]').each((_, el) => {
    const text = $(el).text();
    const match = text.match(/©\s*(\d{4})|copyright\s*(?:©)?\s*(\d{4})/i);
    if (match) {
      const year = parseInt(match[1] || match[2]);
      if (year && year <= currentYear - 5) {
        issues.push(`Copyright ${year} — site not updated in ${currentYear - year}+ years`);
        deductions += 2.5;
      } else if (year && year <= currentYear - 3) {
        issues.push(`Last updated around ${year}`);
        deductions += 1.5;
      }
    }
  });

  // ── 12. Content volume ────────────────────────────────────────────────────
  if (textLength < 300) {
    issues.push('Almost no content — looks abandoned or unfinished');
    deductions += 2.5;
  } else if (textLength < 700) {
    issues.push('Very thin content — site feels incomplete');
    deductions += 1.5;
  }

  // ── 13. No H1 heading ────────────────────────────────────────────────────
  if (h1Count === 0) {
    issues.push('No H1 heading — poor page structure and SEO');
    deductions += 1;
  }

  // ── 14. No contact info visible ───────────────────────────────────────────
  const hasPhone = /(\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})/.test(bodyText);
  const hasEmailOnPage = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(bodyText);
  if (!hasPhone && !hasEmailOnPage) {
    issues.push('No contact info visible on homepage');
    deductions += 1;
  }

  // ── 15. Missing meta description ─────────────────────────────────────────
  if (!metaDesc) {
    issues.push('Missing meta description (poor SEO)');
    deductions += 0.75;
  }

  // ── 16. No favicon ────────────────────────────────────────────────────────
  if (!hasFavicon) {
    issues.push('No favicon');
    deductions += 0.5;
  }

  // ── 17. No images at all ──────────────────────────────────────────────────
  if (imgCount === 0) {
    issues.push('No images — site looks bare and unfinished');
    deductions += 0.75;
  }

  // ── 18. Outdated jQuery ───────────────────────────────────────────────────
  if (/jquery[.\-]1\.[0-5]\./i.test(rawHtml)) {
    issues.push('Uses very outdated jQuery (v1.x)');
    deductions += 0.75;
  }

  // ── 19. Script bloat ──────────────────────────────────────────────────────
  if (externalScriptCount > 15) {
    issues.push('Too many external scripts — site likely loads slowly');
    deductions += 0.75;
  }

  const score = Math.max(1, Math.min(10, Math.round(10 - deductions)));

  let urgency: WebsiteQuality['urgency'];
  if (score <= 3) urgency = 'critical';
  else if (score <= 5) urgency = 'poor';
  else if (score <= 7) urgency = 'fair';
  else urgency = 'good';

  return { score, urgency, issues };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function scrapeWebsite(websiteUrl: string): Promise<WebsiteData> {
  let baseUrl = websiteUrl.trim();
  if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
  baseUrl = baseUrl.replace(/\/$/, '');

  const websiteDomain = extractWebsiteDomain(baseUrl);

  const result: WebsiteData = {
    emails: [],
    allEmailsFound: [],
    services: [],
    enrichedAt: new Date().toISOString(),
  };

  // Try https first, fall back to http
  let homeHtml = await fetchPage(baseUrl);
  if (!homeHtml && baseUrl.startsWith('https://')) {
    homeHtml = await fetchPage(baseUrl.replace('https://', 'http://'));
    if (homeHtml) baseUrl = baseUrl.replace('https://', 'http://');
  }
  if (!homeHtml) return result;

  // --- Homepage ---
  const homeEmails = extractEmails(homeHtml, websiteDomain);
  const allEmails = new Map<string, number>(homeEmails.map((e, i) => [e, homeEmails.length - i]));

  result.linkedinUrl = extractLinkedIn(homeHtml);
  const ownerInfo = extractOwnerInfo(homeHtml);
  if (ownerInfo.ownerName) {
    result.ownerName = ownerInfo.ownerName;
    result.ownerTitle = ownerInfo.ownerTitle;
  }
  result.services = extractServices(homeHtml);
  result.aboutText = extractAboutText(homeHtml);

  // Analyze website quality from the homepage
  result.quality = analyzeWebsiteQuality(homeHtml, baseUrl);

  // --- Sub-pages (contact, about, team) —  fetch only what we still need ---
  const subPages = ['/contact', '/contact-us', '/about', '/about-us', '/team', '/staff'];
  for (const path of subPages) {
    const stillNeedsEmail = allEmails.size === 0;
    const stillNeedsOwner = !result.ownerName;
    const stillNeedsLinkedIn = !result.linkedinUrl;
    if (!stillNeedsEmail && !stillNeedsOwner && !stillNeedsLinkedIn) break;

    const html = await fetchPage(baseUrl + path);
    if (!html) continue;

    const pageEmails = extractEmails(html, websiteDomain);
    for (let i = 0; i < pageEmails.length; i++) {
      const e = pageEmails[i];
      if (!allEmails.has(e)) allEmails.set(e, pageEmails.length - i);
    }

    if (!result.linkedinUrl) result.linkedinUrl = extractLinkedIn(html);

    if (!result.ownerName) {
      const info = extractOwnerInfo(html);
      if (info.ownerName) {
        result.ownerName = info.ownerName;
        result.ownerTitle = info.ownerTitle;
      }
    }

    if (!result.aboutText) result.aboutText = extractAboutText(html);
    if (result.services.length === 0) result.services = extractServices(html);
  }

  // Sort emails by score (higher = better) and populate result
  const sorted = Array.from(allEmails.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([email]) => email);

  result.emails = sorted.slice(0, 3);       // top 3 best emails
  result.allEmailsFound = sorted;            // all for UI display

  return result;
}
