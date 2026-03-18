import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Search,
  Save,
  Globe,
  Star,
  Phone,
  MapPin,
  AlertCircle,
  CheckSquare,
  Square,
  Filter,
  Flame,
  TrendingUp,
  Minus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { scraperApi } from '../lib/api';
import { INDUSTRIES } from '../lib/utils';

interface ScrapedLead {
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
  selected?: boolean;
}

export default function Scraper() {
  const [industry, setIndustry] = useState('');
  const [customIndustry, setCustomIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [maxResults, setMaxResults] = useState(20);
  const [results, setResults] = useState<ScrapedLead[]>([]);
  const [noWebsiteOnly, setNoWebsiteOnly] = useState(false);

  // Calculate a pre-enrichment "opportunity score" from Google Places data alone
  function getOpportunityLevel(lead: ScrapedLead): { level: 'hot' | 'high' | 'medium' | 'low'; label: string; rank: number } {
    if (!lead.hasWebsite) return { level: 'hot', label: 'No website', rank: 0 };
    const rating = lead.googleRating ?? 5;
    if (rating < 3.5) return { level: 'high', label: 'Low rating', rank: 1 };
    if (rating < 4.2) return { level: 'medium', label: 'Average rating', rank: 2 };
    return { level: 'low', label: 'Established', rank: 3 };
  }

  const searchMutation = useMutation({
    mutationFn: () =>
      scraperApi
        .search(customIndustry || industry, location, maxResults)
        .then((r) => r.data),
    onSuccess: (data) => {
      // Sort by opportunity: no website > low rating > average > established
      const sorted = (data.results as ScrapedLead[])
        .map((r) => ({ ...r, selected: false }))
        .sort((a, b) => getOpportunityLevel(a).rank - getOpportunityLevel(b).rank);
      setResults(sorted);
      toast.success(`Found ${data.count} businesses — sorted by opportunity`);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Scrape failed';
      toast.error(msg);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (leads: ScrapedLead[]) =>
      scraperApi.save(leads).then((r) => r.data),
    onSuccess: (data) => {
      toast.success(`Saved ${data.saved} leads${data.skipped ? ` (${data.skipped} duplicates skipped)` : ''}`);
      setResults((prev) => prev.map((r) => ({ ...r, selected: false })));
    },
    onError: () => toast.error('Failed to save leads'),
  });

  const filtered = noWebsiteOnly ? results.filter((r) => !r.hasWebsite) : results;
  const selectedCount = filtered.filter((r) => r.selected).length;
  const allSelected = filtered.length > 0 && filtered.every((r) => r.selected);

  const toggleAll = () => {
    const ids = new Set(filtered.map((r) => r.placeId));
    setResults((prev) =>
      prev.map((r) => (ids.has(r.placeId) ? { ...r, selected: !allSelected } : r))
    );
  };

  const toggleOne = (placeId: string) => {
    setResults((prev) =>
      prev.map((r) => (r.placeId === placeId ? { ...r, selected: !r.selected } : r))
    );
  };

  const saveSelected = () => {
    const selected = results.filter((r) => r.selected);
    if (!selected.length) return toast.error('Select at least one lead');
    saveMutation.mutate(selected);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Lead Scraper</h1>
        <p className="text-slate-400 text-sm mt-1">
          Search for businesses using Google Places API
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
                setCustomIndustry('');
              }}
            >
              <option value="">Select industry...</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
              <option value="custom">Custom...</option>
            </select>
          </div>

          {industry === 'custom' && (
            <div>
              <label className="label">Custom Industry</label>
              <input
                type="text"
                className="input"
                placeholder="e.g., Thai restaurant"
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
              placeholder="City, State or Zip"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Max Results</label>
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
            onClick={() => searchMutation.mutate()}
            disabled={searchMutation.isPending || (!industry && !customIndustry) || !location}
          >
            {searchMutation.isPending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search size={16} />
                Search Businesses
              </>
            )}
          </button>

          {results.length > 0 && (
            <>
              <button
                className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors ${
                  noWebsiteOnly
                    ? 'bg-orange-600/20 border-orange-500/50 text-orange-300'
                    : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
                onClick={() => setNoWebsiteOnly((v) => !v)}
              >
                <Filter size={14} />
                No Website Only
                {noWebsiteOnly && (
                  <span className="ml-1 bg-orange-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {results.filter((r) => !r.hasWebsite).length}
                  </span>
                )}
              </button>

              {selectedCount > 0 && (
                <button
                  className="btn-primary flex items-center gap-2"
                  onClick={saveSelected}
                  disabled={saveMutation.isPending}
                >
                  <Save size={16} />
                  Save {selectedCount} Lead{selectedCount !== 1 ? 's' : ''}
                </button>
              )}
            </>
          )}
        </div>

        {searchMutation.isPending && (
          <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-800 rounded-lg px-4 py-3">
            <AlertCircle size={16} className="text-yellow-400 flex-shrink-0" />
            Fetching details for each business... this may take 30–60 seconds for large searches.
          </div>
        )}
      </div>

      {/* Auto-enrichment notice */}
      {results.length > 0 && (
        <div className="flex items-start gap-2 bg-purple-900/20 border border-purple-800/50 rounded-lg px-4 py-3 text-sm text-purple-300">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>
            <strong>Auto-enrichment on:</strong> After saving, leads with websites are automatically
            scraped for email addresses, owner names, services, and LinkedIn profiles.
            Use the <strong>✦ Enrich</strong> button on any lead to run it manually or re-run it.
          </span>
        </div>
      )}

      {/* Results Table */}
      {filtered.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <button onClick={toggleAll} className="text-slate-400 hover:text-slate-200">
                {allSelected ? (
                  <CheckSquare size={18} className="text-blue-400" />
                ) : (
                  <Square size={18} />
                )}
              </button>
              <span className="text-sm text-slate-400">
                {filtered.length} results
                {selectedCount > 0 && ` · ${selectedCount} selected`}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header w-10"></th>
                  <th className="table-header text-left w-8">Priority</th>
                  <th className="table-header text-left">Business</th>
                  <th className="table-header text-left">Location</th>
                  <th className="table-header text-left">Phone</th>
                  <th className="table-header text-left">Website</th>
                  <th className="table-header text-left">Rating</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => (
                  <tr key={lead.placeId} className="table-row">
                    <td className="table-cell">
                      <button
                        onClick={() => toggleOne(lead.placeId)}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        {lead.selected ? (
                          <CheckSquare size={16} className="text-blue-400" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </td>
                    <td className="table-cell">
                      {(() => {
                        const opp = getOpportunityLevel(lead);
                        if (opp.level === 'hot') return (
                          <span title="No website — highest opportunity" className="flex items-center gap-1 text-xs font-bold text-red-400">
                            <Flame size={13} />Hot
                          </span>
                        );
                        if (opp.level === 'high') return (
                          <span title="Low Google rating" className="flex items-center gap-1 text-xs font-bold text-orange-400">
                            <TrendingUp size={13} />High
                          </span>
                        );
                        if (opp.level === 'medium') return (
                          <span title="Average rating" className="flex items-center gap-1 text-xs text-yellow-400">
                            <TrendingUp size={13} />Mid
                          </span>
                        );
                        return (
                          <span title="Already established" className="flex items-center gap-1 text-xs text-slate-600">
                            <Minus size={13} />Low
                          </span>
                        );
                      })()}
                    </td>
                    <td className="table-cell">
                      <div>
                        <p className="font-medium text-slate-200">{lead.businessName}</p>
                        {lead.description && (
                          <p className="text-xs text-slate-500 mt-0.5 max-w-xs truncate">
                            {lead.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1 text-slate-400">
                        <MapPin size={12} />
                        <span className="text-xs">
                          {lead.city ? `${lead.city}${lead.state ? `, ${lead.state}` : ''}` : lead.address || '—'}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell">
                      {lead.phone ? (
                        <div className="flex items-center gap-1 text-slate-300 text-xs">
                          <Phone size={12} />
                          {lead.phone}
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="table-cell">
                      {lead.hasWebsite ? (
                        <a
                          href={lead.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs"
                        >
                          <Globe size={12} />
                          Has website
                        </a>
                      ) : (
                        <span className="badge bg-orange-900/50 text-orange-300 text-xs">
                          No website
                        </span>
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
