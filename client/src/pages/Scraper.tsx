import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Search, Save, Download, Globe, Star, Phone, MapPin, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { scraperApi } from '../lib/api';

// SA-focused preset verticals for the scraper dropdown (plus a free-text "custom" entry).
// Defined locally on purpose — the shared INDUSTRIES list in lib/utils.ts is US/med-spa
// centric and is used by other pages (EmailTemplates, DemoLinks), so it's left untouched.
const SCRAPER_INDUSTRIES = [
  'plumbers', 'electricians', 'builders', 'painters', 'roofers', 'handyman services',
  'carpenters', 'tilers', 'paving contractors', 'garden services', 'pool maintenance',
  'pest control', 'locksmiths', 'security installers', 'HVAC', 'solar installers',
  'panel beaters', 'auto mechanics', 'tyre shops', 'car wash', 'auto electricians',
  'barbershops', 'hair salons', 'nail salons', 'beauty salons', 'spas', 'tattoo studios',
  'dentists', 'physiotherapists', 'chiropractors', 'optometrists', 'veterinary clinics',
  'gyms', 'personal trainers', 'yoga studios', 'pilates studios', 'martial arts',
  'accountants', 'bookkeepers', 'attorneys', 'financial advisors', 'estate agents',
  'insurance brokers', 'restaurants', 'cafés', 'coffee shops', 'bakeries', 'caterers',
  'guesthouses', 'photographers', 'event planners', 'dog groomers', 'cleaning services',
  'moving companies', 'driving schools', 'tutoring services',
] as const;

interface ScrapedLead {
  placeId: string;
  businessName: string;
  address: string;
  phone: string; // +27 E.164, or '' if the business has no phone
  phoneStatus: 'verified' | 'unverified' | 'none';
  websiteUrl: string;
  hasWebsite: boolean;
  googleRating: number | null;
  reviewCount: number | null;
  industry: string;
  description: string;
  city: string;
  state: string;
}

function csvField(v: string): string {
  const s = v ?? '';
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function Scraper() {
  const [industry, setIndustry] = useState('');
  const [customIndustry, setCustomIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [maxResults, setMaxResults] = useState(20);
  const [results, setResults] = useState<ScrapedLead[]>([]);

  const effectiveIndustry = (industry === 'custom' ? customIndustry : industry).trim();

  // Primary action: scrape Google Places, then save ALL results to the DB.
  const searchMutation = useMutation({
    mutationFn: async () => {
      const searchRes = await scraperApi.search(effectiveIndustry, location.trim(), maxResults);
      const scraped = (searchRes.data.results as ScrapedLead[]) || [];
      const saveRes = await scraperApi.save(scraped);
      return { scraped, save: saveRes.data };
    },
    onSuccess: ({ scraped, save }) => {
      setResults(scraped);
      const bits = [`Saved ${save.saved} lead${save.saved !== 1 ? 's' : ''}`];
      if (save.skippedDuplicate) bits.push(`${save.skippedDuplicate} duplicate${save.skippedDuplicate !== 1 ? 's' : ''} skipped`);
      if (save.skippedNoPhone) bits.push(`${save.skippedNoPhone} no-phone skipped`);
      toast.success(`${bits.join(' · ')} — see the Leads tab`);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Search failed';
      toast.error(msg);
    },
  });

  const runSearch = () => {
    if (!effectiveIndustry) return toast.error('Pick or type an industry');
    if (!location.trim()) return toast.error('Enter a location');
    searchMutation.mutate();
  };

  // Secondary/optional: export the current results to CSV (no extra scrape).
  const downloadCsv = () => {
    if (!results.length) return toast.error('Run a search first');
    const cols = ['business_name', 'phone', 'business_type', 'location', 'status', 'has_website'];
    const lines = [cols.join(',')];
    for (const r of results) {
      lines.push(
        [
          r.businessName,
          r.phone,
          r.industry || effectiveIndustry,
          location.trim(),
          r.phoneStatus,
          r.hasWebsite ? 'yes' : 'no',
        ]
          .map((v) => csvField(String(v ?? '')))
          .join(',')
      );
    }
    const csv = '﻿' + lines.join('\r\n'); // BOM for Excel/accented names
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Lead Scraper</h1>
        <p className="text-slate-400 text-sm mt-1">
          Search a vertical via Google Places. Results save straight to the Leads tab, where you can
          select them and Sync to GHL.
        </p>
      </div>

      {/* Search Form */}
      <div className="card space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="label">Industry</label>
            <select
              className="select w-full"
              value={industry}
              onChange={(e) => {
                setIndustry(e.target.value);
                if (e.target.value !== 'custom') setCustomIndustry('');
              }}
            >
              <option value="">Select industry...</option>
              {SCRAPER_INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
              <option value="custom">Custom...</option>
            </select>
          </div>

          {industry === 'custom' && (
            <div>
              <label className="label">Custom industry</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. windscreen repair"
                value={customIndustry}
                onChange={(e) => setCustomIndustry(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="label">Location</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Durbanville"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Max results</label>
            <select
              className="select w-full"
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={40}>40</option>
              <option value={60}>60 (slower)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            className="btn-primary flex items-center gap-2"
            onClick={runSearch}
            disabled={searchMutation.isPending || !effectiveIndustry || !location.trim()}
          >
            {searchMutation.isPending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Searching &amp; saving...
              </>
            ) : (
              <>
                <Search size={16} />
                Search &amp; Save to Leads
                <Save size={16} />
              </>
            )}
          </button>

          {results.length > 0 && (
            <button
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:border-slate-600 hover:text-slate-200 transition-colors"
              onClick={downloadCsv}
            >
              <Download size={14} />
              Download CSV
            </button>
          )}
        </div>

        {searchMutation.isPending && (
          <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-800 rounded-lg px-4 py-3">
            <AlertCircle size={16} className="text-yellow-400 flex-shrink-0" />
            Fetching details for each business... this may take 30–60 seconds for large searches.
          </div>
        )}
      </div>

      {/* Results — confirmation of what was saved */}
      {results.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 text-sm text-slate-400">
            {results.length} result{results.length !== 1 ? 's' : ''} from this search — saved to the{' '}
            <span className="text-slate-300 font-medium">Leads</span> tab (no-phone and duplicate-phone
            businesses skipped).
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header text-left">Business</th>
                  <th className="table-header text-left">Location</th>
                  <th className="table-header text-left">Phone</th>
                  <th className="table-header text-left">Website</th>
                  <th className="table-header text-left">Rating</th>
                </tr>
              </thead>
              <tbody>
                {results.map((lead) => (
                  <tr key={lead.placeId} className="table-row">
                    <td className="table-cell">
                      <p className="font-medium text-slate-200">{lead.businessName}</p>
                      {lead.description && (
                        <p className="text-xs text-slate-500 mt-0.5 max-w-xs truncate">{lead.description}</p>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1 text-slate-400 text-xs">
                        <MapPin size={12} />
                        {lead.city ? `${lead.city}${lead.state ? `, ${lead.state}` : ''}` : lead.address || '—'}
                      </div>
                    </td>
                    <td className="table-cell">
                      {lead.phone ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Phone size={12} className="text-slate-400" />
                          <span className="text-slate-300">{lead.phone}</span>
                          <span
                            className={`badge text-[10px] ${
                              lead.phoneStatus === 'verified'
                                ? 'bg-green-900/50 text-green-300'
                                : 'bg-slate-700 text-slate-400'
                            }`}
                          >
                            {lead.phoneStatus === 'verified' ? 'mobile' : 'unverified'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-orange-400 text-xs">no phone (skipped)</span>
                      )}
                    </td>
                    <td className="table-cell">
                      {lead.hasWebsite && lead.websiteUrl ? (
                        <a
                          href={lead.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs"
                        >
                          <Globe size={12} />
                          View site
                        </a>
                      ) : (
                        <span className="badge bg-orange-900/50 text-orange-300 text-xs">No website</span>
                      )}
                    </td>
                    <td className="table-cell">
                      {lead.googleRating ? (
                        <div className="flex items-center gap-1 text-yellow-400 text-xs">
                          <Star size={12} />
                          {lead.googleRating} ({lead.reviewCount})
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
