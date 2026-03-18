import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3, TrendingUp, Mail, Users, MousePointerClick, MessageSquare,
  AlertTriangle, Star, DollarSign, Plus, Trash2, X,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, FunnelChart, Funnel, LabelList, Cell,
} from 'recharts';
import toast from 'react-hot-toast';
import { analyticsApi } from '../lib/api';
import api from '../lib/api';
import { getStatusColor, getStatusLabel, formatDateTime } from '../lib/utils';

function MetricCard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${color}`}><Icon size={18} className="text-white" /></div>
      </div>
    </div>
  );
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FUNNEL_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#10b981'];

export default function Analytics() {
  const qc = useQueryClient();
  const [showRevenueModal, setShowRevenueModal] = useState(false);
  const [revenueForm, setRevenueForm] = useState({ amount: '', description: '', date: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => analyticsApi.get().then((r) => r.data),
    refetchInterval: 60000,
  });

  const { data: charts } = useQuery({
    queryKey: ['analytics-charts'],
    queryFn: () => api.get('/analytics/charts').then((r) => r.data),
    refetchInterval: 300000,
  });

  const { data: revenueData } = useQuery({
    queryKey: ['revenue'],
    queryFn: () => api.get('/revenue').then((r) => r.data),
  });

  const addRevenueMutation = useMutation({
    mutationFn: () => api.post('/revenue', {
      amount: parseFloat(revenueForm.amount),
      description: revenueForm.description || undefined,
      date: revenueForm.date || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['revenue'] });
      setShowRevenueModal(false);
      setRevenueForm({ amount: '', description: '', date: '' });
      toast.success('Revenue logged');
    },
    onError: () => toast.error('Failed to log revenue'),
  });

  const deleteRevenueMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/revenue/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['revenue'] });
      toast.success('Entry deleted');
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <div key={i} className="card animate-pulse h-24" />)}
        </div>
      </div>
    );
  }

  const { leads, emails, recentEmails, recentLeads } = data || {};
  const totalRevenue: number = revenueData?.total || 0;

  // Estimated API costs (rough)
  const totalLeads = leads?.total || 0;
  const emailsSent = emails?.sent || 0;
  const estimatedCosts =
    Math.round((totalLeads / 20) * 0.02 * 100) / 100 + // Google Places (~$0.02/20 results)
    Math.round(emailsSent * 0.02 * 100) / 100 +        // Claude (~$0.02/generation)
    Math.round(emailsSent * 0.001 * 100) / 100;         // SendGrid (~$0.001/email)
  const roi = totalRevenue - estimatedCosts;

  // Format daily chart data
  const dailyData = (charts?.dailyEmails || []).map((d: { date: string; sent: number }) => ({
    ...d,
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  // Heatmap: build 7×24 grid
  const heatmapGrid: Record<string, number> = {};
  for (const item of (charts?.heatmapData || [])) {
    heatmapGrid[`${item.day}-${item.hour}`] = item.opens;
  }
  const maxHeat = Math.max(1, ...Object.values(heatmapGrid));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Analytics</h1>
          <p className="text-slate-400 text-sm mt-1">Campaign performance overview</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowRevenueModal(true)}>
          <DollarSign size={15} /> Log Revenue
        </button>
      </div>

      {/* Lead Metrics */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Total Leads" value={leads?.total || 0} icon={Users} color="bg-blue-600" />
        <MetricCard label="New" value={leads?.new || 0} sub="Not yet contacted" icon={Users} color="bg-slate-600" />
        <MetricCard label="Contacted" value={leads?.contacted || 0} icon={Mail} color="bg-indigo-600" />
        <MetricCard label="Converted" value={leads?.converted || 0} sub={`${emails?.conversionRate || 0}% conversion rate`} icon={Star} color="bg-green-600" />
      </div>

      {/* Email Metrics */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Emails Sent" value={emails?.sent || 0} icon={Mail} color="bg-blue-600" />
        <MetricCard label="Open Rate" value={`${emails?.openRate || 0}%`} sub={`${emails?.opened || 0} opened`} icon={TrendingUp} color="bg-purple-600" />
        <MetricCard label="Reply Rate" value={`${emails?.replyRate || 0}%`} sub={`${emails?.replied || 0} replied`} icon={MessageSquare} color="bg-yellow-600" />
        <MetricCard label="Bounced" value={emails?.bounced || 0} icon={AlertTriangle} color="bg-red-600" />
      </div>

      {/* ROI */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <MetricCard label="Total Revenue" value={`$${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} sub="From converted clients" icon={DollarSign} color="bg-emerald-600" />
        <MetricCard label="Est. API Costs" value={`$${estimatedCosts.toFixed(2)}`} sub="Google + Claude + SendGrid" icon={BarChart3} color="bg-slate-600" />
        <MetricCard
          label="ROI"
          value={roi >= 0 ? `+$${roi.toFixed(2)}` : `-$${Math.abs(roi).toFixed(2)}`}
          sub="Revenue minus estimated costs"
          icon={TrendingUp}
          color={roi >= 0 ? 'bg-green-600' : 'bg-red-600'}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Line chart: emails per day */}
        <div className="card">
          <h2 className="text-base font-semibold text-slate-100 mb-4">Emails Sent (Last 30 Days)</h2>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} interval={6} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8' }}
                  itemStyle={{ color: '#60a5fa' }}
                />
                <Line type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-600 text-sm">No data yet</div>
          )}
        </div>

        {/* Bar chart: by industry */}
        <div className="card">
          <h2 className="text-base font-semibold text-slate-100 mb-4">Performance by Industry</h2>
          {charts?.byIndustry?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={charts.byIndustry} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis dataKey="industry" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} width={100} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Bar dataKey="sent" name="Sent" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="opened" name="Opened" fill="#6366f1" radius={[0, 4, 4, 0]} />
                <Bar dataKey="replied" name="Replied" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-600 text-sm">No data yet</div>
          )}
        </div>
      </div>

      {/* Funnel + Heatmap */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Conversion funnel */}
        <div className="card">
          <h2 className="text-base font-semibold text-slate-100 mb-4">Conversion Funnel</h2>
          {charts?.funnel?.some((f: { count: number }) => f.count > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <FunnelChart>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Funnel dataKey="count" data={charts.funnel} isAnimationActive>
                  {charts.funnel.map((_: unknown, index: number) => (
                    <Cell key={index} fill={FUNNEL_COLORS[index % FUNNEL_COLORS.length]} />
                  ))}
                  <LabelList position="right" fill="#94a3b8" stroke="none" dataKey="stage" style={{ fontSize: 12 }} />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          ) : (
            <div className="space-y-2">
              {(charts?.funnel || [
                { stage: 'Scraped', count: leads?.total || 0 },
                { stage: 'Contacted', count: leads?.contacted || 0 },
                { stage: 'Converted', count: leads?.converted || 0 },
              ]).map((step: { stage: string; count: number }, i: number) => {
                const max = charts?.funnel?.[0]?.count || leads?.total || 1;
                const pct = max > 0 ? Math.round((step.count / max) * 100) : 0;
                return (
                  <div key={step.stage} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-24 text-right">{step.stage}</span>
                    <div className="flex-1 bg-slate-800 rounded-full h-2">
                      <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }} />
                    </div>
                    <span className="text-xs text-slate-500 w-10">{step.count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Open rate heatmap */}
        <div className="card">
          <h2 className="text-base font-semibold text-slate-100 mb-1">Best Times for Opens</h2>
          <p className="text-xs text-slate-500 mb-4">Day of week × hour of day</p>
          <div className="overflow-x-auto">
            <div className="flex gap-0.5">
              {/* Y-axis labels */}
              <div className="flex flex-col gap-0.5 mr-1">
                <div className="h-4" /> {/* spacer for hour labels */}
                {DAY_NAMES.map((d) => (
                  <div key={d} className="h-4 flex items-center text-xs text-slate-600 w-6">{d}</div>
                ))}
              </div>
              {/* Grid */}
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="flex flex-col gap-0.5">
                  <div className="h-4 flex items-center justify-center text-xs text-slate-600" style={{ fontSize: 9 }}>
                    {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
                  </div>
                  {DAY_NAMES.map((_, dayIdx) => {
                    const val = heatmapGrid[`${dayIdx}-${h}`] || 0;
                    const opacity = val > 0 ? 0.2 + (val / maxHeat) * 0.8 : 0.05;
                    return (
                      <div
                        key={dayIdx}
                        className="w-4 h-4 rounded-sm"
                        style={{ background: `rgba(59,130,246,${opacity})` }}
                        title={`${DAY_NAMES[dayIdx]} ${h}:00 — ${val} opens`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          {Object.keys(heatmapGrid).length === 0 && (
            <p className="text-slate-600 text-sm text-center mt-4">No open data yet</p>
          )}
        </div>
      </div>

      {/* Pipeline Breakdown */}
      {leads?.byStatus && (
        <div className="card">
          <h2 className="text-base font-semibold text-slate-100 mb-4">Pipeline Breakdown</h2>
          <div className="space-y-2">
            {['NEW', 'CONTACTED', 'OPENED', 'REPLIED', 'CALL_BOOKED', 'CONVERTED', 'LOST'].map((status) => {
              const count = leads.byStatus[status] || 0;
              const pct = leads.total > 0 ? Math.round((count / leads.total) * 100) : 0;
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className={`badge ${getStatusColor(status)} w-28 justify-center`}>{getStatusLabel(status)}</span>
                  <div className="flex-1 bg-slate-800 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm text-slate-400 w-16 text-right">{count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Revenue Log */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-100">Revenue Log</h2>
          <button className="btn-primary flex items-center gap-1.5 text-sm py-1.5" onClick={() => setShowRevenueModal(true)}>
            <Plus size={14} /> Log Revenue
          </button>
        </div>
        {revenueData?.entries?.length ? (
          <div className="space-y-1">
            {revenueData.entries.map((entry: { id: string; amount: number; description?: string; date: string; lead?: { businessName: string } }) => (
              <div key={entry.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <div>
                  <p className="text-sm text-slate-200">
                    {entry.lead?.businessName ? `${entry.lead.businessName}` : 'General Revenue'}
                    {entry.description && <span className="text-slate-500"> — {entry.description}</span>}
                  </p>
                  <p className="text-xs text-slate-600">{new Date(entry.date).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-green-400 font-semibold">${entry.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  <button
                    onClick={() => deleteRevenueMutation.mutate(entry.id)}
                    className="p-1 text-slate-600 hover:text-red-400 rounded"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
            <div className="pt-2 flex justify-end">
              <span className="text-sm font-semibold text-green-400">
                Total: ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-slate-500 text-sm text-center py-6">No revenue logged yet. Log a client payment to track ROI.</p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-base font-semibold text-slate-100 mb-4">Recent Emails</h2>
          {recentEmails?.length ? (
            <div className="space-y-2">
              {recentEmails.map((email: { id: string; subject: string; status: string; sentAt: string; lead: { businessName: string } }) => (
                <div key={email.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-200 truncate">{email.lead?.businessName}</p>
                    <p className="text-xs text-slate-500 truncate">{email.subject}</p>
                  </div>
                  <div className="ml-3 flex flex-col items-end gap-1">
                    <span className={`badge ${getStatusColor(email.status)} text-xs`}>{getStatusLabel(email.status)}</span>
                    <span className="text-xs text-slate-600">{formatDateTime(email.sentAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm text-center py-6">No emails sent yet</p>
          )}
        </div>
        <div className="card">
          <h2 className="text-base font-semibold text-slate-100 mb-4">Recent Leads</h2>
          {recentLeads?.length ? (
            <div className="space-y-2">
              {recentLeads.map((lead: { id: string; businessName: string; status: string; createdAt: string }) => (
                <div key={lead.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{lead.businessName}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(lead.createdAt)}</p>
                  </div>
                  <span className={`badge ${getStatusColor(lead.status)}`}>{getStatusLabel(lead.status)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm text-center py-6">No leads yet</p>
          )}
        </div>
      </div>

      {/* Revenue Modal */}
      {showRevenueModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h2 className="text-base font-semibold text-slate-100">Log Revenue</h2>
              <button onClick={() => setShowRevenueModal(false)} className="p-2 text-slate-400 hover:text-slate-200 rounded">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="label">Amount ($)</label>
                <input type="number" className="input" placeholder="1500.00" min="0" step="0.01"
                  value={revenueForm.amount} onChange={(e) => setRevenueForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div>
                <label className="label">Description (optional)</label>
                <input type="text" className="input" placeholder="Website design for Joe's Diner"
                  value={revenueForm.description} onChange={(e) => setRevenueForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="label">Date (optional)</label>
                <input type="date" className="input"
                  value={revenueForm.date} onChange={(e) => setRevenueForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-slate-800">
              <button className="btn-primary flex-1" disabled={!revenueForm.amount || addRevenueMutation.isPending}
                onClick={() => addRevenueMutation.mutate()}>
                {addRevenueMutation.isPending ? 'Saving...' : 'Log Revenue'}
              </button>
              <button className="btn-secondary" onClick={() => setShowRevenueModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
