import axios from 'axios';

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  website?: string;
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  editorial_summary?: { overview: string };
  opening_hours?: { open_now: boolean };
}

interface SearchResult {
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

  let nextPageToken: string | undefined;
  let fetched = 0;

  do {
    const params: Record<string, string> = {
      query,
      key: apiKey,
    };
    if (nextPageToken) {
      params.pagetoken = nextPageToken;
      // Google requires a short delay before using page token
      await new Promise((r) => setTimeout(r, 2000));
    }

    const searchRes = await axios.get(
      'https://maps.googleapis.com/maps/api/place/textsearch/json',
      { params }
    );

    if (searchRes.data.status !== 'OK' && searchRes.data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Places API error: ${searchRes.data.status} - ${searchRes.data.error_message || ''}`);
    }

    const places: PlaceResult[] = searchRes.data.results || [];
    nextPageToken = searchRes.data.next_page_token;

    for (const place of places) {
      if (fetched >= maxResults) break;

      // Get place details
      const detailRes = await axios.get(
        'https://maps.googleapis.com/maps/api/place/details/json',
        {
          params: {
            place_id: place.place_id,
            fields:
              'name,formatted_phone_number,formatted_address,website,rating,user_ratings_total,types,editorial_summary,address_components',
            key: apiKey,
          },
        }
      );

      const detail: PlaceResult = detailRes.data.result || {};
      const addressComponents: Array<{ long_name: string; short_name: string; types: string[] }> =
        detailRes.data.result?.address_components || [];

      const city =
        addressComponents.find((c) => c.types.includes('locality'))?.long_name || '';
      const state =
        addressComponents.find((c) => c.types.includes('administrative_area_level_1'))
          ?.short_name || '';

      results.push({
        placeId: place.place_id,
        businessName: detail.name || place.name,
        address: detail.formatted_address || place.formatted_address || '',
        phone: detail.formatted_phone_number || '',
        websiteUrl: detail.website || '',
        hasWebsite: !!detail.website,
        googleRating: detail.rating ?? null,
        reviewCount: detail.user_ratings_total ?? null,
        industry,
        description: detail.editorial_summary?.overview || '',
        city,
        state,
      });

      fetched++;
      // Rate limiting: small delay between detail calls
      await new Promise((r) => setTimeout(r, 200));
    }
  } while (nextPageToken && fetched < maxResults);

  return results;
}
