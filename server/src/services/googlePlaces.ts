import axios from 'axios';

// ─── Google Places API (New) — Text Search ──────────────────────────────────
//
// Uses places.googleapis.com/v1/places:searchText. The legacy
// maps.googleapis.com/.../textsearch/json endpoint is deprecated for this project
// and its next_page_token pagination returns INVALID_REQUEST regardless of the
// 2s token delay, so it cannot be used for maxResults > 20.
//
// The New API returns phone (national + international) and website INLINE, so no
// per-place Details call is needed, and paginates via pageToken (valid immediately).

const SEARCH_TEXT_URL = 'https://places.googleapis.com/v1/places:searchText';

// Fields we need. NOTE: requesting contact/atmosphere fields (phone, website,
// rating) bills at the higher "Text Search (Advanced)" SKU — same data the old
// code paid for via Place Details, but in one call instead of N.
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.types',
  'places.editorialSummary',
  'places.addressComponents',
  'nextPageToken',
].join(',');

interface NewAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

interface NewPlace {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  editorialSummary?: { text?: string };
  addressComponents?: NewAddressComponent[];
}

export interface SearchResult {
  placeId: string;
  businessName: string;
  address: string;
  phone: string;
  websiteUrl: string;
  hasWebsite: boolean;
  googleRating: number | null;
  reviewCount: number | null;
  industry: string;
  description: string;
  city: string;
  state: string;
}

export async function searchBusinesses(
  industry: string,
  location: string,
  apiKey: string,
  maxResults = 20
): Promise<SearchResult[]> {
  const query = `${industry} in ${location}`;
  const results: SearchResult[] = [];

  const headers = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': FIELD_MASK,
  };

  let pageToken: string | undefined;

  do {
    // searchText returns max 20 per page. pageSize is ignored once pageToken is set,
    // so the first page's size governs subsequent pages.
    const body: Record<string, unknown> = {
      textQuery: query,
      pageSize: Math.min(20, maxResults),
    };
    if (pageToken) body.pageToken = pageToken;

    let data: { places?: NewPlace[]; nextPageToken?: string };
    try {
      const res = await axios.post(SEARCH_TEXT_URL, body, { headers });
      data = res.data;
    } catch (err) {
      // The New API returns { error: { code, message, status } } — surface it (unlike
      // the legacy endpoint, this message is populated, e.g. on quota/permission issues).
      const apiErr = (err as { response?: { data?: { error?: { status?: string; code?: number; message?: string } } } })
        .response?.data?.error;
      if (apiErr) {
        throw new Error(
          `Google Places API error: ${apiErr.status || apiErr.code} - ${apiErr.message || ''}`
        );
      }
      throw err;
    }

    const places = data.places || [];
    pageToken = data.nextPageToken;

    for (const place of places) {
      if (results.length >= maxResults) break;

      const components = place.addressComponents || [];
      const city = components.find((c) => c.types?.includes('locality'))?.longText || '';
      const state =
        components.find((c) => c.types?.includes('administrative_area_level_1'))?.shortText || '';
      const websiteUrl = place.websiteUri || '';

      results.push({
        placeId: place.id,
        businessName: place.displayName?.text || '',
        address: place.formattedAddress || '',
        // internationalPhoneNumber is already +27…; classifyZaPhone normalizes either form.
        phone: place.internationalPhoneNumber || place.nationalPhoneNumber || '',
        websiteUrl,
        hasWebsite: !!websiteUrl,
        googleRating: place.rating ?? null,
        reviewCount: place.userRatingCount ?? null,
        industry,
        description: place.editorialSummary?.text || '',
        city,
        state,
      });
    }
  } while (pageToken && results.length < maxResults);

  return results;
}
