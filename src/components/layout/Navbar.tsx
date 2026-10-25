import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  Plus,
  Clock,
  Database,
  ChevronDown,
  Shield,
  CheckCircle2,
  Menu,
  X,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseStatus } from '../../services/supabase';
import { Station } from '../../types';

interface NavbarProps {
  onOpenNewEntry: () => void;
  stations: Station[];
  mobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenNewEntry,
  stations,
  mobileMenuOpen,
  onToggleMobileMenu,
}) => {
  const { currentUser, users, switchUser, isAdmin } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [dbStatusModal, setDbStatusModal] = useState(false);

  const formatIST = () => {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(new Date());
  };

  const [currentTime, setCurrentTime] = useState<string>(formatIST);
  const supabaseStatus = getSupabaseStatus();

  // Digital clock locked to Asia/Kolkata
  useEffect(() => {
    const updateTime = () => setCurrentTime(formatIST());
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const occupiedCount = stations.filter((s) => s.status === 'occupied').length;
  const totalStations = stations.length;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-12 px-4 sm:px-6 bg-[#0e121b] border-b border-white/[0.08] select-none text-slate-200">
      {/* Brand & Telemetry */}
      <div className="flex items-center gap-3 sm:gap-6">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
            title="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded bg-amber-500 text-slate-950 font-black shadow-sm">
            <Gamepad2 className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-bold tracking-tight text-white font-mono">VAULT 147</span>
            <span className="text-3xs text-amber-400/90 font-mono font-semibold tracking-wider">POS</span>
          </div>
        </div>

        {/* Live Station Occupancy Dot Matrix */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-white/[0.03] border border-white/[0.06] text-xs">
          <div className="flex items-center gap-1.5" title="Station telemetry dots">
            {stations.map((st) => (
              <span
                key={st.id}
                title={`${st.name} • ${st.status.toUpperCase()}`}
                className={`w-2 h-2 rounded-full transition-colors ${
                  st.status === 'occupied'
                    ? 'bg-amber-400 ring-1 ring-amber-400/30'
                    : st.status === 'maintenance'
                    ? 'bg-slate-600'
                    : 'bg-emerald-500/90'
                }`}
              />
            ))}
          </div>
          <span className="text-slate-400 text-2xs font-mono font-medium">
            <strong className="text-slate-100">{occupiedCount}</strong>/{totalStations} Occupied
          </span>
        </div>

        {/* Configured Local Business Time */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.03] border border-white/[0.06] text-xs font-mono text-slate-300">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{currentTime} IST</span>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2.5">
        {/* Honest Architecture Label */}
        <button
          onClick={() => setDbStatusModal(true)}
          className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded text-2xs font-mono text-slate-400 hover:text-slate-200 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-colors"
          title="Storage architecture and sync state"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{supabaseStatus.configured ? 'Supabase Sync' : 'Local Storage Engine'}</span>
        </button>

        {/* User Identity Pill */}
        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 px-2.5 py-1 rounded bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] text-xs transition-colors"
            title="Switch User Role"
          >
            <div className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center text-slate-300">
              {isAdmin ? (
                <Shield className="w-3 h-3 text-amber-400" />
              ) : (
                <UserIcon className="w-3 h-3 text-slate-400" />
              )}
            </div>
            <span className="font-medium text-slate-200 text-xs hidden sm:inline">
              {currentUser.displayName.split(' ')[0]}
            </span>
            <span className="text-3xs text-slate-400 uppercase font-mono hidden sm:inline font-semibold">
              ({currentUser.role})
            </span>
            <ChevronDown className="w-3 h-3 text-slate-500" />
          </button>

          {/* User Switch Dropdown */}
          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-60 rounded-lg bg-[#141824] border border-white/[0.1] shadow-2xl py-1 z-50">
              <div className="px-3 py-1.5 border-b border-white/[0.06]">
                <p className="text-3xs font-semibold text-slate-400 uppercase tracking-wider">
                  Select Active Personnel
                </p>
              </div>

              <div className="py-1">
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      switchUser(u);
                      setShowUserDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-xs hover:bg-white/[0.06] transition-colors ${
                      u.id === currentUser.id ? 'bg-amber-500/10 text-amber-300 font-semibold' : 'text-slate-300'
                    }`}
                  >
                    <div>
                      <p className="leading-tight">{u.displayName}</p>
                      <p className="text-3xs text-slate-500 font-mono">{u.email}</p>
                    </div>
                    <span className="text-3xs font-mono uppercase px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.06] text-slate-400">
                      {u.role}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Primary CTA: New Entry */}
        <button
          onClick={onOpenNewEntry}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm transition-all active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>New Entry</span>
          <kbd className="hidden sm:inline font-mono text-3xs bg-amber-600/70 text-slate-950 px-1 py-0.2 rounded font-bold">
            Alt+N
          </kbd>
        </button>
      </div>

      {/* Storage Architecture Modal */}
      {dbStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#121620] border border-white/[0.1] rounded-xl max-w-md w-full p-5 shadow-2xl font-sans">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">System Architecture & Persistence</h3>
                <p className="text-2xs text-slate-400 font-mono">Vault 147 Operational Storage</p>
              </div>
            </div>

            <div className="space-y-2 text-xs bg-[#0b0e14] p-3 rounded-lg border border-white/[0.06] font-mono mb-3">
              <div className="flex justify-between">
                <span className="text-slate-400">Persistence Engine:</span>
                <span className="text-emerald-400 font-semibold">
                  {supabaseStatus.configured ? 'Supabase Live' : 'Local Storage Engine'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Financial Storage:</span>
                <span className="text-amber-400 font-semibold">Integer Paise (0.00 Float Free)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Timezone Context:</span>
                <span className="text-slate-200">Asia/Kolkata (IST UTC+5:30)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Audit Trail:</span>
                <span className="text-emerald-400 font-semibold">Immutable Append-Only Log</span>
              </div>
            </div>

            <p className="text-2xs text-slate-400 leading-relaxed mb-4">
              {supabaseStatus.configured
                ? 'Connected to configured remote PostgreSQL cluster with Row-Level Security.'
                : 'Running on synchronous browser storage with event bus reactivity. All changes persist across tab closes and sessions.'}
            </p>

            <div className="flex justify-end">
              <button
                onClick={() => setDbStatusModal(false)}
                className="px-3 py-1.5 rounded bg-white/[0.08] hover:bg-white/[0.12] text-xs font-semibold text-slate-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
