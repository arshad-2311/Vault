import React from 'react';
import {
  LayoutDashboard,
  PlayCircle,
  ReceiptText,
  UtensilsCrossed,
  BarChart3,
  CircleDollarSign,
  Users,
  Settings,
  ShieldAlert,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type NavTab =
  | 'dashboard'
  | 'active-sessions'
  | 'transactions'
  | 'snacks'
  | 'reports'
  | 'closing'
  | 'employees'
  | 'settings'
  | 'audit-log';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  activeCount,
}) => {
  const { currentUser, isAdmin, logout } = useAuth();

  const primaryNavItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
    adminOnly?: boolean;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'active-sessions',
      label: 'Active Sessions',
      icon: PlayCircle,
      badge: activeCount > 0 ? activeCount : undefined,
    },
    { id: 'transactions', label: 'Transactions', icon: ReceiptText },
    { id: 'snacks', label: 'Snacks Catalogue', icon: UtensilsCrossed },
    { id: 'reports', label: 'Reports & CSV', icon: BarChart3 },
    { id: 'closing', label: 'Cash Closing', icon: CircleDollarSign },
  ];

  const adminNavItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    adminOnly: boolean;
  }> = [
    { id: 'employees', label: 'Employee Staff', icon: Users, adminOnly: true },
    { id: 'settings', label: 'Pricing & Rates', icon: Settings, adminOnly: true },
    { id: 'audit-log', label: 'Audit Trail', icon: ShieldAlert, adminOnly: true },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none">
      <div className="p-3 space-y-6">
        {/* Core Operations Section */}
        <div>
          <p className="px-3 text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Operations
          </p>
          <nav className="space-y-1">
            {primaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-600/15 text-brand-400 border border-brand-500/30'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-brand-400' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`text-2xs font-mono font-bold px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-brand-500 text-white'
                          : 'bg-amber-950 text-amber-400 border border-amber-800/50'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Administration Section */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-2xs font-semibold text-slate-500 uppercase tracking-wider">
              Administration
            </p>
            {!isAdmin && (
              <span className="text-3xs font-semibold uppercase px-1 py-0.5 rounded bg-slate-800 text-slate-500">
                Admin Only
              </span>
            )}
          </div>
          <nav className="space-y-1">
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const isLocked = !isAdmin;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (isLocked) {
                      alert('Access Restricted: Only Admin accounts can access this section.');
                      return;
                    }
                    onSelectTab(item.id);
                  }}
                  disabled={isLocked}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-brand-600/15 text-brand-400 border border-brand-500/30'
                      : isLocked
                      ? 'text-slate-600 opacity-60 cursor-not-allowed border border-transparent'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-brand-400' : isLocked ? 'text-slate-600' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {isLocked ? (
                    <span className="text-2xs text-slate-600">🔒</span>
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User Footer Card */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 border border-slate-800">
          <div className="truncate pr-2">
            <p className="text-xs font-semibold text-slate-200 truncate">{currentUser.displayName}</p>
            <p className="text-2xs text-slate-400 capitalize">{currentUser.role} Account</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-300 hover:bg-slate-800 transition-colors"
            title="Lock POS / Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
