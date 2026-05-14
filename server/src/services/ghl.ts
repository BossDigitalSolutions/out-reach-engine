import axios from 'axios';
import { toE164 } from './phoneUtils';

const GHL_BASE = 'https://services.leadconnectorhq.com';

// Shared axios instance with GHL headers
function ghlClient(apiKey: string) {
  return axios.create({
    baseURL: GHL_BASE,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
}

export interface GhlLeadData {
  businessName: string;
  ownerName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  industry?: string | null;
  websiteUrl?: string | null;
  googleRating?: number | null;
  description?: string | null;
  ghlContactId?: string | null;
}

// ─── Sync a lead as a GHL contact ────────────────────────────────────────────
// Creates the contact if new, updates it if ghlContactId already exists.
// Returns the GHL contact ID.

export async function syncContactToGhl(
  lead: GhlLeadData,
  apiKey: string,
  locationId: string
): Promise<string> {
  const client = ghlClient(apiKey);

  // Split businessName into first/last for GHL's name fields
  const nameParts = (lead.ownerName || lead.businessName).split(' ');
  const firstName = nameParts[0] || lead.businessName;
  const lastName = nameParts.slice(1).join(' ') || '';

  const payload: Record<string, unknown> = {
    locationId,
    firstName,
    lastName,
    name: lead.ownerName || lead.businessName,
    companyName: lead.businessName,
    source: 'OutreachEngine',
    tags: ['outreach-engine', lead.industry?.toLowerCase().replace(/\s+/g, '-')].filter(Boolean),
  };

  if (lead.email) payload.email = lead.email;
  if (lead.phone) payload.phone = toE164(lead.phone) || lead.phone;
  if (lead.address) payload.address1 = lead.address;
  if (lead.city) payload.city = lead.city;
  if (lead.state) payload.state = lead.state;
  if (lead.websiteUrl) payload.website = lead.websiteUrl;

  // Add useful custom fields GHL supports
  const customFields: Array<{ key: string; field_value: string }> = [];
  if (lead.industry) customFields.push({ key: 'industry', field_value: lead.industry });
  if (lead.googleRating) customFields.push({ key: 'google_rating', field_value: String(lead.googleRating) });
  if (lead.description) customFields.push({ key: 'description', field_value: lead.description.slice(0, 500) });
  if (customFields.length > 0) payload.customFields = customFields;

  // If we already have a GHL contact ID, update it
  if (lead.ghlContactId) {
    await client.put(`/contacts/${lead.ghlContactId}`, payload, {
      headers: { Version: '2021-07-28' },
    });
    return lead.ghlContactId;
  }

  // Check if contact already exists by email or phone to avoid duplicates
  if (lead.email || lead.phone) {
    const query = lead.email || lead.phone!;
    const searchRes = await client.get('/contacts/search', {
      params: { locationId, query },
      headers: { Version: '2021-07-28' },
    }).catch(() => null);

    const existing = searchRes?.data?.contacts?.[0];
    if (existing?.id) {
      // Update the existing contact
      await client.put(`/contacts/${existing.id}`, payload, {
        headers: { Version: '2021-07-28' },
      });
      return existing.id as string;
    }
  }

  // Create new contact
  const res = await client.post('/contacts/', payload, {
    headers: { Version: '2021-07-28' },
  });

  return res.data?.contact?.id as string;
}

// ─── Add tags to a GHL contact (non-destructive — keeps existing tags) ─────

export async function addGhlContactTags(
  contactId: string,
  tags: string[],
  apiKey: string
): Promise<void> {
  if (tags.length === 0) return;
  const client = ghlClient(apiKey);
  await client.post(
    `/contacts/${contactId}/tags`,
    { tags },
    { headers: { Version: '2021-07-28' } }
  );
}

// ─── Update a single custom field on a GHL contact ─────────────────────────

export async function updateGhlContactField(
  contactId: string,
  key: string,
  value: string,
  apiKey: string
): Promise<void> {
  const client = ghlClient(apiKey);
  await client.put(
    `/contacts/${contactId}`,
    { customFields: [{ key, field_value: value }] },
    { headers: { Version: '2021-07-28' } }
  );
}

// ─── Send a message via GHL conversation ─────────────────────────────────────
// type: 'WhatsApp' | 'Email' | 'SMS'

export async function sendGhlMessage(
  contactId: string,
  message: string,
  type: 'WhatsApp' | 'Email' | 'SMS',
  apiKey: string,
  locationId: string,
  subject?: string
): Promise<string> {
  const client = ghlClient(apiKey);

  const payload: Record<string, unknown> = {
    type,
    contactId,
    locationId,
    message,
  };

  if (type === 'Email' && subject) {
    payload.subject = subject;
    payload.html = message; // GHL email supports HTML
  }

  const res = await client.post('/conversations/messages', payload, {
    headers: { Version: '2021-04-15' },
  });

  return res.data?.messageId || res.data?.id || '';
}

// ─── Get a contact's conversation history from GHL ───────────────────────────

export async function getGhlConversations(
  contactId: string,
  apiKey: string,
  locationId: string
): Promise<Array<{ id: string; type: string; body: string; dateAdded: string; direction: string }>> {
  const client = ghlClient(apiKey);

  const res = await client.get('/conversations/search', {
    params: { locationId, contactId },
    headers: { Version: '2021-04-15' },
  }).catch(() => null);

  return res?.data?.conversations || [];
}

// ─── Get messages from a GHL conversation ────────────────────────────────────

export async function getGhlMessages(
  conversationId: string,
  apiKey: string
): Promise<Array<{ id: string; type: number; messageType: string; body: string; direction: string; status: string; dateAdded: string; contactId: string }>> {
  const client = ghlClient(apiKey);

  const res = await client.get(`/conversations/${conversationId}/messages`, {
    headers: { Version: '2021-04-15' },
  }).catch(() => null);

  return res?.data?.messages?.messages || res?.data?.messages || [];
}

// ─── Get recent inbound messages for a location ─────────────────────────────

export async function getGhlRecentConversations(
  apiKey: string,
  locationId: string
): Promise<Array<{ id: string; contactId: string; lastMessageDate: string; lastMessageType: string; lastMessageBody: string; lastMessageDirection: string }>> {
  const client = ghlClient(apiKey);

  const res = await client.get('/conversations/search', {
    params: { locationId, sortBy: 'last_message_date', sortOrder: 'desc', limit: 50 },
    headers: { Version: '2021-04-15' },
  }).catch(() => null);

  return res?.data?.conversations || [];
}
