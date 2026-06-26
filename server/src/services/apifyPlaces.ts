import axios from 'axios';
import type { SearchResult } from './googlePlaces';

// ─── Apify — Google Maps scraper (compass/crawler-google-places) ─────────────
//
// Active lead data source, replacing the Google Places API to cut cost (Apify
// bills per place RETURNED). Returns the SAME SearchResult[] shape as
// googlePlaces.ts so everything downstream — ZA phone classification, the save
// path, placeId dedupe, and the GHL sync — is completely unchanged.
//
// Swap the actor by changing APIFY_ACTOR_ID; nothing else here is actor-specific.
const APIFY_ACTOR_ID = 'compass~crawler-google-places';

// run-sync-get-dataset-items runs the scrape and returns the dataset items array
// directly in one POST (no second fetch). It holds the connection up to 300s and
// returns HTTP 408 if that's exceeded.
const APIFY_RUN_SYNC_URL = `https://api.apify.com/v2/actors/${APIFY_ACTOR_ID}/run-sync-get-dataset-items`;

// Hard cost cap — Apify charges per place returned. The form's "Max results" is
// wired to maxCrawledPlacesPerSearch, but it is never allowed to exceed this, so a
// future form change can't blow up spend (the old Google source ran up $600/days).
const APIFY_MAX_PLACES_CAP = 100;

// Fields we read off each returned place. The actor returns many more (reviews,
// images, opening hours, …); only the ones the leads use are mapped here.
interface ApifyPlace {
  placeId?: string;
  title?: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  phoneUnformatted?: string;
  website?: string;
  totalScore?: number;
  reviewsCount?: number;
  categoryName?: string;
}

// Mirrors searchBusinesses() in googlePlaces.ts — same signature, same return shape.
export async function searchBusinessesApify(
  industry: string,
  location: string,
  apiToken: string,
  maxResults = 20
): Promise<SearchResult[]> {
  const cap = Math.min(maxResults, APIFY_MAX_PLACES_CAP);

  const input = {
    searchStringsArray: [industry],
    locationQuery: location,
    maxCrawledPlacesPerSearch: cap, // cost cap — wired to the form's "Max results"
    language: 'en',
    maxImages: 0,
    maxReviews: 0,
    // Native source-side no-website filter is available as
    // website: 'withoutWebsite' (enum: allPlaces | withWebsite | withoutWebsite).
    // Intentionally left at the actor default so ALL businesses are returned and the
    // UI sorts no-website ones to the top, exactly as before. Set it to
    // 'withoutWebsite' here to scrape only businesses that have no website.
  };

  let items: ApifyPlace[];
  try {
    const res = await axios.post<ApifyPlace[]>(APIFY_RUN_SYNC_URL, input, {
      headers: {
        // Token goes in the header, never the URL.
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      // The sync endpoint holds up to 300s; allow a little beyond so we receive its
      // 408 instead of aborting the request ourselves first.
      timeout: 310_000,
    });
    items = Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    const status = (err as { response?: { status?: number } }).response?.status;
    if (status === 408 || (err as { code?: string }).code === 'ECONNABORTED') {
      throw new Error(
        'Apify scrape timed out (300s limit). Try a smaller area or fewer results.'
      );
    }
    const apiMsg = (err as { response?: { data?: { error?: { message?: string } } } }).response
      ?.data?.error?.message;
    throw new Error(`Apify scrape failed${apiMsg ? `: ${apiMsg}` : ''}`);
  }

  return items.slice(0, cap).map((place) => {
    const website = place.website || '';
    // phone falls back to phoneUnformatted; classifyZaPhone (in the route) normalizes
    // either form to +27 E.164.
    const phone = place.phone || place.phoneUnformatted || '';
    return {
      placeId: place.placeId || '',
      businessName: place.title || '',
      address: place.address || '',
      phone,
      websiteUrl: website,
      hasWebsite: !!website,
      googleRating: place.totalScore ?? null,
      reviewCount: place.reviewsCount ?? null,
      industry, // store the searched term, matching the Google path (not categoryName)
      description: '', // base actor output has no editorial summary — leads stay description-less here, as the GHL/UI paths already tolerate
      city: place.city || '',
      state: place.state || '',
    };
  });
}
