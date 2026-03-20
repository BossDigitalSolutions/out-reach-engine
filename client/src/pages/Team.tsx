import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Shield, User, X, Lock, Unlock, LogOut, Monitor } from 'lucide-react';
import toast from 'react-hot-toast';
import { teamApi, sessionsApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface TeamMember {
  id: string;
  email: string;
  name?: string;
  role: 'ADMIN' | 'MEMBER';
  isSuperAdmin?: boolean;
  lastLoginAt?: string;
  lastLoginIp?: string;
  twoFactorEnabled: boolean;
  lockedUntil?: string;
  createdAt: string;
}

const DEFAULT_FORM = { email: '', password: '', name: '', role: 'MEMBER' as 'ADMIN' | 'MEMBER' };

const PASSWORD_HINT = 'Min 10 chars with uppercase, lowercase, number & special character';

export default function Team() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [showAllSessions, setShowAllSessions] = useState(false);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['team'],
    queryFn: () => teamApi.list().then((r) => r.data),
  });

  const { data: allSessions = [] } = useQuery({
    queryKey: ['sessions-all'],
    queryFn: () => sessionsApi.listAll().then((r) => r.data),
    enabled: showAllSessions,
  });

  const createMutation = useMutation({
    mutationFn: () => teamApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      setCreating(false);
      setForm(DEFAULT_FORM);
      toast.success('Team member added');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to add member';
      toast.error(msg);
    },
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: 'ADMIN' | 'MEMBER' }) =>
      teamApi.setRole(id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      toast.success('Role updated');
    },
    onError: () => toast.error('Failed to update role'),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => teamApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      toast.success('Member removed');
    },
    onError: () => toast.error('Failed to remove member'),
  });

  const unlockMutation = useMutation({
    mutationFn: (id: string) => teamApi.unlock(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team'] });
      toast.success('Account unlocked');
    },
    onError: () => toast.error('Failed to unlock account'),
  });

  const forceLogoutMutation = useMutation({
    mutationFn: (userId: string) => sessionsApi.forceLogout(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions-all'] });
      toast.success('User logged out from all sessions');
    },
    onError: () => toast.error('Failed to force logout'),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Team</h1>
          <p className="text-slate-400 text-sm mt-1">Manage team members and their access</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setCreating(true)}>
          <Plus size={16} />
          Add Member
        </button>
      </div>

      {/* Members table */}
      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-slate-800">
              <tr>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">User</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Role</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">2FA</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Last Login</th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(members as TeamMember[]).map((member) => {
                const isLocked = member.lockedUntil && new Date(member.lockedUntil) > new Date();
                const isSelf = member.id === user?.id;
                return (
                  <tr key={member.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-blue-400">
                            {(member.name || member.email)[0].toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-200">
                            {member.name || member.email}
                            {isSelf && <span className="ml-1.5 text-xs text-slate-500">(you)</span>}
                          </p>
                          {member.name && (
                            <p className="text-xs text-slate-500">{member.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {member.isSuperAdmin ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-amber-900/30 text-amber-300 px-2 py-1 rounded">
                          <Shield size={11} />
                          Super Admin
                        </span>
                      ) : (
                        <select
                          className="select text-xs py-1 px-2"
                          value={member.role}
                          disabled={isSelf}
                          onChange={(e) =>
                            roleMutation.mutate({ id: member.id, role: e.target.value as 'ADMIN' | 'MEMBER' })
                          }
                        >
                          <option value="MEMBER">Member</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded ${
                        member.twoFactorEnabled
                          ? 'bg-green-900/30 text-green-400'
                          : 'bg-slate-800 text-slate-500'
                      }`}>
                        {member.twoFactorEnabled ? 'Enabled' : 'Off'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {member.lastLoginAt
                        ? new Date(member.lastLoginAt).toLocaleString()
                        : 'Never'}
                      {member.lastLoginIp && (
                        <p className="text-slate-600">{member.lastLoginIp}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isLocked ? (
                        <span className="text-xs bg-red-900/30 text-red-400 px-2 py-1 rounded">Locked</span>
                      ) : (
                        <span className="text-xs bg-green-900/20 text-green-500 px-2 py-1 rounded">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {isLocked && !member.isSuperAdmin && (
                          <button
                            onClick={() => unlockMutation.mutate(member.id)}
                            className="p-1.5 text-slate-500 hover:text-green-400 hover:bg-slate-800 rounded"
                            title="Unlock account"
                          >
                            <Unlock size={13} />
                          </button>
                        )}
                        {!isSelf && !member.isSuperAdmin && (
                          <>
                            <button
                              onClick={() => {
                                if (confirm(`Force-logout ${member.email} from all sessions?`))
                                  forceLogoutMutation.mutate(member.id);
                              }}
                              className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-slate-800 rounded"
                              title="Force logout"
                            >
                              <LogOut size={13} />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Remove ${member.email}? This cannot be undone.`))
                                  removeMutation.mutate(member.id);
                              }}
                              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded"
                              title="Remove member"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Active Sessions Panel */}
      <div className="card">
        <button
          className="flex items-center gap-2 text-sm font-medium text-slate-300 w-full text-left"
          onClick={() => setShowAllSessions((v) => !v)}
        >
          <Monitor size={16} className="text-slate-400" />
          Active Sessions Across All Users
          <span className="ml-auto text-xs text-slate-500">{showAllSessions ? 'Hide' : 'Show'}</span>
        </button>

        {showAllSessions && (
          <div className="mt-4 space-y-2">
            {allSessions.length === 0 ? (
              <p className="text-slate-500 text-sm">No active sessions</p>
            ) : (
              allSessions.map((session: {
                id: string;
                user?: { email: string; name?: string };
                ipAddress?: string;
                userAgent?: string;
                lastActiveAt: string;
                createdAt: string;
              }) => (
                <div key={session.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                  <User size={14} className="text-slate-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-300">{session.user?.email}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {session.ipAddress} · {session.userAgent?.split(' ')[0]}
                    </p>
                    <p className="text-xs text-slate-600">
                      Last active: {new Date(session.lastActiveAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('Force-logout this session?'))
                        forceLogoutMutation.mutate(session.id);
                    }}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded"
                    title="Revoke session"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Add Member Modal */}
      {creating && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-slate-100">Add Team Member</h2>
              <button
                onClick={() => { setCreating(false); setForm(DEFAULT_FORM); }}
                className="p-2 text-slate-400 hover:text-slate-200 rounded"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="label">Name (optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Full name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="member@example.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Temporary password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
                <p className="text-xs text-slate-500 mt-1">{PASSWORD_HINT}</p>
              </div>
              <div>
                <label className="label">Role</label>
                <select
                  className="select w-full"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'ADMIN' | 'MEMBER' }))}
                >
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 p-4 border-t border-slate-800">
              <button
                className="btn-primary flex-1"
                onClick={() => createMutation.mutate()}
                disabled={!form.email || !form.password || createMutation.isPending}
              >
                {createMutation.isPending ? 'Adding...' : 'Add Member'}
              </button>
              <button
                className="btn-secondary"
                onClick={() => { setCreating(false); setForm(DEFAULT_FORM); }}
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
