import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ScrollText, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { activityLogApi } from '../lib/api';

interface LogEntry {
  id: string;
  userId?: string;
  userEmail?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: { email: string; name?: string };
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN_SUCCESS: 'text-green-400 bg-green-900/20',
  LOGIN_FAILED: 'text-red-400 bg-red-900/20',
  LOGIN_LOCKED: 'text-orange-400 bg-orange-900/20',
  LOGOUT: 'text-slate-400 bg-slate-800',
  REGISTER: 'text-blue-400 bg-blue-900/20',
  EMAIL_SENT: 'text-blue-400 bg-blue-900/20',
  EMAIL_GENERATED: 'text-indigo-400 bg-indigo-900/20',
  WHATSAPP_SENT: 'text-green-400 bg-green-900/20',
  SETTINGS_UPDATED: 'text-yellow-400 bg-yellow-900/20',
  USER_INVITED: 'text-purple-400 bg-purple-900/20',
  USER_REMOVED: 'text-red-400 bg-red-900/20',
  USER_ROLE_CHANGED: 'text-amber-400 bg-amber-900/20',
  SESSION_REVOKED: 'text-orange-400 bg-orange-900/20',
  ALL_SESSIONS_REVOKED: 'text-red-400 bg-red-900/20',
  ADMIN_ACCESS_BLOCKED: 'text-red-500 bg-red-900/30',
  '2FA_ENABLED': 'text-green-400 bg-green-900/20',
  '2FA_DISABLED': 'text-orange-400 bg-orange-900/20',
  LEAD_DELETED: 'text-red-400 bg-red-900/20',
};

function ActionBadge({ action }: { action: string }) {
  const cls = ACTION_COLORS[action] || 'text-slate-400 bg-slate-800';
  return (
    <span className={`inline-flex items-center text-xs font-mono px-2 py-0.5 rounded ${cls}`}>
      {action.replace(/_/g, ' ')}
    </span>
  );
}

export default function ActivityLog() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    action: '',
    userId: '',
    dateFrom: '',
    dateTo: '',
  });
  const [applied, setApplied] = useState(filters);

  const { data, isLoading } = useQuery({
    queryKey: ['activity-log', applied, page],
    queryFn: () =>
      activityLogApi
        .list({
          ...(applied.action && { action: applied.action }),
          ...(applied.userId && { userId: applied.userId }),
          ...(applied.dateFrom && { dateFrom: applied.dateFrom }),
          ...(applied.dateTo && { dateTo: applied.dateTo }),
          page,
          limit: 50,
        })
        .then((r) => r.data),
  });

  const { data: actions = [] } = useQuery({
    queryKey: ['activity-log-actions'],
    queryFn: () => activityLogApi.actions().then((r) => r.data),
  });

  const logs: LogEntry[] = data?.logs || [];
  const total: number = data?.total || 0;
  const totalPages = Math.ceil(total / 50);

  const applyFilters = () => {
    setApplied(filters);
    setPage(1);
  };

  const clearFilters = () => {
    const empty = { action: '', userId: '', dateFrom: '', dateTo: '' };
    setFilters(empty);
    setApplied(empty);
    setPage(1);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Activity Log</h1>
        <p className="text-slate-400 text-sm mt-1">
          Complete audit trail of all actions in the system
        </p>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="label">Action</label>
            <select
              className="select w-full"
              value={filters.action}
              onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
            >
              <option value="">All actions</option>
              {(actions as string[]).map((a) => (
                <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Date from</label>
            <input
              type="date"
              className="input"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
            />
          </div>
          <div>
            <label className="label">Date to</label>
            <input
              type="date"
              className="input"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
            />
          </div>
          <div className="flex items-end gap-2">
            <button className="btn-primary flex items-center gap-2 flex-1" onClick={applyFilters}>
              <Search size={14} />
              Filter
            </button>
            <button className="btn-secondary" onClick={clearFilters}>
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Log table */}
      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <ScrollText size={40} className="mx-auto text-slate-700 mb-3" />
            <p className="text-slate-500">No activity found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-800">
                  <tr>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Time</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">User</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Action</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Details</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/20">
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-slate-300">
                          {log.user?.email || log.userEmail || 'Unknown'}
                        </p>
                        {log.user?.name && (
                          <p className="text-xs text-slate-500">{log.user.name}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-xs">
                        {log.metadata
                          ? Object.entries(log.metadata)
                              .filter(([, v]) => v !== null && v !== undefined)
                              .map(([k, v]) => `${k}: ${String(v).substring(0, 40)}`)
                              .join(' · ')
                          : null}
                        {log.targetType && !log.metadata && (
                          <span>{log.targetType} {log.targetId?.substring(0, 8)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                        {log.ipAddress}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
                <p className="text-xs text-slate-500">
                  {total} total entries
                </p>
                <div className="flex items-center gap-2">
                  <button
                    className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-30"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs text-slate-400">
                    {page} / {totalPages}
                  </span>
                  <button
                    className="p-1.5 text-slate-400 hover:text-slate-200 disabled:opacity-30"
                    disabled={page === totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
