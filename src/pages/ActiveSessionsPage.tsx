import React, { useState, useEffect } from 'react';
import {
  PlayCircle,
  Clock,
  User,
  Plus,
  CreditCard,
  UtensilsCrossed,
  Search,
  Timer,
  Gamepad2,
  CircleDot,
} from 'lucide-react';
import { Session } from '../types';
import { db, VAULT_DATA_CHANGED_EVENT } from '../services/storage';
import {
  formatRupees,
  formatTimeOnly,
  formatSecondsToTime,
} from '../utils/formatters';

interface ActiveSessionsPageProps {
  onAddSnack: (sessionId: string) => void;
  onEndSession: (sessionId: string) => void;
  onOpenNewEntry: () => void;
}

export const ActiveSessionsPage: React.FC<ActiveSessionsPageProps> = ({
  onAddSnack,
  onEndSession,
  onOpenNewEntry,
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'ps5' | 'pool'>('all');
  const [nowMs, setNowMs] = useState(Date.now());

  const loadData = () => {
    const all = db.getSessions().filter((s) => s.status === 'active');
    setSessions(all);
  };

  useEffect(() => {
    loadData();
    const handleDataChanged = () => loadData();
    window.addEventListener(VAULT_DATA_CHANGED_EVENT, handleDataChanged);
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      window.removeEventListener(VAULT_DATA_CHANGED_EVENT, handleDataChanged);
      clearInterval(interval);
    };
  }, []);

  const filteredSessions = sessions.filter((s) => {
    const matchesSearch =
      s.customerName.toLowerCase().includes(search.toLowerCase()) ||
      s.stationName.toLowerCase().includes(search.toLowerCase()) ||
      (s.customerPhone && s.customerPhone.includes(search));
    const matchesType = typeFilter === 'all' || s.gamingType === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <PlayCircle className="w-5 h-5 text-amber-400" />
            <span>Active Gaming Sessions</span>
          </h1>
          <p className="text-3xs text-slate-400 font-mono mt-0.5">
            Live operational monitoring of active PS5 consoles and pool tables
          </p>
        </div>

        <button
          onClick={onOpenNewEntry}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm transition-all active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>New Entry</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-2.5 rounded-lg bg-[#121620] border border-white/[0.08]">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search customer, station, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1 rounded bg-[#0b0e14] border border-white/[0.06] text-xs text-slate-100 placeholder:text-slate-600 focus:border-amber-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-1 p-0.5 rounded bg-[#0b0e14] border border-white/[0.06] text-xs font-mono">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-2.5 py-1 rounded text-2xs transition-colors ${
              typeFilter === 'all'
                ? 'bg-white/[0.12] text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({sessions.length})
          </button>
          <button
            onClick={() => setTypeFilter('ps5')}
            className={`px-2.5 py-1 rounded text-2xs transition-colors ${
              typeFilter === 'ps5'
                ? 'bg-blue-600/80 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PS5 ({sessions.filter((s) => s.gamingType === 'ps5').length})
          </button>
          <button
            onClick={() => setTypeFilter('pool')}
            className={`px-2.5 py-1 rounded text-2xs transition-colors ${
              typeFilter === 'pool'
                ? 'bg-emerald-600/80 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Pool ({sessions.filter((s) => s.gamingType === 'pool').length})
          </button>
        </div>
      </div>

      {/* Active Sessions Grid */}
      {filteredSessions.length === 0 ? (
        <div className="p-8 rounded-lg border border-dashed border-white/[0.08] text-center bg-[#121620]/40">
          <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
            No Active Gaming Sessions
          </h3>
          <p className="text-3xs text-slate-500 mt-1 max-w-sm mx-auto">
            All stations are currently free and available. Click New Entry to check in a player.
          </p>
          <button
            onClick={onOpenNewEntry}
            className="mt-3 px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Check In Player</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSessions.map((s) => {
            const startMs = new Date(s.startTime).getTime();
            const elapsedSecs = Math.max(0, Math.floor((nowMs - startMs) / 1000));
            const elapsedMinutes = Math.max(1, Math.ceil(elapsedSecs / 60));

            const estGamingPaise =
              s.billingType === 'fixed'
                ? s.rateSnapshot.fixedPricePaise || s.gamingChargePaise
                : Math.round(
                    (Math.max(15, elapsedMinutes) / 60) * (s.rateSnapshot.hourlyRatePaise || 15000)
                  );

            const estTotalPaise = estGamingPaise + s.snackSubtotalPaise;

            return (
              <div
                key={s.id}
                className="p-3.5 rounded-lg bg-[#141824] border border-amber-500/35 shadow-md space-y-3 flex flex-col justify-between"
              >
                {/* Station and Customer Header */}
                <div className="flex items-start justify-between gap-2 pb-2 border-b border-white/[0.06]">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                      <h3 className="text-xs font-bold font-mono text-white">{s.stationName}</h3>
                      <span className="text-3xs uppercase font-mono px-1 py-0.2 rounded bg-white/[0.05] text-slate-400">
                        {s.gamingType}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-200 mt-0.5 truncate max-w-[180px]">
                      {s.customerName}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-3xs text-amber-400 font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/40">
                      LIVE
                    </span>
                    <span className="text-3xs text-slate-400 font-mono block mt-1">
                      {formatTimeOnly(s.startTime)}
                    </span>
                  </div>
                </div>

                {/* Timer Banner */}
                <div className="py-1 grid grid-cols-2 gap-2 items-center">
                  <div>
                    <span className="text-3xs font-mono uppercase tracking-wider text-slate-400 block">
                      Duration
                    </span>
                    <div className="text-base font-bold font-mono text-amber-300 flex items-center gap-1.5 tabular-nums">
                      <Timer className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                      <span>{formatSecondsToTime(elapsedSecs)}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-3xs font-mono uppercase tracking-wider text-slate-400 block">
                      Estimated Bill
                    </span>
                    <span className="text-base font-bold font-mono text-emerald-400 tabular-nums">
                      {formatRupees(estTotalPaise)}
                    </span>
                  </div>
                </div>

                {/* Snacks preview */}
                <div className="pt-1 text-3xs font-mono text-slate-400 border-t border-white/[0.04] flex items-center justify-between">
                  <span>
                    {s.items.length > 0 ? `${s.items.length} snack item(s)` : 'No snacks added'}
                  </span>
                  <span className="text-slate-500">{s.rateSnapshot.description}</span>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2">
                  <button
                    onClick={() => onAddSnack(s.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] text-2xs font-medium text-slate-200 border border-white/[0.06] transition-colors"
                  >
                    <UtensilsCrossed className="w-3 h-3 text-amber-400" />
                    <span>+ Snack</span>
                  </button>

                  <button
                    onClick={() => onEndSession(s.id)}
                    className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-2xs font-bold transition-all shadow-sm active:scale-[0.98]"
                  >
                    <CreditCard className="w-3 h-3" />
                    <span>Checkout & Pay</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
