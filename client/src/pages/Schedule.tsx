import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, Trash2, Mail, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { emailsApi } from '../lib/api';

interface ScheduledEmail {
  id: string;
  subject: string;
  body: string;
  scheduledAt: string;
  status: string;
  lead: { businessName: string; email: string };
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Schedule() {
  const qc = useQueryClient();
  const [preview, setPreview] = useState<ScheduledEmail | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['scheduled-emails'],
    queryFn: () =>
      emailsApi
        .list({ status: 'SCHEDULED', limit: 200, sortBy: 'scheduledAt' })
        .then((r) => r.data),
    refetchInterval: 30000,
  });

  const emails: ScheduledEmail[] = data?.emails || [];

  const cancelMutation = useMutation({
    mutationFn: (id: string) => emailsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled-emails'] });
      toast.success('Cancelled');
      if (preview) setPreview(null);
    },
    onError: () => toast.error('Failed to cancel'),
  });

  // Group by day
  const grouped: Record<string, ScheduledEmail[]> = {};
  for (const email of emails) {
    const day = new Date(email.scheduledAt).toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(email);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Scheduled Emails</h1>
          <p className="text-slate-400 text-sm mt-1">
            {emails.length} email{emails.length !== 1 ? 's' : ''} queued
          </p>
        </div>
        <button
          className="btn-secondary flex items-center gap-2 text-xs"
          onClick={() => refetch()}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="card space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-800 rounded animate-pulse" />
          ))}
        </div>
      ) : emails.length === 0 ? (
        <div className="card text-center py-16">
          <Calendar size={48} className="mx-auto text-slate-700 mb-3" />
          <p className="text-slate-400 font-medium">No scheduled emails</p>
          <p className="text-slate-600 text-sm mt-1">
            Go to Leads, select leads, generate emails, then schedule them
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([day, dayEmails]) => (
            <div key={day}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={14} className="text-slate-500" />
                <span className="text-sm font-semibold text-slate-400">{day}</span>
                <span className="text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full">
                  {dayEmails.length} email{dayEmails.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="card p-0 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="table-header">Send time</th>
                      <th className="table-header">Business</th>
                      <th className="table-header">Recipient</th>
                      <th className="table-header">Subject</th>
                      <th className="table-header w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayEmails.map((email) => (
                      <tr
                        key={email.id}
                        className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="table-cell">
                          <div className="flex items-center gap-1.5 text-blue-400 text-sm font-medium">
                            <Clock size={13} />
                            {new Date(email.scheduledAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </td>
                        <td className="table-cell font-medium text-slate-200">
                          {email.lead.businessName}
                        </td>
                        <td className="table-cell text-slate-400 text-sm">
                          {email.lead.email}
                        </td>
                        <td className="table-cell text-slate-300 text-sm max-w-xs truncate">
                          <button
                            className="hover:text-blue-400 transition-colors text-left truncate max-w-xs"
                            onClick={() => setPreview(email)}
                            title="Preview email"
                          >
                            {email.subject}
                          </button>
                        </td>
                        <td className="table-cell">
                          <button
                            className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                            onClick={() => {
                              if (confirm('Cancel this scheduled email?')) {
                                cancelMutation.mutate(email.id);
                              }
                            }}
                            title="Cancel email"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {preview && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2 text-slate-300">
                <Mail size={16} />
                <span className="font-medium text-sm">{preview.lead.businessName}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-blue-400">
                <Clock size={12} />
                {formatDateTime(preview.scheduledAt)}
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Subject</p>
                <p className="text-slate-200 font-medium">{preview.subject}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Body</p>
                <pre className="text-sm text-slate-300 whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">
                  {preview.body}
                </pre>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 border-t border-slate-800">
              <button
                className="btn-danger text-xs flex items-center gap-1"
                onClick={() => {
                  if (confirm('Cancel this scheduled email?')) {
                    cancelMutation.mutate(preview.id);
                  }
                }}
              >
                <Trash2 size={13} />
                Cancel send
              </button>
              <button
                className="btn-secondary text-xs"
                onClick={() => setPreview(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
