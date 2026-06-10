import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Mail,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Globe,
  Star,
  Phone,
  Edit2,
  X,
  CheckSquare,
  Square,
  Clock,
  Send,
  Zap,
  BellOff,
  Bell,
  ArrowUpDown,
  Sparkles,
  Linkedin,
  MessageCircle,
  ExternalLink,
  Smartphone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { leadsApi, emailsApi, whatsAppApi, ghlApi, demosApi } from '../lib/api';
import api from '../lib/api';
import { getStatusColor, getStatusLabel, formatDate, LEAD_STATUSES } from '../lib/utils';

interface Lead {
  id: string;
  businessName: string;
  ownerName?: string;
  ownerTitle?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  industry?: string;
  websiteUrl?: string;
  hasWebsite: boolean;
  googleRating?: number;
  reviewCount?: number;
  description?: string;
  status: string;
  score?: number;
  followupsEnabled: boolean;
  linkedinUrl?: string;
  websiteScore?: number | null;
  websiteData?: {
    emails?: string[];
    allEmailsFound?: string[];
    services?: string[];
    aboutText?: string;
    enrichedAt?: string;
    quality?: { score: number; urgency: string; issues: string[] };
  } | null;
  ghlContactId?: string | null;
  customDemoLink?: string | null;
  phoneMobile?: boolean | null;
  businessType?: string | null;
  isQualifiedMedSpa?: boolean | null;
  qualifyingTreatmentsFound?: string[] | null;
  signatureTreatment?: string | null;
  enrichmentStatus?: string | null;
  market?: string | null;
  portal?: string | null;
  createdAt: string;
  _count: { emails: number; notes: number };
}

function ScoreBadge({ score }: { score?: number }) {
  if (score == null) return null;
  let cls = 'bg-slate-800 text-slate-400';
  let label = '';
  if (score >= 80) { cls = 'bg-green-900/50 text-green-300'; label = '🔥'; }
  else if (score >= 60) { cls = 'bg-blue-900/40 text-blue-300'; }
  else if (score >= 40) { cls = 'bg-yellow-900/40 text-yellow-300'; }
  else { cls = 'bg-slate-800 text-slate-500'; }
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold rounded-full px-2 py-0.5 ${cls}`}>
      {label}{score}
    </span>
  );
}

function WebsiteQualityBadge({ score, issues }: { score?: number | null; issues?: string[] }) {
  if (score == null) return null;
  let cls = '';
  let label = '';
  let urgency = '';
  if (score <= 3) { cls = 'bg-red-900/50 text-red-300 border-red-800/50'; label = `${score}/10`; urgency = 'Critical'; }
  else if (score <= 5) { cls = 'bg-orange-900/40 text-orange-300 border-orange-800/50'; label = `${score}/10`; urgency = 'Poor'; }
  else if (score <= 7) { cls = 'bg-yellow-900/40 text-yellow-300 border-yellow-800/50'; label = `${score}/10`; urgency = 'Fair'; }
  else { cls = 'bg-green-900/30 text-green-400 border-green-800/40'; label = `${score}/10`; urgency = 'Good'; }

  return (
    <div className="group relative inline-block">
      <span className={`inline-flex items-center gap-1 text-xs font-semibold rounded border px-1.5 py-0.5 cursor-default ${cls}`}>
        {urgency} · {label}
      </span>
      {issues && issues.length > 0 && (
        <div className="absolute left-0 top-full mt-1 z-50 w-60 bg-slate-900 border border-slate-700 rounded-lg p-2.5 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
          <p className="text-xs font-semibold text-slate-300 mb-1.5">Issues found:</p>
          <ul className="space-y-1">
            {issues.map((issue, i) => (
              <li key={i} className="text-xs text-slate-400 flex items-start gap-1.5">
                <span className="text-red-400 mt-0.5">•</span>{issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface GeneratedEmail {
  id: string;
  subject: string;
  body: string;
  lead: { businessName: string };
  locked?: boolean;
  source?: string;
  scheduledAt?: string | null;
  followupNumber?: number;
  leadId?: string;
}

const TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'bold', label: 'Bold' },
];

export default function Leads() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [hasWebsite, setHasWebsite] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [tone, setTone] = useState('professional');
  const [generatedEmails, setGeneratedEmails] = useState<GeneratedEmail[]>([]);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [editingEmail, setEditingEmail] = useState<GeneratedEmail | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [sendPerDay, setSendPerDay] = useState(30);
  const [minutesBetween, setMinutesBetween] = useState(5);
  const [sortBy, setSortBy] = useState('createdAt');
  const [industryFilter, setIndustryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [enrichingIds, setEnrichingIds] = useState<Set<string>>(new Set());
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [whatsAppLead, setWhatsAppLead] = useState<Lead | null>(null);
  const [smsLead, setSmsLead] = useState<Lead | null>(null);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [generatedSms, setGeneratedSms] = useState<Array<{ leadId: string; businessName: string; phone: string; message: string }>>([]);
  const [selectedDemoId, setSelectedDemoId] = useState('');
  const [showSequenceModal, setShowSequenceModal] = useState(false);
  const [sequenceResults, setSequenceResults] = useState<{
    started: number; failed: number;
    results: Array<{ leadId: string; businessName: string; sequenceId: string; message1: string; message2: string; message3: string }>;
    errors: Array<{ leadId: string; businessName: string; error: string; missing?: string[] }>;
  } | null>(null);

  const { data: industriesData } = useQuery({
    queryKey: ['lead-industries'],
    queryFn: () => leadsApi.getIndustries().then((r) => r.data),
  });
  const industries: string[] = industriesData || [];

  const { data: locationsData } = useQuery({
    queryKey: ['lead-locations'],
    queryFn: () => leadsApi.getLocations().then((r) => r.data),
  });
  const locations: string[] = locationsData || [];

  const { data: demosData } = useQuery({
    queryKey: ['demos'],
    queryFn: () => demosApi.list().then((r) => r.data),
  });
  const demos: { id: string; label: string; industry: string }[] = demosData || [];

  const { data, isLoading } = useQuery({
    queryKey: ['leads', page, search, status, hasWebsite, sortBy, industryFilter, locationFilter],
    queryFn: () =>
      leadsApi
        .list({
          page,
          limit: 50,
          search: search || undefined,
          status: status !== 'ALL' ? status : undefined,
          hasWebsite: hasWebsite !== '' ? hasWebsite : undefined,
          sortBy,
          industry: industryFilter || undefined,
          location: locationFilter || undefined,
        })
        .then((r) => r.data),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      leadsApi.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      ids.length === 1 ? leadsApi.delete(ids[0]) : leadsApi.bulkDelete(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      setSelected(new Set());
      toast.success('Lead(s) deleted');
    },
    onError: () => toast.error('Failed to delete'),
  });

  const updateLeadMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      leadsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      setEditingLead(null);
      toast.success('Lead updated');
    },
    onError: () => toast.error('Failed to update lead'),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      emailsApi.generate(Array.from(selected), tone, selectedDemoId || undefined).then((r) => r.data),
    onSuccess: (data: { generated: GeneratedEmail[]; skipped: Array<{ leadId: string; businessName: string; reason: string }> } | GeneratedEmail[]) => {
      // Backwards-compat: server may return array (old) or { generated, skipped } (new)
      const emails = Array.isArray(data) ? data : data.generated;
      const skipped = Array.isArray(data) ? [] : (data.skipped || []);
      setGeneratedEmails(emails);
      setShowEmailModal(true);
      const reCount = emails.filter((e) => (e as GeneratedEmail).source === 'real_estate_locked_templates').length;
      const medCount = emails.filter((e) => (e as GeneratedEmail).source === 'med_spa_locked_templates').length;
      const lockedCount = reCount + medCount;
      if (lockedCount > 0) {
        const lockedParts: string[] = [];
        if (reCount > 0) lockedParts.push(`${reCount} real estate locked`);
        if (medCount > 0) lockedParts.push(`${medCount} med spa locked`);
        toast.success(`Generated ${emails.length} email${emails.length !== 1 ? 's' : ''} (${lockedParts.join(', ')})`);
      } else {
        toast.success(`Generated ${emails.length} email${emails.length !== 1 ? 's' : ''}`);
      }
      if (skipped.length > 0) {
        toast.error(`Skipped ${skipped.length}: ${skipped.map(s => `${s.businessName} (${s.reason})`).join(', ')}`, { duration: 8000 });
      }
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Generation failed';
      toast.error(msg);
    },
  });

  const generateSmsMutation = useMutation({
    mutationFn: () =>
      ghlApi.generateSmsBulk(Array.from(selected)).then((r) => r.data),
    onSuccess: (data: { generated: Array<{ leadId: string; businessName: string; phone: string; message: string }>; errors: Array<{ leadId: string; error: string }> }) => {
      setGeneratedSms(data.generated);
      setShowSmsModal(true);
      if (data.errors.length > 0) {
        toast.error(`${data.errors.length} lead(s) skipped (no phone or generation failed)`);
      }
      if (data.generated.length > 0) {
        toast.success(`Generated ${data.generated.length} SMS message${data.generated.length !== 1 ? 's' : ''}`);
      }
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'SMS generation failed';
      toast.error(msg);
    },
  });

  const startSequenceMutation = useMutation({
    mutationFn: () =>
      ghlApi.startSequence(Array.from(selected)).then((r) => r.data),
    onSuccess: (data: {
      started: number; failed: number;
      results: Array<{ leadId: string; businessName: string; sequenceId: string; message1: string; message2: string; message3: string }>;
      errors: Array<{ leadId: string; businessName: string; error: string; missing?: string[] }>;
    }) => {
      setSequenceResults(data);
      setShowSequenceModal(true);
      if (data.failed > 0) toast.error(`${data.failed} lead(s) could not start — see details`);
      if (data.started > 0) toast.success(`Started ${data.started} SMS sequence${data.started !== 1 ? 's' : ''}`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string }; status?: number }; message?: string };
      const msg = axiosErr?.response?.data?.error || axiosErr?.message || 'Failed to start sequences';
      toast.error(msg);
    },
  });

  const enrichMedSpaMutation = useMutation({
    mutationFn: () =>
      leadsApi.enrichMedSpa(Array.from(selected)).then((r) => r.data),
    onSuccess: (data: {
      total_processed: number;
      enriched_successfully: number;
      queued_for_send: number;
      no_email: number;
      no_website: number;
      scrape_failed: number;
      parse_failed: number;
    }) => {
      toast.success(
        `Enriched ${data.enriched_successfully}/${data.total_processed} · ${data.queued_for_send} ready to send · ${data.no_email} no email · ${data.scrape_failed + data.parse_failed} failed`,
        { duration: 8000 }
      );
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
      const msg = axiosErr?.response?.data?.error || axiosErr?.message || 'Med spa enrichment failed';
      toast.error(msg);
    },
  });

  const saveEmailMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      emailsApi.update(id, data),
  });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      // Med spa locked emails already have scheduledAt — use their existing time.
      // Non-locked emails use the user's date + cadence settings via scheduleBatch.
      const locked = generatedEmails.filter((e) => e.locked && e.scheduledAt);
      const unlocked = generatedEmails.filter((e) => !e.locked);

      let scheduled = 0;
      if (locked.length > 0) {
        for (const email of locked) {
          if (!email.scheduledAt) continue;
          await emailsApi.schedule(email.id, email.scheduledAt);
          scheduled++;
        }
      }
      if (unlocked.length > 0) {
        const emailIds = unlocked.map((e) => e.id);
        const r = await emailsApi
          .scheduleBatch(emailIds, scheduleDate || new Date().toISOString(), sendPerDay, minutesBetween)
          .then((r) => r.data);
        scheduled += r.scheduled || 0;
      }
      return { scheduled };
    },
    onSuccess: (data) => {
      toast.success(`Scheduled ${data.scheduled} emails`);
      setShowEmailModal(false);
      setGeneratedEmails([]);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: () => toast.error('Failed to schedule'),
  });

  const enrichLead = async (lead: Lead) => {
    if (!lead.hasWebsite || !lead.websiteUrl) {
      return toast.error('Lead needs a website URL to enrich');
    }
    setEnrichingIds((s) => new Set(s).add(lead.id));
    try {
      const res = await leadsApi.enrich(lead.id);
      const { enriched } = res.data;
      const parts: string[] = [];
      if (enriched.websiteQuality) {
        const q = enriched.websiteQuality;
        parts.push(`Website: ${q.urgency} (${q.score}/10)`);
      }
      if (enriched.allEmailsFound?.length > 0)
        parts.push(`${enriched.allEmailsFound.length} email${enriched.allEmailsFound.length > 1 ? 's' : ''} found`);
      if (enriched.ownerFound) parts.push('owner info');
      if (enriched.linkedinFound) parts.push('LinkedIn');
      if (enriched.servicesFound > 0) parts.push(`${enriched.servicesFound} services`);
      toast.success(
        parts.length > 0
          ? `Enriched — ${parts.join(' · ')}`
          : 'Scraped (no new data found on this site)',
        { duration: 5000 }
      );
      qc.invalidateQueries({ queryKey: ['leads'] });
    } catch {
      toast.error('Enrichment failed — site may be blocking scrapers');
    } finally {
      setEnrichingIds((s) => {
        const next = new Set(s);
        next.delete(lead.id);
        return next;
      });
    }
  };

  const syncToGhl = async (leadIds: string[]) => {
    leadIds.forEach((id) => setSyncingIds((s) => new Set(s).add(id)));
    try {
      const res = await ghlApi.sync(leadIds);
      const { synced, errors } = res.data as { synced: number; errors: number };
      if (errors > 0) toast.error(`${errors} lead(s) failed to sync — check GHL credentials in Settings`);
      if (synced > 0) toast.success(`${synced} lead${synced !== 1 ? 's' : ''} pushed to GoHighLevel`);
      qc.invalidateQueries({ queryKey: ['leads'] });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'GHL sync failed';
      toast.error(msg);
    } finally {
      leadIds.forEach((id) =>
        setSyncingIds((s) => { const next = new Set(s); next.delete(id); return next; })
      );
    }
  };

  const sendNowMutation = useMutation({
    mutationFn: (emailId: string) => emailsApi.sendNow(emailId),
    onSuccess: () => {
      toast.success('Email sent!');
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Send failed';
      toast.error(msg);
    },
  });

  const leads: Lead[] = data?.leads || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 50);

  // Industry detection for selected leads (used to gate industry-specific
  // action buttons). Only checks leads visible on the current page — if the
  // user selects across pages, hidden selections default to showing all
  // buttons (safer than hiding).
  const RE_INDUSTRY_KEYWORDS = ['real estate', 'realtor', 'estate agent', 'realty', 'lettings agency', 'letting agent'];
  const isReIndustry = (industry?: string | null) => {
    if (!industry) return false;
    const n = industry.toLowerCase().trim();
    return RE_INDUSTRY_KEYWORDS.some((kw) => n.includes(kw));
  };
  const visibleSelectedLeads = leads.filter((l) => selected.has(l.id));
  const allSelectedAreRealEstate =
    visibleSelectedLeads.length > 0 && visibleSelectedLeads.every((l) => isReIndustry(l.industry));

  const allSelected = leads.length > 0 && leads.every((l) => selected.has(l.id));
  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(leads.map((l) => l.id)));
    }
  }, [allSelected, leads]);

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Leads</h1>
          <p className="text-slate-400 text-sm mt-1">{total} total leads</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <select
                className="select text-xs"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
              >
                {TONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                className="select text-xs"
                value={selectedDemoId}
                onChange={(e) => setSelectedDemoId(e.target.value)}
                title="Demo link to include in emails"
              >
                <option value="">Demo link: auto-match</option>
                {demos.map((d) => (
                  <option key={d.id} value={d.id}>{d.label} ({d.industry})</option>
                ))}
              </select>
              <button
                className="btn-primary flex items-center gap-2"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Mail size={16} />
                    Generate Emails ({selected.size})
                  </>
                )}
              </button>
              <button
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                onClick={() => generateSmsMutation.mutate()}
                disabled={generateSmsMutation.isPending}
              >
                {generateSmsMutation.isPending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Smartphone size={16} />
                    Generate SMS ({selected.size})
                  </>
                )}
              </button>
              <button
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                onClick={() => startSequenceMutation.mutate()}
                disabled={startSequenceMutation.isPending}
                title="Start 3-message SMS outreach sequence (Day 0, 3, 10)"
              >
                {startSequenceMutation.isPending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Zap size={16} />
                    SMS Sequence ({selected.size})
                  </>
                )}
              </button>
              <button
                className="btn-secondary flex items-center gap-2 text-orange-300 hover:text-orange-200 border-orange-800/50 hover:bg-orange-900/20"
                onClick={() => syncToGhl(Array.from(selected))}
                disabled={syncingIds.size > 0}
                title="Push selected leads to GoHighLevel"
              >
                <div className="w-3.5 h-3.5 rounded bg-orange-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-xs leading-none" style={{ fontSize: 9 }}>G</span>
                </div>
                Sync to GHL ({selected.size})
              </button>
              {!allSelectedAreRealEstate && (
                <button
                  className="flex items-center gap-2 bg-pink-600 hover:bg-pink-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                  onClick={() => enrichMedSpaMutation.mutate()}
                  disabled={enrichMedSpaMutation.isPending}
                  title="Scrape websites + extract med spa data via Firecrawl + Claude"
                >
                  {enrichMedSpaMutation.isPending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Enriching...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Enrich Med Spa ({selected.size})
                    </>
                  )}
                </button>
              )}
              <button
                className="btn-danger flex items-center gap-1"
                onClick={() => {
                  if (confirm(`Delete ${selected.size} lead(s)?`)) {
                    deleteMutation.mutate(Array.from(selected));
                  }
                }}
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            className="input pl-8"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <select
          className="select"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {getStatusLabel(s)}
            </option>
          ))}
        </select>

        <select
          className="select"
          value={hasWebsite}
          onChange={(e) => {
            setHasWebsite(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All leads</option>
          <option value="false">No website</option>
          <option value="true">Has website</option>
        </select>

        <div className="relative">
          <input
            type="text"
            list="industry-options"
            className="input"
            placeholder="Filter by industry..."
            value={industryFilter}
            onChange={(e) => {
              setIndustryFilter(e.target.value);
              setPage(1);
              setSelected(new Set());
            }}
          />
          <datalist id="industry-options">
            {industries.map((ind) => (
              <option key={ind} value={ind} />
            ))}
          </datalist>
          {industryFilter && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              onClick={() => { setIndustryFilter(''); setPage(1); setSelected(new Set()); }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="select"
          value={locationFilter}
          onChange={(e) => {
            setLocationFilter(e.target.value);
            setPage(1);
            setSelected(new Set());
          }}
        >
          <option value="">All locations</option>
          {locations.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 text-sm text-slate-400">
          <ArrowUpDown size={14} />
          <select
            className="select"
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          >
            <option value="createdAt">Newest first</option>
            <option value="score">Highest priority score</option>
            <option value="websiteScore">Worst website first</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="card space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-800 rounded animate-pulse" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="card text-center py-16">
          <Users size={48} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400 font-medium">No leads found</p>
          <p className="text-slate-600 text-sm mt-1">
            Use the Scraper to find and save businesses
          </p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header w-10">
                    <button onClick={toggleAll} className="text-slate-400 hover:text-slate-200">
                      {allSelected ? (
                        <CheckSquare size={16} className="text-blue-400" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </th>
                  <th className="table-header text-left">Business</th>
                  <th className="table-header text-left">Score</th>
                  <th className="table-header text-left">Contact</th>
                  <th className="table-header text-left">Location</th>
                  <th className="table-header text-left">Website</th>
                  <th className="table-header text-left">Status</th>
                  <th className="table-header text-left">Emails</th>
                  <th className="table-header text-left">Added</th>
                  <th className="table-header text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="table-row">
                    <td className="table-cell">
                      <button
                        onClick={() => toggleOne(lead.id)}
                        className="text-slate-400 hover:text-slate-200"
                      >
                        {selected.has(lead.id) ? (
                          <CheckSquare size={16} className="text-blue-400" />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </td>
                    <td className="table-cell">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium text-slate-200">{lead.businessName}</p>
                          {lead.ghlContactId && (
                            <span
                              title="Synced to GoHighLevel"
                              className="inline-flex items-center justify-center w-4 h-4 rounded bg-orange-500/80 flex-shrink-0"
                            >
                              <span className="text-white font-bold leading-none" style={{ fontSize: 9 }}>G</span>
                            </span>
                          )}
                          {lead.isQualifiedMedSpa === true && (
                            <span
                              title={`Qualified med spa — treatments: ${(lead.qualifyingTreatmentsFound || []).join(', ') || 'none'}`}
                              className="text-xs font-semibold rounded bg-pink-900/40 text-pink-300 border border-pink-800/50 px-1.5 py-0.5"
                            >
                              💉 Med Spa
                            </span>
                          )}
                          {lead.isQualifiedMedSpa === false && lead.businessType && (
                            <span
                              title={`Not a qualified med spa — classified as ${lead.businessType}`}
                              className="text-xs font-semibold rounded bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5"
                            >
                              {lead.businessType.replace(/_/g, ' ')}
                            </span>
                          )}
                          {lead.market && lead.market !== 'UNKNOWN' && (
                            <span
                              title={`Market: ${lead.market}${lead.portal ? ` · Portal: ${lead.portal}` : ''}`}
                              className="text-xs font-semibold rounded bg-blue-900/40 text-blue-300 border border-blue-800/50 px-1.5 py-0.5"
                            >
                              {lead.market}
                            </span>
                          )}
                        </div>
                        {lead.industry && (
                          <p className="text-xs text-slate-500">{lead.industry}</p>
                        )}
                        {lead.googleRating && (
                          <div className="flex items-center gap-1 text-yellow-400 text-xs mt-0.5">
                            <Star size={10} />
                            {lead.googleRating}
                            {lead.reviewCount ? ` (${lead.reviewCount})` : ''}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <ScoreBadge score={lead.score} />
                    </td>
                    <td className="table-cell">
                      <div className="space-y-0.5">
                        {lead.email ? (
                          <p className="text-xs text-slate-300">{lead.email}</p>
                        ) : (
                          <p className="text-xs text-slate-600 italic">No email</p>
                        )}
                        {lead.ownerName && (
                          <p className="text-xs text-slate-500">
                            {lead.ownerName}{lead.ownerTitle ? ` · ${lead.ownerTitle}` : ''}
                          </p>
                        )}
                        {lead.phone && (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Phone size={10} />
                            {lead.phone}
                            {lead.phoneMobile === false && (
                              <span className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded px-1 py-0.5 ml-1">Landline</span>
                            )}
                            {lead.phoneMobile === true && (
                              <span className="text-xs text-green-400 bg-green-900/20 border border-green-800/30 rounded px-1 py-0.5 ml-1">Mobile</span>
                            )}
                          </div>
                        )}
                        {lead.linkedinUrl && (
                          <a
                            href={lead.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400"
                          >
                            <Linkedin size={10} />
                            LinkedIn
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs text-slate-400">
                        {[lead.city, lead.state].filter(Boolean).join(', ') || '—'}
                      </span>
                    </td>
                    <td className="table-cell">
                      {lead.hasWebsite ? (
                        <div className="space-y-1">
                          <a
                            href={lead.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                          >
                            <Globe size={12} />
                            View site
                          </a>
                          {lead.websiteScore != null ? (
                            <WebsiteQualityBadge
                              score={lead.websiteScore}
                              issues={lead.websiteData?.quality?.issues}
                            />
                          ) : lead.websiteData ? (
                            <span className="flex items-center gap-0.5 text-xs text-purple-400">
                              <Sparkles size={10} />
                              enriched
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="badge bg-red-900/40 text-red-300 border border-red-800/50 text-xs font-semibold">
                          No website
                        </span>
                      )}
                    </td>
                    <td className="table-cell">
                      <select
                        className="select text-xs py-1 px-2 w-auto"
                        value={lead.status}
                        onChange={(e) =>
                          updateStatusMutation.mutate({ id: lead.id, status: e.target.value })
                        }
                      >
                        {LEAD_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {getStatusLabel(s)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs text-slate-400">
                        {lead._count.emails} email{lead._count.emails !== 1 ? 's' : ''}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className="text-xs text-slate-500">{formatDate(lead.createdAt)}</span>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setEditingLead(lead)}
                          className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-700 rounded"
                          title="Edit lead"
                        >
                          <Edit2 size={14} />
                        </button>
                        {lead.hasWebsite && (
                          <button
                            onClick={() => enrichLead(lead)}
                            disabled={enrichingIds.has(lead.id)}
                            className={`p-1.5 rounded transition-colors ${
                              lead.websiteData
                                ? 'text-purple-400 hover:text-purple-300 hover:bg-slate-700'
                                : 'text-slate-500 hover:text-purple-400 hover:bg-slate-700'
                            }`}
                            title={lead.websiteData ? 'Re-enrich from website' : 'Enrich: scrape website for email & info'}
                          >
                            {enrichingIds.has(lead.id) ? (
                              <span className="w-3.5 h-3.5 border border-purple-400 border-t-transparent rounded-full animate-spin inline-block" />
                            ) : (
                              <Sparkles size={14} />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() =>
                            api.patch(`/leads/${lead.id}/followups`, { enabled: !lead.followupsEnabled })
                              .then(() => { qc.invalidateQueries({ queryKey: ['leads'] }); toast.success(lead.followupsEnabled ? 'Follow-ups stopped' : 'Follow-ups resumed'); })
                              .catch(() => toast.error('Failed to update'))
                          }
                          className={`p-1.5 rounded transition-colors ${lead.followupsEnabled ? 'text-slate-500 hover:text-yellow-400 hover:bg-slate-700' : 'text-red-400 hover:bg-slate-700'}`}
                          title={lead.followupsEnabled ? 'Stop follow-ups' : 'Resume follow-ups'}
                        >
                          {lead.followupsEnabled ? <Bell size={14} /> : <BellOff size={14} />}
                        </button>
                        {lead.phone && (
                          <>
                            <button
                              onClick={() => setWhatsAppLead(lead)}
                              className="p-1.5 text-slate-500 hover:text-green-400 hover:bg-slate-700 rounded transition-colors"
                              title="Send WhatsApp message"
                            >
                              <MessageCircle size={14} />
                            </button>
                            <button
                              onClick={() => setSmsLead(lead)}
                              className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-700 rounded transition-colors"
                              title="Send SMS via GoHighLevel"
                            >
                              <Smartphone size={14} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => syncToGhl([lead.id])}
                          disabled={syncingIds.has(lead.id)}
                          className={`p-1.5 rounded transition-colors ${
                            lead.ghlContactId
                              ? 'text-orange-400 hover:text-orange-300 hover:bg-slate-700'
                              : 'text-slate-500 hover:text-orange-400 hover:bg-slate-700'
                          }`}
                          title={lead.ghlContactId ? 'Re-sync to GoHighLevel' : 'Push to GoHighLevel'}
                        >
                          {syncingIds.has(lead.id) ? (
                            <span className="w-3.5 h-3.5 border border-orange-400 border-t-transparent rounded-full animate-spin inline-block" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded bg-orange-500/60 hover:bg-orange-500 flex items-center justify-center transition-colors">
                              <span className="text-white font-bold leading-none" style={{ fontSize: 8 }}>G</span>
                            </div>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages} · {total} leads
              </span>
              <div className="flex items-center gap-2">
                <button
                  className="btn-secondary py-1 px-2"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="btn-secondary py-1 px-2"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Lead Modal */}
      {editingLead && (
        <LeadEditModal
          lead={editingLead}
          onSave={(data) => updateLeadMutation.mutate({ id: editingLead.id, data })}
          onClose={() => setEditingLead(null)}
          saving={updateLeadMutation.isPending}
        />
      )}

      {/* WhatsApp Modal */}
      {whatsAppLead && (
        <WhatsAppModal
          lead={whatsAppLead}
          onClose={() => setWhatsAppLead(null)}
          onSent={() => {
            qc.invalidateQueries({ queryKey: ['leads'] });
            setWhatsAppLead(null);
          }}
        />
      )}

      {/* SMS Modal */}
      {smsLead && (
        <SmsModal
          lead={smsLead}
          onClose={() => setSmsLead(null)}
          onSent={() => {
            qc.invalidateQueries({ queryKey: ['leads'] });
            setSmsLead(null);
          }}
        />
      )}

      {/* Bulk SMS Modal */}
      {showSmsModal && (
        <BulkSmsModal
          messages={generatedSms}
          onUpdate={setGeneratedSms}
          onClose={() => { setShowSmsModal(false); setGeneratedSms([]); }}
          onSent={() => {
            setShowSmsModal(false);
            setGeneratedSms([]);
            setSelected(new Set());
            qc.invalidateQueries({ queryKey: ['leads'] });
          }}
        />
      )}

      {/* SMS Sequence Results Modal */}
      {showSequenceModal && sequenceResults && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-bold text-white">SMS Sequences Started</h2>
                <p className="text-sm text-slate-400">
                  {sequenceResults.started} started, {sequenceResults.failed} failed — Messages send Mon-Thu 4-7pm UK time
                </p>
              </div>
              <button onClick={() => { setShowSequenceModal(false); setSequenceResults(null); }} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-4">
              {sequenceResults.results.map((r) => (
                <div key={r.leadId} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                  <h3 className="text-sm font-bold text-emerald-400 mb-2">{r.businessName}</h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs font-semibold text-slate-400">Day 0 — The Hook</span>
                      <p className="text-xs text-slate-300 mt-0.5 bg-slate-900/50 rounded p-2">{r.message1}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-400">Day 3 — The Nudge</span>
                      <p className="text-xs text-slate-300 mt-0.5 bg-slate-900/50 rounded p-2">{r.message2}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-400">Day 10 — The Close</span>
                      <p className="text-xs text-slate-300 mt-0.5 bg-slate-900/50 rounded p-2">{r.message3}</p>
                    </div>
                  </div>
                </div>
              ))}
              {sequenceResults.errors.length > 0 && (
                <div className="mt-2">
                  <h3 className="text-sm font-semibold text-red-400 mb-2">Failed to start:</h3>
                  {sequenceResults.errors.map((e) => (
                    <div key={e.leadId} className="text-xs text-red-300 bg-red-900/20 border border-red-800/30 rounded p-2 mb-1">
                      <span className="font-medium">{e.businessName}:</span> {e.error}
                      {e.missing && e.missing.length > 0 && (
                        <span className="text-red-400"> (missing: {e.missing.join(', ')})</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => { setShowSequenceModal(false); setSequenceResults(null); }}
                className="btn-primary"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generated Emails Modal */}
      {showEmailModal && (() => {
        const allLocked = generatedEmails.length > 0 && generatedEmails.every((e) => e.locked);
        const anyLocked = generatedEmails.some((e) => e.locked);
        const lockedCount = generatedEmails.filter((e) => e.locked).length;
        const allReal = allLocked && generatedEmails.every((e) => e.source === 'real_estate_locked_templates');
        const allMedSpa = allLocked && generatedEmails.every((e) => e.source === 'med_spa_locked_templates');
        const lockedHeader = allReal
          ? `Real Estate Sequence — ${generatedEmails.length} emails locked`
          : allMedSpa
          ? `Med Spa Sequence — ${generatedEmails.length} emails locked`
          : `Locked Sequence — ${generatedEmails.length} emails locked`;
        const lockedSubtitle = allReal
          ? 'Locked templates. Variables resolved. Pre-scheduled on a 1/4/9 cadence (Tue/Wed/Thu 07:00–09:00 local).'
          : allMedSpa
          ? 'Locked templates. Variables resolved. Pre-scheduled on a 1/4/9 cadence (Tue/Wed/Thu 08:30 UK).'
          : 'Locked templates. Variables resolved. Pre-scheduled on a 1/4/9 cadence.';
        return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                  {allLocked ? (
                    <>
                      <span title={allReal ? 'Real estate sequence templates are locked.' : allMedSpa ? 'Med spa sequence templates are locked.' : 'Sequence templates are locked.'}>🔒</span>
                      {lockedHeader}
                    </>
                  ) : (
                    <>Generated Emails ({generatedEmails.length}{anyLocked ? `, ${lockedCount} locked` : ''})</>
                  )}
                </h2>
                <p className="text-sm text-slate-400">
                  {allLocked
                    ? lockedSubtitle
                    : 'Review and edit emails before scheduling'}
                </p>
                {allMedSpa && null /* preserve flag for future use */}
              </div>
              <button
                onClick={() => setShowEmailModal(false)}
                className="p-2 text-slate-400 hover:text-slate-200 rounded"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {generatedEmails.map((email, i) => {
                const isRe = email.source === 'real_estate_locked_templates';
                const isMedSpa = email.source === 'med_spa_locked_templates';
                const reLabels = ['Day 1 — Enquiries After 6pm', 'Day 4 — Whoever Replies First', 'Day 9 — Last One'];
                const medLabels = ['Day 1 — Hook', 'Day 4 — Paying Twice', 'Day 9 — Close'];
                const stageLabel = isRe
                  ? reLabels[email.followupNumber ?? -1]
                  : isMedSpa
                  ? medLabels[email.followupNumber ?? -1]
                  : null;
                const badgeColour = isRe
                  ? 'text-blue-300 bg-blue-900/30 border-blue-800/40'
                  : isMedSpa
                  ? 'text-pink-300 bg-pink-900/30 border-pink-800/40'
                  : 'text-slate-300 bg-slate-800/40 border-slate-700/40';
                const bgColour = isRe
                  ? 'bg-blue-950/20 border border-blue-900/40'
                  : isMedSpa
                  ? 'bg-pink-950/20 border border-pink-900/40'
                  : 'bg-slate-900/40 border border-slate-700/40';
                const iconColour = isRe ? 'text-blue-400' : isMedSpa ? 'text-pink-400' : 'text-slate-400';
                const lockTitle = isRe
                  ? 'Locked real estate template'
                  : isMedSpa
                  ? 'Locked med spa template'
                  : 'Locked template';
                return (
                <div key={email.id} className={`rounded-lg p-4 space-y-3 ${email.locked ? bgColour : 'bg-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      {email.locked && (
                        <span title={lockTitle} className={iconColour}>🔒</span>
                      )}
                      {i + 1}. {email.lead.businessName}
                      {email.locked && typeof email.followupNumber === 'number' && stageLabel && (
                        <span className={`text-xs rounded px-2 py-0.5 ml-2 ${badgeColour}`}>
                          {stageLabel}
                        </span>
                      )}
                      {email.locked && email.scheduledAt && (
                        <span className="text-xs text-slate-400 ml-2">
                          → sends {new Date(email.scheduledAt).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-2">
                      {!email.locked && (
                        <button
                          className="btn-secondary text-xs py-1 px-2 flex items-center gap-1"
                          onClick={() => sendNowMutation.mutate(email.id)}
                          disabled={sendNowMutation.isPending}
                        >
                          <Send size={12} />
                          Send Now
                        </button>
                      )}
                    </div>
                  </div>
                  {editingEmail?.id === email.id ? (
                    <div className="space-y-2">
                      <input
                        className="input"
                        value={editingEmail.subject}
                        onChange={(e) =>
                          setEditingEmail({ ...editingEmail, subject: e.target.value })
                        }
                        placeholder="Subject"
                      />
                      <textarea
                        className="input resize-none"
                        rows={8}
                        value={editingEmail.body}
                        onChange={(e) =>
                          setEditingEmail({ ...editingEmail, body: e.target.value })
                        }
                      />
                      <div className="flex gap-2">
                        <button
                          className="btn-primary text-xs"
                          onClick={() => {
                            saveEmailMutation.mutate({
                              id: editingEmail.id,
                              data: {
                                subject: editingEmail.subject,
                                body: editingEmail.body,
                              },
                            });
                            setGeneratedEmails((prev) =>
                              prev.map((e) => (e.id === editingEmail.id ? editingEmail : e))
                            );
                            setEditingEmail(null);
                          }}
                        >
                          Save
                        </button>
                        <button
                          className="btn-secondary text-xs"
                          onClick={() => setEditingEmail(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="bg-slate-900 rounded px-3 py-2">
                        <p className="text-xs text-slate-500">Subject</p>
                        <p className="text-sm text-slate-200">{email.subject}</p>
                      </div>
                      <div className="bg-slate-900 rounded px-3 py-2">
                        <p className="text-xs text-slate-500 mb-1">Body</p>
                        <p className="text-sm text-slate-300 whitespace-pre-line">
                          {email.body}
                        </p>
                      </div>
                      {!email.locked && (
                        <button
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                          onClick={() => setEditingEmail(email)}
                        >
                          <Edit2 size={12} /> Edit email
                        </button>
                      )}
                      {email.locked && (
                        <p className={`text-xs ${isRe ? 'text-blue-400/80' : isMedSpa ? 'text-pink-400/80' : 'text-slate-400/80'}`}>🔒 Locked — content cannot be edited</p>
                      )}
                    </>
                  )}
                </div>
                );
              })}
            </div>

            <div className="border-t border-slate-800 p-4 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                {!allLocked && (
                  <>
                    <div>
                      <label className="label text-xs">Schedule start date</label>
                      <input
                        type="datetime-local"
                        className="input text-xs"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Minutes between emails</label>
                      <input
                        type="number"
                        className="input text-xs w-28"
                        min={0}
                        max={60}
                        value={minutesBetween}
                        onChange={(e) => setMinutesBetween(Number(e.target.value))}
                        title="Set to 0 to spread over the day instead"
                      />
                    </div>
                    {minutesBetween === 0 && (
                      <div>
                        <label className="label text-xs">Emails per day</label>
                        <input
                          type="number"
                          className="input text-xs w-24"
                          min={1}
                          max={200}
                          value={sendPerDay}
                          onChange={(e) => setSendPerDay(Number(e.target.value))}
                        />
                      </div>
                    )}
                    {minutesBetween > 0 && scheduleDate && (
                      <div className="text-xs text-slate-400 self-end pb-2">
                        {generatedEmails.length} emails · last sends at{' '}
                        {new Date(
                          new Date(scheduleDate).getTime() + (generatedEmails.length - 1) * minutesBetween * 60000
                        ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </>
                )}
                {allLocked && (
                  <div className="text-xs text-slate-400 flex-1">
                    🔒 Cadence locked. Each email is pre-scheduled at the time shown above. No edits permitted.
                  </div>
                )}
                <button
                  className="btn-primary flex items-center gap-2"
                  onClick={() => scheduleMutation.mutate()}
                  disabled={scheduleMutation.isPending}
                >
                  {scheduleMutation.isPending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    <>
                      <Clock size={16} />
                      {allLocked ? 'Schedule sequence' : 'Schedule All Emails'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

function LeadEditModal({
  lead,
  onSave,
  onClose,
  saving,
}: {
  lead: Lead;
  onSave: (data: Record<string, unknown>) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    businessName: lead.businessName || '',
    ownerName: lead.ownerName || '',
    ownerTitle: lead.ownerTitle || '',
    email: lead.email || '',
    phone: lead.phone || '',
    city: lead.city || '',
    state: lead.state || '',
    industry: lead.industry || '',
    websiteUrl: lead.websiteUrl || '',
    hasWebsite: lead.hasWebsite,
    description: lead.description || '',
    customDemoLink: lead.customDemoLink || '',
  });

  const allEmails: string[] = (lead.websiteData?.allEmailsFound as string[] | undefined)
    ?? (lead.websiteData?.emails as string[] | undefined)
    ?? [];

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-slate-100">Edit Lead</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 rounded">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
          {[
            { label: 'Business Name', key: 'businessName', type: 'text' },
            { label: 'Industry', key: 'industry', type: 'text' },
            { label: 'Owner Name', key: 'ownerName', type: 'text' },
            { label: 'Owner Title', key: 'ownerTitle', type: 'text' },
            { label: 'Phone', key: 'phone', type: 'text' },
            { label: 'City', key: 'city', type: 'text' },
            { label: 'State', key: 'state', type: 'text' },
            { label: 'Website URL', key: 'websiteUrl', type: 'url' },
            { label: 'Custom Demo Link', key: 'customDemoLink', type: 'url' },
          ].map(({ label, key, type }) => (
            <div key={key} className={key === 'customDemoLink' || key === 'websiteUrl' ? 'col-span-2' : ''}>
              <label className="label">{label}</label>
              <input
                type={type}
                className="input"
                value={form[key as keyof typeof form] as string}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              />
            </div>
          ))}

          {/* Email field with scraped suggestions */}
          <div className="col-span-2">
            <label className="label">
              Email
              {allEmails.length > 0 && (
                <span className="ml-2 text-xs text-purple-400">
                  {allEmails.length} found by scraper
                </span>
              )}
            </label>
            <input
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="contact@business.com"
            />
            {allEmails.length > 1 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                <span className="text-xs text-slate-500">Quick-fill:</span>
                {allEmails.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, email: e }))}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                      form.email === e
                        ? 'bg-purple-600/30 border-purple-500 text-purple-300'
                        : 'border-slate-700 text-slate-400 hover:border-purple-500 hover:text-purple-300'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="col-span-2">
            <label className="label">Description</label>
            <textarea
              className="input resize-none"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Services found by scraper */}
          {(lead.websiteData?.services as string[] | undefined)?.length ? (
            <div className="col-span-2">
              <p className="label">Services found on website</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {(lead.websiteData!.services as string[]).map((s) => (
                  <span key={s} className="text-xs bg-slate-800 text-slate-400 border border-slate-700 rounded px-2 py-0.5">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="hasWebsite"
              checked={form.hasWebsite}
              onChange={(e) => setForm((f) => ({ ...f, hasWebsite: e.target.checked }))}
              className="w-4 h-4 accent-blue-500"
            />
            <label htmlFor="hasWebsite" className="text-sm text-slate-300">
              Has a website
            </label>
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t border-slate-800">
          <button className="btn-primary flex-1" onClick={() => onSave(form)} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface WhatsAppMessage {
  id: string;
  message: string;
  status: string;
  sentAt: string;
}

function WhatsAppModal({
  lead,
  onClose,
  onSent,
}: {
  lead: Lead;
  onClose: () => void;
  onSent: () => void;
}) {
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendingViaGhl, setSendingViaGhl] = useState(false);
  const [history, setHistory] = useState<WhatsAppMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [lastWaLink, setLastWaLink] = useState('');
  const [ghlConfigured, setGhlConfigured] = useState(false);

  // Load message history + GHL status on mount
  useState(() => {
    whatsAppApi.messages(lead.id)
      .then((r) => setHistory(r.data as WhatsAppMessage[]))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
    ghlApi.status()
      .then((r) => setGhlConfigured((r.data as { configured: boolean }).configured))
      .catch(() => {});
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await whatsAppApi.generate(lead.id);
      setMessage((res.data as { message: string }).message);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Generation failed';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) return toast.error('Enter a message first');
    setSending(true);
    try {
      const res = await whatsAppApi.send(lead.id, message.trim());
      const { waLink, sentViaApi } = res.data as { waLink: string; sentViaApi: boolean };
      if (sentViaApi) {
        toast.success('WhatsApp message sent via API!');
        onSent();
      } else {
        // Open WhatsApp with pre-filled message
        setLastWaLink(waLink);
        window.open(waLink, '_blank');
        toast.success('Opened in WhatsApp — message pre-filled. Hit send there!', { duration: 5000 });
        // Reload history
        whatsAppApi.messages(lead.id).then((r) => setHistory(r.data as WhatsAppMessage[])).catch(() => {});
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send';
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const handleSendViaGhl = async () => {
    if (!message.trim()) return toast.error('Enter a message first');
    setSendingViaGhl(true);
    try {
      await ghlApi.message(lead.id, message.trim(), 'WhatsApp');
      toast.success('Sent via GoHighLevel — check your GHL inbox for the conversation');
      onSent();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'GHL send failed';
      toast.error(msg);
    } finally {
      setSendingViaGhl(false);
    }
  };

  const normalizedPhone = lead.phone?.replace(/\D/g, '') || '';
  const manualLink = normalizedPhone ? `https://wa.me/${normalizedPhone}` : '';

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <MessageCircle size={18} className="text-green-400" />
            <div>
              <h2 className="text-base font-semibold text-slate-100">{lead.businessName}</h2>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Phone size={10} />
                {lead.phone}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {manualLink && (
              <a
                href={manualLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 px-2 py-1 rounded border border-green-800/50 hover:bg-green-900/20 transition-colors"
              >
                <ExternalLink size={12} />
                Open WhatsApp
              </a>
            )}
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 rounded">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Message history */}
        {!loadingHistory && history.length > 0 && (
          <div className="px-4 pt-3 pb-1">
            <p className="text-xs text-slate-500 mb-2">{history.length} previous message{history.length !== 1 ? 's' : ''}</p>
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {history.map((m) => (
                <div key={m.id} className="bg-slate-800 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-300 line-clamp-2">{m.message}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs ${m.status === 'SENT' ? 'text-green-400' : 'text-slate-500'}`}>
                      {m.status === 'SENT' ? 'Sent via API' : 'Opened in app'}
                    </span>
                    <span className="text-xs text-slate-600">
                      {new Date(m.sentAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compose */}
        <div className="p-4 space-y-3 flex-1 flex flex-col">
          <div className="flex items-center justify-between">
            <label className="label mb-0">Message</label>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 px-2 py-1 rounded border border-purple-800/50 hover:bg-purple-900/20 transition-colors disabled:opacity-50"
            >
              {generating ? (
                <>
                  <span className="w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles size={12} />
                  AI Generate
                </>
              )}
            </button>
          </div>
          <textarea
            className="input resize-none flex-1 min-h-[120px]"
            placeholder="Type your WhatsApp message here, or use AI Generate..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-600">{message.length} characters</p>
            {lastWaLink && (
              <a
                href={lastWaLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1"
              >
                <ExternalLink size={11} />
                Re-open in WhatsApp
              </a>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <button
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              onClick={handleSend}
              disabled={sending || !message.trim()}
            >
              {sending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <MessageCircle size={16} />
                  Open in WhatsApp
                </>
              )}
            </button>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
          {ghlConfigured && (
            <button
              className="w-full flex items-center justify-center gap-2 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-700/50 text-orange-300 hover:text-orange-200 text-sm font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
              onClick={handleSendViaGhl}
              disabled={sendingViaGhl || !message.trim()}
            >
              {sendingViaGhl ? (
                <>
                  <span className="w-4 h-4 border-2 border-orange-300/30 border-t-orange-300 rounded-full animate-spin" />
                  Sending via GHL...
                </>
              ) : (
                <>
                  <div className="w-4 h-4 rounded bg-orange-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold leading-none" style={{ fontSize: 9 }}>G</span>
                  </div>
                  Send via GoHighLevel
                  {lead.ghlContactId && <span className="text-xs text-orange-400/70 ml-1">synced</span>}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SMS Modal ───────────────────────────────────────────────────────────────

function SmsModal({
  lead,
  onClose,
  onSent,
}: {
  lead: Lead;
  onClose: () => void;
  onSent: () => void;
}) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await ghlApi.generateSms(lead.id);
      setMessage((res.data as { message: string }).message);
      toast.success('SMS generated!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to generate SMS';
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await ghlApi.message(lead.id, message.trim(), 'SMS');
      toast.success('SMS sent via GoHighLevel!');
      onSent();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send SMS';
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Smartphone size={18} className="text-blue-400" />
              Send SMS
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              To: {lead.businessName} ({lead.phone})
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              SMS is sent through GoHighLevel.
            </p>
            <button
              className="flex items-center gap-1.5 text-xs font-medium text-purple-400 hover:text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <>
                  <span className="w-3 h-3 border-2 border-purple-300/30 border-t-purple-300 rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles size={13} />
                  AI Generate
                </>
              )}
            </button>
          </div>
          <textarea
            className="input resize-none w-full min-h-[120px]"
            placeholder="Type your SMS or click AI Generate..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1600}
          />
          <p className="text-xs text-slate-500 text-right">{message.length} / 1600</p>
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-800">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary flex items-center gap-2"
            onClick={handleSend}
            disabled={sending || !message.trim()}
          >
            {sending ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send size={16} />
                Send SMS
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk SMS Modal ──────────────────────────────────────────────────────────

function BulkSmsModal({
  messages,
  onUpdate,
  onClose,
  onSent,
}: {
  messages: Array<{ leadId: string; businessName: string; phone: string; message: string }>;
  onUpdate: (msgs: Array<{ leadId: string; businessName: string; phone: string; message: string }>) => void;
  onClose: () => void;
  onSent: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);

  const handleSendAll = async () => {
    setSending(true);
    try {
      const payload = messages.map((m) => ({ leadId: m.leadId, message: m.message }));
      const res = await ghlApi.sendSmsBulk(payload);
      const data = res.data as { sent: number; failed: number };
      if (data.failed > 0) {
        toast.error(`${data.failed} SMS failed to send — check GHL config`);
      }
      if (data.sent > 0) {
        toast.success(`${data.sent} SMS sent via GoHighLevel!`);
      }
      onSent();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to send SMS';
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Smartphone size={20} className="text-blue-400" />
              Generated SMS ({messages.length})
            </h2>
            <p className="text-sm text-slate-400">Review and edit before sending</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-200 rounded">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((sms, i) => (
            <div key={sms.leadId} className="bg-slate-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-200">
                    {i + 1}. {sms.businessName}
                  </p>
                  <p className="text-xs text-slate-500">{sms.phone}</p>
                </div>
              </div>
              {editingIdx === i ? (
                <div className="space-y-2">
                  <textarea
                    className="input resize-none w-full"
                    rows={4}
                    value={sms.message}
                    onChange={(e) => {
                      const updated = [...messages];
                      updated[i] = { ...updated[i], message: e.target.value };
                      onUpdate(updated);
                    }}
                    maxLength={1600}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">{sms.message.length} / 1600</p>
                    <button
                      className="btn-primary text-xs"
                      onClick={() => setEditingIdx(null)}
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-slate-900 rounded px-3 py-2">
                    <p className="text-sm text-slate-300 whitespace-pre-line">{sms.message}</p>
                  </div>
                  <button
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    onClick={() => setEditingIdx(i)}
                  >
                    <Edit2 size={12} /> Edit
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-slate-800 p-4 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {messages.length} SMS will be sent via GoHighLevel
          </p>
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary flex items-center gap-2"
              onClick={handleSendAll}
              disabled={sending || messages.length === 0}
            >
              {sending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Send All SMS
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
