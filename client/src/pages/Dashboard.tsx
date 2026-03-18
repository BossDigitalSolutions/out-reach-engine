import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  Mail,
  TrendingUp,
  Search,
  ArrowRight,
  Star,
  Flame,
} from 'lucide-react';
import { analyticsApi } from '../lib/api';
import api from '../lib/api';
import { getStatusColor, getStatusLabel, formatDateTime } from '../lib/utils';

function ScoreBadge({ score }: { score?: number }) {
  if (score == null) return null;
  let cls = 'bg-slate-800 text-slate-400';
  if (score >= 80) cls = 'bg-green-900/50 text-green-300';
  else if (score >= 60) cls = 'bg-blue-900/40 text-blue-300';
  else if (score >= 40) cls = 'bg-yellow-900/40 text-yellow-300';
  return <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${cls}`}>{score}</span>;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="text-3xl font-bold text-slate-100 mt-1">{value}</p>
          {sub && <p className="text-sm text-slate-500 mt-1">{sub}</p>}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => analyticsApi.get().then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: hotLeadsData } = useQuery({
    queryKey: ['hot-leads'],
    queryFn: () =>
      api.get('/leads', { params: { sortBy: 'score', limit: 20, status: 'NEW' } }).then((r) => r.data),
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-24 mb-3" />
              <div className="h-8 bg-slate-800 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const stats = data;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Your outreach overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Leads"
          value={stats?.leads.total || 0}
          sub={`${stats?.leads.new || 0} new`}
          icon={Users}
          color="bg-blue-600"
        />
        <StatCard
          label="Emails Sent"
          value={stats?.emails.sent || 0}
          sub={`${stats?.emails.scheduled || 0} scheduled`}
          icon={Mail}
          color="bg-indigo-600"
        />
        <StatCard
          label="Open Rate"
          value={`${stats?.emails.openRate || 0}%`}
          sub={`${stats?.emails.opened || 0} opened`}
          icon={TrendingUp}
          color="bg-purple-600"
        />
        <StatCard
          label="Converted"
          value={stats?.leads.converted || 0}
          sub={`${stats?.emails.replyRate || 0}% reply rate`}
          icon={Star}
          color="bg-green-600"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="card">
          <h2 className="text-base font-semibold text-slate-100 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <Link
              to="/scraper"
              className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600/20 rounded-lg">
                  <Search size={16} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">Scrape New Leads</p>
                  <p className="text-xs text-slate-500">Find businesses by industry & location</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
            </Link>
            <Link
              to="/leads"
              className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-600/20 rounded-lg">
                  <Users size={16} className="text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">View All Leads</p>
                  <p className="text-xs text-slate-500">
                    {stats?.leads.total || 0} leads in your pipeline
                  </p>
                </div>
              </div>
              <ArrowRight size={16} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
            </Link>
            <Link
              to="/analytics"
              className="flex items-center justify-between p-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-600/20 rounded-lg">
                  <TrendingUp size={16} className="text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">View Analytics</p>
                  <p className="text-xs text-slate-500">Full campaign performance breakdown</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
            </Link>
          </div>
        </div>

        {/* Recent Leads */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-100">Recent Leads</h2>
            <Link to="/leads" className="text-xs text-blue-400 hover:text-blue-300">
              View all →
            </Link>
          </div>
          {stats?.recentLeads?.length ? (
            <div className="space-y-2">
              {stats.recentLeads.map(
                (lead: { id: string; businessName: string; status: string; createdAt: string }) => (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-200">{lead.businessName}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(lead.createdAt)}</p>
                    </div>
                    <span className={`badge ${getStatusColor(lead.status)}`}>
                      {getStatusLabel(lead.status)}
                    </span>
                  </div>
                )
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Users size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No leads yet. Start scraping!</p>
            </div>
          )}
        </div>
      </div>

      {/* Hot Leads */}
      {hotLeadsData?.leads?.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame size={18} className="text-orange-400" />
              <h2 className="text-base font-semibold text-slate-100">Hot Leads</h2>
              <span className="text-xs text-slate-500">Top 20 highest-scored new leads</span>
            </div>
            <Link to="/leads?sortBy=score" className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left text-xs text-slate-500 font-medium pb-2 pr-4">Business</th>
                  <th className="text-left text-xs text-slate-500 font-medium pb-2 pr-4">Industry</th>
                  <th className="text-left text-xs text-slate-500 font-medium pb-2 pr-4">Location</th>
                  <th className="text-left text-xs text-slate-500 font-medium pb-2 pr-4">Website</th>
                  <th className="text-right text-xs text-slate-500 font-medium pb-2">Score</th>
                </tr>
              </thead>
              <tbody>
                {hotLeadsData.leads.slice(0, 20).map((lead: {
                  id: string; businessName: string; industry?: string; city?: string; state?: string;
                  hasWebsite: boolean; score?: number;
                }) => (
                  <tr key={lead.id} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30">
                    <td className="py-2 pr-4 font-medium text-slate-200">{lead.businessName}</td>
                    <td className="py-2 pr-4 text-xs text-slate-400">{lead.industry || '—'}</td>
                    <td className="py-2 pr-4 text-xs text-slate-400">{[lead.city, lead.state].filter(Boolean).join(', ') || '—'}</td>
                    <td className="py-2 pr-4">
                      {lead.hasWebsite
                        ? <span className="text-xs text-slate-500">Has site</span>
                        : <span className="text-xs text-orange-400 font-medium">No site</span>}
                    </td>
                    <td className="py-2 text-right"><ScoreBadge score={lead.score} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pipeline Overview */}
      {stats?.leads.byStatus && (
        <div className="card">
          <h2 className="text-base font-semibold text-slate-100 mb-4">Pipeline Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
            {[
              'NEW',
              'CONTACTED',
              'OPENED',
              'REPLIED',
              'CALL_BOOKED',
              'CONVERTED',
              'LOST',
            ].map((status) => (
              <div key={status} className="text-center">
                <div
                  className={`badge ${getStatusColor(status)} w-full justify-center mb-1`}
                >
                  {getStatusLabel(status)}
                </div>
                <p className="text-2xl font-bold text-slate-100">
                  {stats.leads.byStatus[status] || 0}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
