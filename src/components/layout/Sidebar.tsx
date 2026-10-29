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
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type NavTab =
  | 'dashboard'
  | 'active-sessions'
  | 'transactions'
  | 'snacks'
  | 'settings'
  | 'employees'
  | 'reports'
  | 'closing'
  | 'audit-log';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeCount: number;
  isOpenOnMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  activeCount,
  isOpenOnMobile = false,
  onCloseMobile,
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
    { id: 'snacks', label: 'Snacks', icon: UtensilsCrossed },
    { id: 'settings', label: 'Pricing & Rates', icon: Settings, adminOnly: true },
    { id: 'employees', label: 'Employees', icon: Users, adminOnly: true },
  ];

  const reportingNav: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    adminOnly?: boolean;
  }> = [
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'audit-log', label: 'Audit Trail', icon: ShieldAlert, adminOnly: true },
  ];

  const handleTabClick = (tabId: NavTab, isLocked?: boolean) => {
    if (isLocked) {
      alert('Access Restricted: Only Admin accounts can access this section.');
      return;
    }
    onSelectTab(tabId);
    onCloseMobile?.();
  };

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
    <div className="space-y-0.5">
      <p className="px-3 text-3xs font-semibold text-slate-500 uppercase tracking-widest mb-1 font-mono">
        {title}
      </p>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        const isLocked = item.adminOnly && !isAdmin;

        return (
          <button
            key={item.id}
            onClick={() => handleTabClick(item.id, isLocked)}
            disabled={isLocked}
            className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-xs transition-colors ${
              isActive
                ? 'bg-red-600/10 text-white font-medium border-l-2 border-red-500 rounded-l-none shadow-sm'
                : isLocked
                ? 'text-slate-600 opacity-50 cursor-not-allowed border-l-2 border-transparent'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03] border-l-2 border-transparent'
            }`}
          >
            <div className="flex items-center gap-2">
              <Icon
                className={`w-3.5 h-3.5 ${
                  isActive ? 'text-red-400' : isLocked ? 'text-slate-600' : 'text-slate-400'
                }`}
              />
              <span>{item.label}</span>
            </div>
            {item.badge !== undefined && (
              <span
                className={`text-3xs font-mono font-bold px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? 'bg-red-600 text-white'
                    : 'bg-red-950/90 text-red-300 border border-red-800/60'
                }`}
              >
                {item.badge}
              </span>
            )}
            {isLocked && <span className="text-3xs text-slate-600 font-mono">Admin</span>}
          </button>
        );
      })}
    </div>
  );

  const sidebarContent = (
    <>
      <div className="p-2.5 space-y-4">
        {renderNavGroup('OPERATIONS', operationsNav)}
        {renderNavGroup('MANAGEMENT', managementNav)}
        {renderNavGroup('REPORTING', reportingNav)}
      </div>

      {/* Staff footer */}
      <div className="p-2.5 border-t border-white/[0.08] bg-[#060608]">
        <div className="flex items-center justify-between p-1.5 rounded bg-white/[0.02] border border-white/[0.04]">
          <div className="truncate pr-1">
            <p className="text-2xs font-semibold text-slate-200 truncate leading-tight">
              {currentUser.displayName}
            </p>
            <p className="text-3xs text-slate-500 capitalize font-mono leading-none mt-0.5">
              {currentUser.role}
            </p>
          </div>
          <button
            onClick={() => logout()}
            className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-white/[0.04] transition-colors"
            title="Lock POS"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar (Fixed Left) */}
      <aside className="hidden md:flex flex-col w-52 bg-[#08080c] border-r border-red-950/30 justify-between shrink-0 select-none">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer (When Open) */}
      {isOpenOnMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in"
            onClick={onCloseMobile}
          />
          <aside className="relative w-64 max-w-[80vw] bg-[#08080c] border-r border-red-950/40 h-full flex flex-col justify-between p-1 z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between p-2.5 border-b border-white/[0.06]">
              <span className="text-xs font-bold font-mono text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>VAULT 147 MENU</span>
              </span>
              <button
                onClick={onCloseMobile}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Mobile Ergonomic Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#08080c] border-t border-red-950/40 px-2 py-1.5 flex items-center justify-around shadow-2xl backdrop-blur-md">
        <button
          onClick={() => handleTabClick('dashboard')}
          className={`flex flex-col items-center py-1 px-3 text-2xs transition-colors ${
            activeTab === 'dashboard' ? 'text-red-400 font-bold' : 'text-slate-400'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 mb-0.5" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => handleTabClick('active-sessions')}
          className={`flex flex-col items-center py-1 px-3 text-2xs relative transition-colors ${
            activeTab === 'active-sessions' ? 'text-red-400 font-bold' : 'text-slate-400'
          }`}
        >
          <PlayCircle className="w-4 h-4 mb-0.5" />
          <span>Active</span>
          {activeCount > 0 && (
            <span className="absolute top-0.5 right-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-[#08080c] animate-pulse" />
          )}
        </button>

        <button
          onClick={() => handleTabClick('transactions')}
          className={`flex flex-col items-center py-1 px-3 text-2xs transition-colors ${
            activeTab === 'transactions' ? 'text-red-400 font-bold' : 'text-slate-400'
          }`}
        >
          <ReceiptText className="w-4 h-4 mb-0.5" />
          <span>Ledger</span>
        </button>

        <button
          onClick={() => handleTabClick('reports')}
          className={`flex flex-col items-center py-1 px-3 text-2xs transition-colors ${
            activeTab === 'reports' ? 'text-red-400 font-bold' : 'text-slate-400'
          }`}
        >
          <BarChart3 className="w-4 h-4 mb-0.5" />
          <span>Reports</span>
        </button>
      </div>
    </>
  );
};
