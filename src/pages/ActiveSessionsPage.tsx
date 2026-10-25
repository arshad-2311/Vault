import React, { useState, useEffect } from 'react';
import {
  PlayCircle,
  Clock,
  User,
  Plus,
  CreditCard,
  UtensilsCrossed,
  Search,
  Filter,
  Gamepad2,
  CircleDot,
  Timer,
} from 'lucide-react';
import { Session, Station } from '../types';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { db } from '../services/storage';
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
    // Update live clock every second
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <PlayCircle className="w-6 h-6 text-amber-400" />
            <span>Active Gaming Sessions</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Live monitoring of ongoing PS5 sessions and pool tables with real-time charges.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={onOpenNewEntry}
          leftIcon={<Plus className="w-4 h-4" />}
          className="font-semibold"
        >
          New Entry
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by customer name, phone, or station..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-600 focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1 rounded-md transition-colors ${
              typeFilter === 'all'
                ? 'bg-slate-700 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({sessions.length})
          </button>
          <button
            onClick={() => setTypeFilter('ps5')}
            className={`px-3 py-1 rounded-md transition-colors ${
              typeFilter === 'ps5'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PS5 ({sessions.filter((s) => s.gamingType === 'ps5').length})
          </button>
          <button
            onClick={() => setTypeFilter('pool')}
            className={`px-3 py-1 rounded-md transition-colors ${
              typeFilter === 'pool'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Pool Tables ({sessions.filter((s) => s.gamingType === 'pool').length})
          </button>
        </div>
      </div>

      {/* Active Sessions List */}
      {filteredSessions.length === 0 ? (
        <div className="p-12 rounded-xl border border-dashed border-slate-800 text-center bg-slate-900/30">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
            <Clock className="w-6 h-6 text-slate-500" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">No Active Sessions</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            All stations are currently available. Start a new entry to occupy a station.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenNewEntry}
            leftIcon={<Plus className="w-4 h-4" />}
            className="mt-4"
          >
            Start New Session
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSessions.map((s) => {
            const startMs = new Date(s.startTime).getTime();
            const elapsedSecs = Math.max(0, Math.floor((nowMs - startMs) / 1000));
            const elapsedMinutes = Math.max(1, Math.ceil(elapsedSecs / 60));

            // Estimate
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
                className="p-5 rounded-xl bg-slate-900 border border-slate-700/80 shadow-lg space-y-4"
              >
                {/* Station and Customer Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        s.gamingType === 'ps5'
                          ? 'bg-blue-950 text-blue-400 border border-blue-800/40'
                          : 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                      }`}
                    >
                      {s.gamingType === 'ps5' ? (
                        <Gamepad2 className="w-5 h-5" />
                      ) : (
                        <CircleDot className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{s.stationName}</h3>
                      <p className="text-xs font-medium text-slate-300 flex items-center gap-1.5 mt-0.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>{s.customerName}</span>
                        {s.customerPhone && (
                          <span className="text-2xs font-mono text-slate-500">
                            ({s.customerPhone})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <Badge variant="warning" size="sm">
                    LIVE
                  </Badge>
                </div>

                {/* Timer Banner */}
                <div className="p-3.5 rounded-lg bg-amber-950/20 border border-amber-800/40 flex items-center justify-between">
                  <div>
                    <span className="text-3xs uppercase tracking-wider text-amber-400/90 font-semibold block">
                      Elapsed Duration
                    </span>
                    <div className="text-xl font-bold font-mono tracking-tight text-amber-200 flex items-center gap-2 tabular-nums">
                      <Timer className="w-4 h-4 text-amber-400 animate-pulse" />
                      <span>{formatSecondsToTime(elapsedSecs)}</span>
                    </div>
                    <span className="text-3xs text-slate-500 font-mono">
                      Started at {formatTimeOnly(s.startTime)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-3xs uppercase tracking-wider text-amber-400/90 font-semibold block">
                      Current Estimate
                    </span>
                    <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                      {formatRupees(estTotalPaise)}
                    </span>
                    <span className="text-3xs text-slate-400 font-mono block">
                      Gaming: {formatRupees(estGamingPaise)} + Snacks: {formatRupees(s.snackSubtotalPaise)}
                    </span>
                  </div>
                </div>

                {/* Snacks list preview */}
                <div className="text-xs space-y-1">
                  <div className="flex items-center justify-between text-2xs text-slate-400">
                    <span className="font-semibold uppercase tracking-wider">
                      Concessions on Bill ({s.items.length})
                    </span>
                    <button
                      onClick={() => onAddSnack(s.id)}
                      className="text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Snack</span>
                    </button>
                  </div>

                  {s.items.length === 0 ? (
                    <p className="text-2xs text-slate-500 italic">No snacks added yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {s.items.map((it) => (
                        <span
                          key={it.id}
                          className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-2xs font-mono"
                        >
                          {it.quantity}x {it.name} ({formatRupees(it.lineTotalPaise)})
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="text-2xs text-slate-500 font-mono">
                    Staff: {s.createdByName}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onAddSnack(s.id)}
                      leftIcon={<UtensilsCrossed className="w-3.5 h-3.5 text-amber-400" />}
                    >
                      Add Snack
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onEndSession(s.id)}
                      leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                      className="bg-emerald-600 hover:bg-emerald-500 border-emerald-500 font-semibold"
                    >
                      Checkout & Pay
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
