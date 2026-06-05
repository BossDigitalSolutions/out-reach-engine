import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Search, Download, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { scraperApi } from '../lib/api';

interface Pair {
  category: string;
  location: string;
}

// Parse the textarea into (category, location) pairs.
// One pair per line as "category, location" (e.g. "plumbers, Durbanville").
// As a fallback, a line with no comma splits on the last space.
function parsePairs(text: string): Pair[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const comma = line.indexOf(',');
      if (comma !== -1) {
        return { category: line.slice(0, comma).trim(), location: line.slice(comma + 1).trim() };
      }
      const space = line.lastIndexOf(' ');
      if (space === -1) return { category: line, location: '' };
      return { category: line.slice(0, space).trim(), location: line.slice(space + 1).trim() };
    })
    .filter((p) => p.category && p.location);
}

// Pull "leads-YYYY-MM-DD.csv" out of the Content-Disposition header if present.
function filenameFromDisposition(disposition?: string): string {
  if (!disposition) return 'leads.csv';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  return match ? match[1] : 'leads.csv';
}

export default function Scraper() {
  const [pairsText, setPairsText] = useState('');
  const [maxResults, setMaxResults] = useState(20);

  const pairs = parsePairs(pairsText);

  const searchMutation = useMutation({
    mutationFn: async () => {
      const res = await scraperApi.search(pairs, maxResults);
      return res;
    },
    onSuccess: (res) => {
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filenameFromDisposition(res.headers['content-disposition']);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('CSV downloaded — import it into GHL contacts.');
    },
    onError: async (err: unknown) => {
      // Error responses come back as a Blob (responseType: 'blob'); read the JSON out.
      const data = (err as { response?: { data?: Blob } })?.response?.data;
      let msg = 'Scrape failed';
      try {
        if (data instanceof Blob) {
          const parsed = JSON.parse(await data.text());
          if (parsed?.error) msg = parsed.error;
        }
      } catch {
        // keep default message
      }
      toast.error(msg);
    },
  });

  const runSearch = () => {
    if (pairs.length === 0) {
      return toast.error('Add at least one line: "category, location"');
    }
    searchMutation.mutate();
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Lead Scraper</h1>
        <p className="text-slate-400 text-sm mt-1">
          Search any business vertical via Google Places and download a CSV of leads with no
          website. Import it into GHL contacts manually.
        </p>
      </div>

      {/* Search Form */}
      <div className="card space-y-4">
        <div>
          <label className="label">Searches — one per line, as “category, location”</label>
          <textarea
            className="input font-mono text-sm min-h-[140px]"
            placeholder={'plumbers, Durbanville\nhair salons, Bellville\npanel beaters, Brackenfell'}
            value={pairsText}
            onChange={(e) => setPairsText(e.target.value)}
          />
          <p className="text-xs text-slate-500 mt-1">
            {pairs.length > 0
              ? `${pairs.length} search${pairs.length !== 1 ? 'es' : ''} ready`
              : 'Each line runs as a separate Google Places search.'}
          </p>
        </div>

        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="label">Max Results / search</label>
            <select
              className="select"
              value={maxResults}
              onChange={(e) => setMaxResults(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={40}>40</option>
              <option value={60}>60 (slower)</option>
            </select>
          </div>

          <button
            className="btn-primary flex items-center gap-2"
            onClick={runSearch}
            disabled={searchMutation.isPending || pairs.length === 0}
          >
            {searchMutation.isPending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search size={16} />
                Search &amp; Download CSV
                <Download size={16} />
              </>
            )}
          </button>
        </div>

        {searchMutation.isPending && (
          <div className="flex items-center gap-2 text-sm text-slate-400 bg-slate-800 rounded-lg px-4 py-3">
            <AlertCircle size={16} className="text-yellow-400 flex-shrink-0" />
            Fetching details for each business across {pairs.length} search
            {pairs.length !== 1 ? 'es' : ''}... this may take a while for large runs.
          </div>
        )}
      </div>

      {/* What the CSV contains */}
      <div className="flex items-start gap-2 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-400">
        <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-blue-400" />
        <span>
          The CSV includes only businesses with <strong>no website</strong> (a Facebook/Instagram
          page counts as no website). Columns:{' '}
          <code className="text-slate-300">business_name, phone, business_type, location, status</code>.
          Phones are normalized to E.164 (+27…); <strong>status</strong> is{' '}
          <strong>verified</strong> for real SA mobiles (06x/07x/08x) and{' '}
          <strong>unverified</strong> for landlines, 086/087, or unparseable numbers (kept, not
          dropped). Rows are deduped by phone; businesses with no phone are excluded.
        </span>
      </div>
    </div>
  );
}
