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
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <PlayCircle className="w-5 h-5 text-red-500" />
            <span>Active Gaming Sessions</span>
          </h1>
          <p className="text-xs text-zinc-400 font-mono mt-1">
            Live operational monitoring of active PS5 consoles and pool tables
          </p>
        </div>

        <button
          onClick={onOpenNewEntry}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md shadow-red-950/60 transition-all active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>New Entry</span>
        </button>
      </div>

      {/* Filter and Search Bar with spacious padding */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-[#08080c] border border-white/[0.08]">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search customer, station, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#050507] border border-white/[0.08] text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-red-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-[#050507] border border-white/[0.08] text-xs font-mono">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
              typeFilter === 'all'
                ? 'bg-red-600 text-white font-bold shadow-sm shadow-red-950/50'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All ({sessions.length})
          </button>
          <button
            onClick={() => setTypeFilter('ps5')}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
              typeFilter === 'ps5'
                ? 'bg-red-600 text-white font-bold shadow-sm shadow-red-950/50'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            PS5 ({sessions.filter((s) => s.gamingType === 'ps5').length})
          </button>
          <button
            onClick={() => setTypeFilter('pool')}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
              typeFilter === 'pool'
                ? 'bg-red-600 text-white font-bold shadow-sm shadow-red-950/50'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Pool ({sessions.filter((s) => s.gamingType === 'pool').length})
          </button>
        </div>
      </div>

      {/* Active Sessions Grid */}
      {filteredSessions.length === 0 ? (
        <div className="p-8 sm:p-12 rounded-2xl border border-dashed border-white/[0.08] text-center bg-[#09090e]">
          <Clock className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono">
            No Active Gaming Sessions
          </h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            All stations are currently free and available. Click New Entry to check in a player.
          </p>
          <button
            onClick={onOpenNewEntry}
            className="mt-4 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs inline-flex items-center gap-1.5 border border-red-500 shadow-md shadow-red-950/50"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Check In Player</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
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
                className="p-3.5 sm:p-4 rounded-xl bg-[#0c0c12] border border-red-500/40 shadow-xl shadow-red-950/20 space-y-3 flex flex-col justify-between"
              >
                {/* Station and Customer Header */}
                <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-white/[0.06]">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 ring-4 ring-red-500/20 shrink-0 animate-pulse" />
                      <h3 className="text-sm font-black font-mono text-white">{s.stationName}</h3>
                      <span className="text-3xs uppercase font-mono px-1.5 py-0.2 rounded bg-white/[0.05] text-slate-400 font-semibold">
                        {s.gamingType}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-200 mt-0.5 truncate max-w-[180px]">
                      {s.customerName}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-3xs text-red-300 font-mono font-bold px-2 py-0.5 rounded-full bg-red-950/80 border border-red-800/60">
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
                    <span className="text-3xs font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                      Duration
                    </span>
                    <div className="text-base font-bold font-mono text-red-400 flex items-center gap-1.5 tabular-nums">
                      <Timer className="w-4 h-4 text-red-500 animate-pulse" />
                      <span>{formatSecondsToTime(elapsedSecs)}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-3xs font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                      Estimated Bill
                    </span>
                    <span className="text-lg font-black font-mono text-white tabular-nums">
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
                    className="flex-1 py-2 px-3 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-slate-200 border border-white/[0.08] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <UtensilsCrossed className="w-3.5 h-3.5 text-red-400" />
                    <span>+ Snack</span>
                  </button>

                  <button
                    onClick={() => onEndSession(s.id)}
                    className="flex-1 py-2 px-3.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md shadow-red-950/60 active:scale-[0.98] flex items-center justify-center gap-1.5"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
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
