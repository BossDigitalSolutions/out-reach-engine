import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, X, Mail, BookOpen, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import { templatesApi } from '../lib/api';
import { INDUSTRIES } from '../lib/utils';
import api from '../lib/api';

interface Template {
  id: string;
  name: string;
  industry?: string;
  subject: string;
  body: string;
  tone: string;
  sequenceOrder: number;
  delayDays: number;
  createdAt: string;
}

interface PrebuiltEmail {
  id: string;
  subject: string;
  body: string;
  sequenceOrder: number;
  delayDays: number;
}

interface PrebuiltSeries {
  seriesId: string;
  seriesName: string;
  industry: string;
  tone: string;
  emails: PrebuiltEmail[];
}

const TONES = ['professional', 'casual', 'friendly', 'bold'];
const DEFAULT_FORM = { name: '', industry: '', subject: '', body: '', tone: 'professional', sequenceOrder: 1, delayDays: 0 };

const TONE_COLORS: Record<string, string> = {
  professional: 'bg-blue-900/40 text-blue-300',
  casual: 'bg-purple-900/40 text-purple-300',
  friendly: 'bg-green-900/40 text-green-300',
  bold: 'bg-red-900/40 text-red-300',
};

export default function EmailTemplates() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'library' | 'mine'>('library');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [expandedSeries, setExpandedSeries] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [previewEmail, setPreviewEmail] = useState<PrebuiltEmail | null>(null);
  const [previewSeries, setPreviewSeries] = useState<PrebuiltSeries | null>(null);

  const { data: prebuilt = [], isLoading: prebuiltLoading } = useQuery<PrebuiltSeries[]>({
    queryKey: ['prebuilt-templates', filterIndustry],
    queryFn: () =>
      api.get('/templates/prebuilt', { params: filterIndustry ? { industry: filterIndustry } : {} }).then((r) => r.data),
  });

  const { data: prebuiltIndustries = [] } = useQuery<string[]>({
    queryKey: ['prebuilt-industries'],
    queryFn: () => api.get('/templates/prebuilt/industries').then((r) => r.data),
  });

  const { data: myTemplates = [], isLoading: myLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => templatesApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      setCreating(false);
      setForm(DEFAULT_FORM);
      toast.success('Template created');
    },
    onError: () => toast.error('Failed to create template'),
  });

  const updateMutation = useMutation({
    mutationFn: () => templatesApi.update(editing!.id, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      setEditing(null);
      toast.success('Template updated');
    },
    onError: () => toast.error('Failed to update template'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => templatesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template deleted');
    },
    onError: () => toast.error('Failed to delete'),
  });

  const openEdit = (template: Template) => {
    setEditing(template);
    setForm({
      name: template.name,
      industry: template.industry || '',
      subject: template.subject,
      body: template.body,
      tone: template.tone,
      sequenceOrder: template.sequenceOrder,
      delayDays: template.delayDays,
    });
  };

  const copyToMyTemplates = async (series: PrebuiltSeries, email: PrebuiltEmail) => {
    try {
      await templatesApi.create({
        name: `${series.seriesName} — Email ${email.sequenceOrder}`,
        industry: series.industry,
        subject: email.subject,
        body: email.body,
        tone: series.tone,
        sequenceOrder: email.sequenceOrder,
        delayDays: email.delayDays,
      });
      qc.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Copied to My Templates');
    } catch {
      toast.error('Failed to copy template');
    }
  };

  const toggleSeries = (seriesId: string) => {
    setExpandedSeries((prev) => {
      const next = new Set(prev);
      if (next.has(seriesId)) next.delete(seriesId);
      else next.add(seriesId);
      return next;
    });
  };

  const showModal = creating || !!editing;

  // Group prebuilt by industry
  const byIndustry: Record<string, PrebuiltSeries[]> = {};
  for (const s of prebuilt) {
    if (!byIndustry[s.industry]) byIndustry[s.industry] = [];
    byIndustry[s.industry].push(s);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Email Templates</h1>
          <p className="text-slate-400 text-sm mt-1">
            {prebuilt.reduce((a, s) => a + s.emails.length, 0)} prebuilt templates across 7 industries, or create your own
          </p>
        </div>
        {tab === 'mine' && (
          <button className="btn-primary flex items-center gap-2" onClick={() => { setForm(DEFAULT_FORM); setCreating(true); }}>
            <Plus size={16} /> New Template
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab('library')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'library' ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen size={15} /> Template Library
        </button>
        <button
          onClick={() => setTab('mine')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === 'mine' ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Mail size={15} /> My Templates
          {(myTemplates as Template[]).length > 0 && (
            <span className="bg-blue-600 text-white text-xs rounded-full px-1.5">{(myTemplates as Template[]).length}</span>
          )}
        </button>
      </div>

      {/* ── LIBRARY TAB ──────────────────────────────────────────────────── */}
      {tab === 'library' && (
        <div className="space-y-4">
          {/* Industry filter */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-400">Filter by industry:</label>
            <select
              className="select"
              value={filterIndustry}
              onChange={(e) => setFilterIndustry(e.target.value)}
            >
              <option value="">All industries</option>
              {prebuiltIndustries.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
            <span className="text-xs text-slate-500">
              {prebuilt.length} series · {prebuilt.reduce((a, s) => a + s.emails.length, 0)} emails total
            </span>
          </div>

          {prebuiltLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="card animate-pulse h-16" />)}
            </div>
          ) : (
            Object.entries(byIndustry).map(([industry, seriesList]) => (
              <div key={industry} className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider pt-2">{industry}</h2>
                {seriesList.map((series) => {
                  const isExpanded = expandedSeries.has(series.seriesId);
                  return (
                    <div key={series.seriesId} className="card p-0 overflow-hidden">
                      {/* Series header */}
                      <button
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-800/50 transition-colors"
                        onClick={() => toggleSeries(series.seriesId)}
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                          <div>
                            <p className="font-medium text-slate-200">{series.seriesName}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {series.emails.length} emails · Day 0, Day {series.emails[1]?.delayDays}, Day {series.emails[2]?.delayDays}, Day {series.emails[3]?.delayDays}
                            </p>
                          </div>
                        </div>
                        <span className={`badge text-xs capitalize ${TONE_COLORS[series.tone] || 'bg-slate-800 text-slate-400'}`}>
                          {series.tone}
                        </span>
                      </button>

                      {/* Email list */}
                      {isExpanded && (
                        <div className="border-t border-slate-800">
                          {series.emails.map((email) => (
                            <div key={email.id} className="p-4 border-b border-slate-800/60 last:border-0 flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs bg-slate-800 text-slate-400 rounded px-1.5 py-0.5 shrink-0">
                                    {email.sequenceOrder === 1 ? 'Initial' : `Follow-up ${email.sequenceOrder - 1}`}
                                    {email.delayDays > 0 && ` · Day ${email.delayDays}`}
                                  </span>
                                </div>
                                <p className="text-sm font-medium text-slate-200 truncate">{email.subject}</p>
                                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{email.body.replace(/\n/g, ' ')}</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => { setPreviewEmail(email); setPreviewSeries(series); }}
                                  className="px-2.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors"
                                >
                                  Preview
                                </button>
                                <button
                                  onClick={() => copyToMyTemplates(series, email)}
                                  className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors"
                                  title="Copy to My Templates"
                                >
                                  <Copy size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── MY TEMPLATES TAB ─────────────────────────────────────────────── */}
      {tab === 'mine' && (
        myLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <div key={i} className="card animate-pulse h-48" />)}
          </div>
        ) : (myTemplates as Template[]).length === 0 ? (
          <div className="card text-center py-16">
            <Mail size={48} className="mx-auto text-slate-700 mb-3" />
            <p className="text-slate-400 font-medium">No templates yet</p>
            <p className="text-slate-600 text-sm mt-1 mb-4">Copy from the library or create your own</p>
            <div className="flex gap-3 justify-center">
              <button className="btn-secondary" onClick={() => setTab('library')}>Browse Library</button>
              <button className="btn-primary" onClick={() => { setForm(DEFAULT_FORM); setCreating(true); }}>Create Template</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {(myTemplates as Template[]).map((template) => (
              <div key={template.id} className="card space-y-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-100 truncate">{template.name}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {template.industry && (
                        <span className="badge bg-blue-900/40 text-blue-300 text-xs">{template.industry}</span>
                      )}
                      {template.sequenceOrder > 1 && (
                        <span className="badge bg-slate-800 text-slate-400 text-xs">Follow-up {template.sequenceOrder - 1} · Day {template.delayDays}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button onClick={() => openEdit(template)} className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded">
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => { if (confirm('Delete this template?')) deleteMutation.mutate(template.id); }}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Subject</p>
                  <p className="text-sm text-slate-300 truncate">{template.subject}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Preview</p>
                  <p className="text-sm text-slate-400 line-clamp-3">{template.body}</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className={`badge text-xs capitalize ${TONE_COLORS[template.tone] || 'bg-slate-800 text-slate-400'}`}>{template.tone}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Email Preview Modal */}
      {previewEmail && previewSeries && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-100">{previewSeries.seriesName}</h2>
                <p className="text-xs text-slate-500">
                  {previewEmail.sequenceOrder === 1 ? 'Initial Email' : `Follow-up ${previewEmail.sequenceOrder - 1}`}
                  {previewEmail.delayDays > 0 ? ` · Send on Day ${previewEmail.delayDays}` : ' · Send immediately'}
                </p>
              </div>
              <button onClick={() => setPreviewEmail(null)} className="p-2 text-slate-400 hover:text-slate-200 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">Subject</p>
                <p className="text-sm font-medium text-slate-200 bg-slate-800 rounded p-3">{previewEmail.subject}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Body</p>
                <pre className="text-sm text-slate-300 bg-slate-800 rounded p-3 whitespace-pre-wrap font-sans leading-relaxed">{previewEmail.body}</pre>
              </div>
              <div className="bg-blue-900/20 border border-blue-800/40 rounded-lg p-3">
                <p className="text-xs text-blue-300">
                  <strong>Merge fields:</strong> {'{{business_name}}'} {'{{owner_name}}'} {'{{location}}'} {'{{demo_link}}'} {'{{sender_name}}'}
                  — these are replaced automatically when generating emails.
                </p>
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-slate-800">
              <button
                className="btn-primary flex-1 flex items-center justify-center gap-2"
                onClick={() => {
                  copyToMyTemplates(previewSeries, previewEmail);
                  setPreviewEmail(null);
                }}
              >
                <Copy size={15} /> Copy to My Templates
              </button>
              <button className="btn-secondary" onClick={() => setPreviewEmail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-slate-100">{creating ? 'New Template' : 'Edit Template'}</h2>
              <button onClick={() => { setCreating(false); setEditing(null); }} className="p-2 text-slate-400 hover:text-slate-200 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Template Name</label>
                  <input type="text" className="input" placeholder="e.g., Restaurant Cold Email" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Industry (optional)</label>
                  <select className="select w-full" value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}>
                    <option value="">Any industry</option>
                    {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Sequence</label>
                  <select className="select w-full" value={form.sequenceOrder} onChange={(e) => setForm((f) => ({ ...f, sequenceOrder: Number(e.target.value) }))}>
                    <option value={1}>1 — Initial Email</option>
                    <option value={2}>2 — Follow-up 1</option>
                    <option value={3}>3 — Follow-up 2</option>
                    <option value={4}>4 — Follow-up 3</option>
                  </select>
                </div>
                <div>
                  <label className="label">Send on Day</label>
                  <input type="number" className="input" min={0} max={30} value={form.delayDays} onChange={(e) => setForm((f) => ({ ...f, delayDays: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label className="label">Tone</label>
                <div className="flex gap-2">
                  {TONES.map((t) => (
                    <button key={t} onClick={() => setForm((f) => ({ ...f, tone: t }))} className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${form.tone === t ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Subject Line</label>
                <input type="text" className="input" placeholder="Use {{business_name}} for personalization" value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} />
              </div>
              <div>
                <label className="label">Email Body</label>
                <p className="text-xs text-slate-500 mb-1">Merge fields: {'{{business_name}}'} {'{{owner_name}}'} {'{{location}}'} {'{{demo_link}}'} {'{{sender_name}}'}</p>
                <textarea className="input resize-none font-mono text-sm" rows={10} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-slate-800">
              <button
                className="btn-primary flex-1"
                onClick={() => (creating ? createMutation.mutate() : updateMutation.mutate())}
                disabled={!form.name || !form.subject || !form.body || createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending ? 'Saving...' : creating ? 'Create Template' : 'Save Changes'}
              </button>
              <button className="btn-secondary" onClick={() => { setCreating(false); setEditing(null); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
