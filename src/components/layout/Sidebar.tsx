import React from 'react';
import {
  LayoutDashboard,
  PlayCircle,
  ReceiptText,
  UtensilsCrossed,
  BarChart3,
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

  const operationsNav: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'active-sessions',
      label: 'Active Sessions',
      icon: PlayCircle,
      badge: activeCount > 0 ? activeCount : undefined,
    },
    { id: 'transactions', label: 'Transactions', icon: ReceiptText },
  ];

  const managementNav: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    adminOnly?: boolean;
  }> = [
    { id: 'snacks', label: 'Snacks Catalogue', icon: UtensilsCrossed },
    { id: 'settings', label: 'Pricing & Rates', icon: Settings, adminOnly: true },
    { id: 'employees', label: 'Employee Staff', icon: Users, adminOnly: true },
  ];

  const financeNav: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    adminOnly?: boolean;
  }> = [
    { id: 'reports', label: 'Reports & CSV', icon: BarChart3 },
    { id: 'audit-log', label: 'Audit Trail', icon: ShieldAlert, adminOnly: true },
  ];

  const renderNavGroup = (
    title: string,
    items: Array<{
      id: NavTab;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      badge?: number | string;
      adminOnly?: boolean;
    }>
  ) => (
    <div className="space-y-1">
      <p className="px-3 text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
        {title}
      </p>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        const isLocked = item.adminOnly && !isAdmin;

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
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              isActive
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : isLocked
                ? 'text-slate-600 opacity-60 cursor-not-allowed border border-transparent'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Icon
                className={`w-4 h-4 ${
                  isActive ? 'text-amber-400' : isLocked ? 'text-slate-600' : 'text-slate-400'
                }`}
              />
              <span>{item.label}</span>
            </div>
            {item.badge !== undefined && (
              <span
                className={`text-2xs font-mono font-bold px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-amber-950/80 text-amber-400 border border-amber-800/50'
                }`}
              >
                {item.badge}
              </span>
            )}
            {isLocked && <span className="text-3xs text-slate-600">Admin</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    <aside className="w-60 bg-slate-900 border-r border-slate-800/80 flex flex-col justify-between shrink-0 select-none">
      <div className="p-3 space-y-5">
        {renderNavGroup('Operations', operationsNav)}
        {renderNavGroup('Management', managementNav)}
        {renderNavGroup('Finance & Analytics', financeNav)}
      </div>

      {/* User Footer Card */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 border border-slate-800/70">
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

