import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  Users,
  Mail,
  Link,
  BarChart3,
  Settings,
  Zap,
  LogOut,
  X,
  UserCog,
  ScrollText,
  Shield,
  CalendarClock,
  MessageSquare,
  Bug,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const memberNavItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/scraper', icon: Search, label: 'Scraper' },
  { to: '/leads', icon: Users, label: 'Leads' },
  { to: '/templates', icon: Mail, label: 'Email Templates' },
  { to: '/demos', icon: Link, label: 'Demo Links' },
  { to: '/schedule', icon: CalendarClock, label: 'Scheduled Emails' },
  { to: '/sms-sequences', icon: MessageSquare, label: 'SMS Sequences' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
];

const adminNavItems = [
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/team', icon: UserCog, label: 'Team' },
  { to: '/activity-log', icon: ScrollText, label: 'Activity Log' },
  { to: '/admin/debug-enrichment', icon: Bug, label: 'Debug Enrichment' },
];

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const { user, logout, isAdmin } = useAuth();

  return (
    <div className="w-64 h-full bg-slate-900 border-r border-slate-800 flex flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Zap size={16} className="text-white" />
          </div>
          <span className="font-bold text-slate-100 text-lg">OutreachEngine</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded text-slate-400 hover:text-slate-100"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {memberNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}

        {/* Settings visible to everyone, but API keys hidden for non-admins */}
        <NavLink
          to="/settings"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`
          }
        >
          <Settings size={18} />
          Settings
        </NavLink>

        {/* Admin-only items */}
        {isAdmin && (
          <>
            <div className="pt-3 pb-1 px-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <Shield size={11} />
                Admin
              </div>
            </div>
            {adminNavItems
              .filter((item) => item.to !== '/settings')
              .map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                    }`
                  }
                >
                  <Icon size={18} />
                  {label}
                </NavLink>
              ))}
          </>
        )}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
            <span className="text-xs font-semibold text-blue-400">
              {(user?.name || user?.email || 'U')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-slate-200 truncate">
                {user?.name || user?.email}
              </p>
              {isAdmin && (
                <span className="text-xs bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded font-medium shrink-0">
                  Admin
                </span>
              )}
            </div>
            {user?.name && (
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            )}
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            title="Log out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
