import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  Plus,
  Clock,
  Database,
  UserCheck,
  ChevronDown,
  Shield,
  User as UserIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { getSupabaseStatus } from '../../services/supabase';
import { Station } from '../../types';

interface NavbarProps {
  onOpenNewEntry: () => void;
  stations: Station[];
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenNewEntry, stations }) => {
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

  // Live digital clock in Asia/Kolkata
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(formatIST());
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const occupiedCount = stations.filter((s) => s.status === 'occupied').length;
  const totalStations = stations.length;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 sm:px-6 bg-slate-900 border-b border-slate-800/80 select-none">
      {/* Brand & Center Info */}
      <div className="flex items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-black shadow-sm">
            <Gamepad2 className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-white">VAULT 147</span>
              <span className="text-3xs font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                POS
              </span>
            </div>
            <p className="text-3xs text-slate-400 font-medium hidden sm:block">
              PS5 & 8-Ball Snooker Lounge
            </p>
          </div>
        </div>

        {/* Live Station Occupancy */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-800/60 border border-slate-700/60 text-xs">
          {totalStations > 0 ? (
            <>
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    occupiedCount > 0 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    occupiedCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
              </span>
              <span className="text-slate-300">
                <strong className="text-white font-semibold">{occupiedCount}</strong> / {totalStations} Stations In Use
              </span>
            </>
          ) : (
            <span className="text-slate-400 text-xs">Loading stations...</span>
          )}
        </div>

        {/* Live Time */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/40 border border-slate-800 text-xs font-mono text-slate-300">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{currentTime} IST</span>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3">
        {/* Database Status Indicator */}
        <button
          onClick={() => setDbStatusModal(true)}
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300 transition-colors"
          title="Click to view Database & RLS status"
        >
          <Database className="w-3.5 h-3.5 text-brand-400" />
          <span>{supabaseStatus.configured ? 'Supabase Live' : 'Local Storage Engine'}</span>
        </button>

        {/* Quick User Role Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-left transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-slate-200">
              {isAdmin ? (
                <Shield className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <UserIcon className="w-3.5 h-3.5 text-brand-400" />
              )}
            </div>
            <div className="hidden sm:block">
              <p className="font-medium text-slate-200 leading-none">{currentUser.displayName.split(' ')[0]}</p>
              <p className="text-2xs text-slate-400 uppercase tracking-wider font-semibold">
                {currentUser.role}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
          </button>

          {/* Dropdown Menu */}
          {showUserDropdown && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl py-2 z-50">
              <div className="px-3 py-2 border-b border-slate-800">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Test Role Switcher
                </p>
                <p className="text-2xs text-slate-500">
                  Switch between Admin and Employees to verify permission enforcement.
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
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs hover:bg-slate-800 transition-colors ${
                      u.id === currentUser.id ? 'bg-slate-800/80 font-semibold' : ''
                    }`}
                  >
                    <div>
                      <p className="text-slate-200">{u.displayName}</p>
                      <p className="text-2xs text-slate-400">{u.email}</p>
                    </div>
                    <Badge variant={u.role === 'admin' ? 'warning' : 'info'} size="sm">
                      {u.role.toUpperCase()}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Primary Action: New Digital Entry */}
        <Button
          variant="primary"
          size="md"
          onClick={onOpenNewEntry}
          leftIcon={<Plus className="w-4 h-4" />}
          className="font-semibold shadow-lg shadow-brand-500/10"
        >
          <span className="hidden sm:inline">New Entry</span>
          <span className="sm:hidden">Entry</span>
          <span className="hidden lg:inline text-2xs opacity-75 font-mono ml-1 px-1 py-0.5 rounded bg-brand-700/80">
            Alt+N
          </span>
        </Button>
      </div>

      {/* Database Status Modal */}
      {dbStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-brand-950 border border-brand-800 flex items-center justify-center text-brand-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-100">Database & Security Architecture</h3>
                <p className="text-xs text-slate-400">PostgreSQL Schema & RLS Status</p>
              </div>
            </div>

            <div className="space-y-3 text-xs bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono mb-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Persistence Mode:</span>
                <span className="text-emerald-400 font-semibold">
                  {supabaseStatus.configured ? 'Live Supabase PostgreSQL' : 'Local Persistent Storage Engine'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Row Level Security (RLS):</span>
                <span className="text-emerald-400 font-semibold">Enforced</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Financial Type:</span>
                <span className="text-amber-400 font-semibold">Exact Integer Paise (No Float)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Timezone:</span>
                <span className="text-slate-200">Asia/Kolkata (IST)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Migration File:</span>
                <span className="text-brand-300">supabase/migrations/</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              To connect this application to your free-tier Supabase project, set{' '}
              <code className="text-brand-300 bg-slate-800 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> and{' '}
              <code className="text-brand-300 bg-slate-800 px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code> in your{' '}
              <code className="text-brand-300 bg-slate-800 px-1 py-0.5 rounded">.env</code> file.
            </p>

            <div className="flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setDbStatusModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
