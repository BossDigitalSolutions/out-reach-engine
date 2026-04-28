import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, StopCircle, RefreshCw, ChevronDown, ChevronUp, Clock, CheckCircle, XCircle, Pause, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { ghlApi } from '../lib/api';

interface SmsSequence {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'REPLIED' | 'COMPLETED' | 'STOPPED';
  currentStep: number;
  message1: string | null;
  message2: string | null;
  message3: string | null;
  message1SentAt: string | null;
  message2SentAt: string | null;
  message3SentAt: string | null;
  nextSendAt: string | null;
  repliedAt: string | null;
  createdAt: string;
  lead: {
    businessName: string;
    ownerName: string | null;
    phone: string | null;
    industry: string | null;
    city: string | null;
  };
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    PENDING: { cls: 'bg-yellow-900/40 text-yellow-300 border-yellow-800/50', label: 'Pending', icon: <Clock size={12} /> },
    ACTIVE: { cls: 'bg-blue-900/40 text-blue-300 border-blue-800/50', label: 'Active', icon: <Zap size={12} /> },
    REPLIED: { cls: 'bg-green-900/40 text-green-300 border-green-800/50', label: 'Replied', icon: <CheckCircle size={12} /> },
    COMPLETED: { cls: 'bg-slate-800 text-slate-400 border-slate-700', label: 'Completed', icon: <CheckCircle size={12} /> },
    STOPPED: { cls: 'bg-red-900/40 text-red-300 border-red-800/50', label: 'Stopped', icon: <XCircle size={12} /> },
  };
  const s = map[status] || map.PENDING;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold rounded border px-2 py-0.5 ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
}

function StepIndicator({ step, sentAt, label }: { step: number; sentAt: string | null; label: string }) {
  const sent = !!sentAt;
  return (
    <div className={`flex items-center gap-2 text-xs ${sent ? 'text-green-400' : 'text-slate-500'}`}>
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${sent ? 'bg-green-900/50 border border-green-700' : 'bg-slate-800 border border-slate-700'}`}>
        {step}
      </div>
      <span>{label}</span>
      {sent && <span className="text-slate-500 ml-1">{formatDate(sentAt)}</span>}
    </div>
  );
}

export default function SmsSequences() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['sms-sequences', statusFilter],
    queryFn: () =>
      ghlApi.sequenceStatus(statusFilter ? { status: statusFilter } : undefined).then((r) => r.data),
    refetchInterval: 30000,
  });

  const sequences: SmsSequence[] = data?.sequences || [];

  const stopMutation = useMutation({
    mutationFn: (sequenceId: string) => ghlApi.stopSequence(sequenceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sms-sequences'] });
      toast.success('Sequence stopped');
    },
    onError: () => toast.error('Failed to stop sequence'),
  });

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeCount = sequences.filter((s) => s.status === 'ACTIVE' || s.status === 'PENDING').length;
  const repliedCount = sequences.filter((s) => s.status === 'REPLIED').length;
  const completedCount = sequences.filter((s) => s.status === 'COMPLETED').length;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare size={24} /> SMS Sequences
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            3-message outreach sequences — Day 0, Day 3, Day 10
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card flex items-center gap-3 py-3">
          <div className="w-10 h-10 rounded-lg bg-blue-900/30 flex items-center justify-center">
            <Zap size={18} className="text-blue-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-white">{activeCount}</p>
            <p className="text-xs text-slate-400">Active</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 py-3">
          <div className="w-10 h-10 rounded-lg bg-green-900/30 flex items-center justify-center">
            <CheckCircle size={18} className="text-green-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-white">{repliedCount}</p>
            <p className="text-xs text-slate-400">Replied</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 py-3">
          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
            <CheckCircle size={18} className="text-slate-400" />
          </div>
          <div>
            <p className="text-xl font-bold text-white">{completedCount}</p>
            <p className="text-xs text-slate-400">Completed</p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <select
          className="select text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="ACTIVE">Active</option>
          <option value="REPLIED">Replied</option>
          <option value="COMPLETED">Completed</option>
          <option value="STOPPED">Stopped</option>
        </select>
        <span className="text-sm text-slate-500">{sequences.length} sequence{sequences.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Sequence List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card animate-pulse h-20" />
          ))}
        </div>
      ) : sequences.length === 0 ? (
        <div className="card text-center py-12">
          <MessageSquare size={40} className="mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400">No SMS sequences yet.</p>
          <p className="text-sm text-slate-500 mt-1">Select leads and click "SMS Sequence" on the Leads page to start.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sequences.map((seq) => (
            <div key={seq.id} className="card p-0 overflow-hidden">
              {/* Row header */}
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors"
                onClick={() => toggle(seq.id)}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <StatusBadge status={seq.status} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{seq.lead.businessName}</p>
                    <p className="text-xs text-slate-500">
                      {seq.lead.ownerName || 'No owner'} · {seq.lead.phone} · {seq.lead.industry} · {seq.lead.city}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {/* Step progress */}
                  <div className="hidden sm:flex items-center gap-1.5">
                    <StepIndicator step={1} sentAt={seq.message1SentAt} label="Hook" />
                    <span className="text-slate-700">→</span>
                    <StepIndicator step={2} sentAt={seq.message2SentAt} label="Nudge" />
                    <span className="text-slate-700">→</span>
                    <StepIndicator step={3} sentAt={seq.message3SentAt} label="Close" />
                  </div>
                  {/* Next send */}
                  {seq.nextSendAt && (seq.status === 'PENDING' || seq.status === 'ACTIVE') && (
                    <div className="text-xs text-slate-500 hidden md:block">
                      <Clock size={11} className="inline mr-1" />
                      Next: {formatDate(seq.nextSendAt)}
                    </div>
                  )}
                  {/* Stop button */}
                  {(seq.status === 'PENDING' || seq.status === 'ACTIVE') && (
                    <button
                      onClick={(e) => { e.stopPropagation(); stopMutation.mutate(seq.id); }}
                      className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-900/20"
                      title="Stop sequence"
                    >
                      <StopCircle size={14} /> Stop
                    </button>
                  )}
                  {expanded.has(seq.id) ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                </div>
              </div>

              {/* Expanded details */}
              {expanded.has(seq.id) && (
                <div className="border-t border-slate-800 px-4 py-3 space-y-3 bg-slate-900/50">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { step: 1, label: 'Day 0 — The Hook', msg: seq.message1, sent: seq.message1SentAt },
                      { step: 2, label: 'Day 3 — The Nudge', msg: seq.message2, sent: seq.message2SentAt },
                      { step: 3, label: 'Day 10 — The Close', msg: seq.message3, sent: seq.message3SentAt },
                    ].map((m) => (
                      <div key={m.step} className={`rounded-lg border p-3 ${m.sent ? 'border-green-800/40 bg-green-900/10' : seq.currentStep === m.step && (seq.status === 'PENDING' || seq.status === 'ACTIVE') ? 'border-blue-800/40 bg-blue-900/10' : 'border-slate-800 bg-slate-900/30'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-400">{m.label}</span>
                          {m.sent ? (
                            <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle size={10} /> Sent</span>
                          ) : seq.currentStep === m.step && (seq.status === 'PENDING' || seq.status === 'ACTIVE') ? (
                            <span className="text-xs text-blue-400 flex items-center gap-1"><Clock size={10} /> Queued</span>
                          ) : (
                            <span className="text-xs text-slate-600">Waiting</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{m.msg || '—'}</p>
                        {m.sent && <p className="text-xs text-slate-500 mt-2">{formatDate(m.sent)}</p>}
                      </div>
                    ))}
                  </div>
                  {seq.repliedAt && (
                    <div className="text-xs text-green-400 flex items-center gap-1">
                      <CheckCircle size={12} /> Lead replied at {formatDate(seq.repliedAt)}
                    </div>
                  )}
                  <p className="text-xs text-slate-600">Created {formatDate(seq.createdAt)}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
