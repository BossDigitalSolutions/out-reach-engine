import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, X, Link, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { demosApi } from '../lib/api';
import { INDUSTRIES } from '../lib/utils';

interface DemoLink {
  id: string;
  industry: string;
  url: string;
  label: string;
  createdAt: string;
}

const DEFAULT_FORM = { industry: '', customIndustry: '', url: '', label: '' };

export default function DemoLinks() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<DemoLink | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);

  const { data: demos = [], isLoading } = useQuery({
    queryKey: ['demos'],
    queryFn: () => demosApi.list().then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => demosApi.create({ ...form, industry: form.industry === 'custom' ? form.customIndustry : form.industry }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['demos'] });
      setCreating(false);
      setForm(DEFAULT_FORM);
      toast.success('Demo link added');
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to add demo link';
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => demosApi.update(editing!.id, { ...form, industry: form.industry === 'custom' ? form.customIndustry : form.industry }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['demos'] });
      setEditing(null);
      toast.success('Demo link updated');
    },
    onError: () => toast.error('Failed to update'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => demosApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['demos'] });
      toast.success('Demo link deleted');
    },
    onError: () => toast.error('Failed to delete'),
  });

  const openEdit = (demo: DemoLink) => {
    setEditing(demo);
    const isPreset = INDUSTRIES.includes(demo.industry as typeof INDUSTRIES[number]);
    setForm({ industry: isPreset ? demo.industry : 'custom', customIndustry: isPreset ? '' : demo.industry, url: demo.url, label: demo.label });
  };

  const openCreate = () => {
    setForm(DEFAULT_FORM);
    setCreating(true);
  };

  const showModal = creating || !!editing;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Demo Links</h1>
          <p className="text-slate-400 text-sm mt-1">
            Demo websites matched to leads by industry when generating emails
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={openCreate}>
          <Plus size={16} />
          Add Demo Link
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="card animate-pulse h-32" />
          ))}
        </div>
      ) : demos.length === 0 ? (
        <div className="card text-center py-16">
          <Link size={48} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400 font-medium">No demo links yet</p>
          <p className="text-slate-600 text-sm mt-1 mb-4">
            Add links to demo websites you've built for each industry. They'll be included
            automatically in generated emails.
          </p>
          <button className="btn-primary" onClick={openCreate}>
            Add First Demo Link
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {demos.map((demo: DemoLink) => (
            <div key={demo.id} className="card space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-100">{demo.label}</h3>
                  <span className="badge bg-blue-900/40 text-blue-300 text-xs mt-1">
                    {demo.industry}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEdit(demo)}
                    className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this demo link?')) deleteMutation.mutate(demo.id);
                    }}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <a
                href={demo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 truncate"
              >
                <ExternalLink size={14} className="flex-shrink-0" />
                <span className="truncate">{demo.url}</span>
              </a>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-slate-100">
                {creating ? 'Add Demo Link' : 'Edit Demo Link'}
              </h2>
              <button
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-200 rounded"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="label">Label</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Restaurant Demo Site"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                />
              </div>

              <div>
                <label className="label">Industry</label>
                <select
                  className="select w-full"
                  value={form.industry}
                  onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value, customIndustry: '' }))}
                >
                  <option value="">Select industry...</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind} value={ind}>{ind}</option>
                  ))}
                  <option value="custom">Custom...</option>
                </select>
                {form.industry === 'custom' && (
                  <input
                    type="text"
                    className="input mt-2"
                    placeholder="e.g., Thai Restaurant, Tattoo Studio"
                    value={form.customIndustry}
                    onChange={(e) => setForm((f) => ({ ...f, customIndustry: e.target.value }))}
                  />
                )}
              </div>

              <div>
                <label className="label">Demo URL</label>
                <input
                  type="url"
                  className="input"
                  placeholder="https://your-demo-site.com"
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex gap-2 p-4 border-t border-slate-800">
              <button
                className="btn-primary flex-1"
                onClick={() => (creating ? createMutation.mutate() : updateMutation.mutate())}
                disabled={
                  !form.label || !form.industry || (form.industry === 'custom' && !form.customIndustry) || !form.url ||
                  createMutation.isPending || updateMutation.isPending
                }
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : creating
                  ? 'Add Demo Link'
                  : 'Save Changes'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setCreating(false);
                  setEditing(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
