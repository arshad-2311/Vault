import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  CircleDot,
  Clock,
  User,
  Plus,
  CreditCard,
  AlertCircle,
  Timer,
  UtensilsCrossed,
} from 'lucide-react';
import { Station, Session } from '../../types';
import {
  formatRupees,
  formatTimeOnly,
  formatSecondsToTime,
} from '../../utils/formatters';

interface StationCardProps {
  station: Station;
  activeSession?: Session;
  onStartSession: (stationId: string) => void;
  onAddSnack: (sessionId: string) => void;
  onEndSession: (sessionId: string) => void;
}

export const StationCard: React.FC<StationCardProps> = ({
  station,
  activeSession,
  onStartSession,
  onAddSnack,
  onEndSession,
}) => {
  const isOccupied = station.status === 'occupied' && Boolean(activeSession);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Live seconds ticker for active sessions
  useEffect(() => {
    if (!isOccupied || !activeSession?.startTime) return;

    const startMs = new Date(activeSession.startTime).getTime();
    const updateElapsed = () => {
      const nowMs = Date.now();
      const diffSecs = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setElapsedSeconds(diffSecs);
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [isOccupied, activeSession?.startTime]);

  // Real-time live estimate calculation
  const estimatedGamingChargePaise = activeSession
    ? activeSession.billingType === 'fixed'
      ? activeSession.rateSnapshot.fixedPricePaise || activeSession.gamingChargePaise
      : Math.max(
          activeSession.rateSnapshot.hourlyRatePaise
            ? Math.round(
                (Math.max(15, Math.ceil(elapsedSeconds / 60)) / 60) *
                  activeSession.rateSnapshot.hourlyRatePaise
              )
            : 0
        )
    : 0;

  const estimatedTotalPaise = activeSession
    ? estimatedGamingChargePaise + activeSession.snackSubtotalPaise
    : 0;

  const defaultHourlyPaise = station.gamingType === 'ps5' ? 15000 : 18000;

  // 1. IN USE / OCCUPIED STATE (High Operational Visibility)
  if (isOccupied && activeSession) {
    return (
      <div className="flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-[#0c0c12] border border-red-500/40 shadow-xl shadow-red-950/20 transition-all duration-150 relative overflow-hidden group">
        {/* Sleek red accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 to-red-500 shadow-sm shadow-red-500/50" />

        {/* Header: Station & Customer */}
        <div className="flex items-start justify-between gap-2.5 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 ring-4 ring-red-500/20 shrink-0 animate-pulse" />
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-sm sm:text-base font-black font-mono text-white tracking-tight">
                  {station.name}
                </h4>
                <span className="text-3xs uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-red-950/80 text-red-300 border border-red-800/50">
                  {station.gamingType}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right truncate max-w-[170px]">
            <span className="text-xs sm:text-sm font-bold text-slate-100 block truncate">
              {activeSession.customerName}
            </span>
            <span className="text-3xs text-slate-400 font-mono block mt-0.5">
              Since {formatTimeOnly(activeSession.startTime)}
            </span>
          </div>
        </div>

        {/* Telemetry Hero: Live Timer & Live Estimated Charge */}
        <div className="py-3.5 grid grid-cols-2 gap-2.5 items-center">
          <div>
            <span className="text-3xs font-mono uppercase tracking-wider text-slate-400 block font-semibold">
              Elapsed Time
            </span>
            <div className="text-lg sm:text-xl font-bold font-mono text-red-400 flex items-center gap-1.5 tabular-nums mt-0.5">
              <Timer className="w-4 h-4 text-red-500 animate-pulse" />
              <span>{formatSecondsToTime(elapsedSeconds)}</span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-3xs font-mono uppercase tracking-wider text-slate-400 block font-semibold">
              Running Bill
            </span>
            <div className="text-lg sm:text-xl font-black font-mono text-white tabular-nums mt-0.5">
              {formatRupees(estimatedTotalPaise)}
            </div>
            {activeSession.items.length > 0 && (
              <span className="text-3xs text-red-300/80 font-mono block mt-0.5">
                {activeSession.items.length} snack(s) included
              </span>
            )}
          </div>
        </div>

        {/* Action Toolbar (Mobile-friendly large tap targets) */}
        <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => onAddSnack(activeSession.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 sm:py-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-slate-200 border border-white/[0.08] transition-colors active:scale-[0.98]"
          >
            <UtensilsCrossed className="w-3.5 h-3.5 text-red-400" />
            <span>+ Snack</span>
          </button>

          <button
            type="button"
            onClick={() => onEndSession(activeSession.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 sm:py-2 px-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-md shadow-red-950/60 active:scale-[0.98]"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>End & Pay</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. MAINTENANCE STATE
  if (station.status === 'maintenance') {
    return (
      <div className="p-4 sm:p-5 rounded-2xl bg-[#09090d] border border-white/[0.04] opacity-60 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600 shrink-0" />
            <h4 className="text-xs font-bold font-mono text-slate-300">{station.name}</h4>
          </div>
          <span className="text-3xs uppercase font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400">
            Maintenance
          </span>
        </div>
        <div className="py-3 text-2xs text-slate-500 flex items-center gap-1.5 font-mono">
          <AlertCircle className="w-3.5 h-3.5 text-red-500/80" />
          <span>Station temporarily disabled</span>
        </div>
        <div className="pt-2.5 border-t border-white/[0.04] text-right">
          <span className="text-3xs text-slate-600 font-mono">Admin access only</span>
        </div>
      </div>
    );
  }

  // 3. AVAILABLE STATE (Clean, Sleek, Touch Friendly)
  return (
    <div className="flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-[#09090e] border border-zinc-800 hover:border-red-500/40 transition-all shadow-md shadow-black/20">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-800/60">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-500 ring-2 ring-zinc-500/20 shrink-0" />
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs sm:text-sm font-bold font-mono text-zinc-100">{station.name}</h4>
              <span className="text-3xs uppercase font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                {station.gamingType}
              </span>
            </div>
          </div>
        </div>

        <span className="text-3xs font-mono uppercase text-zinc-300 font-bold px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">
          Ready
        </span>
      </div>

      {/* Middle Specs */}
      <div className="py-3 flex items-center justify-between text-xs font-mono text-zinc-400">
        <span>Standard Rate:</span>
        <span className="text-zinc-100 font-bold">{formatRupees(defaultHourlyPaise)}/hr</span>
      </div>

      {/* Action Row with big mobile-friendly button */}
      <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between gap-2">
        <span className="text-3xs text-zinc-500 font-mono hidden sm:inline">Immediate Check-in</span>
        <button
          type="button"
          onClick={() => onStartSession(station.id)}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5 py-2.5 sm:py-2 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all active:scale-[0.98] shadow-sm shadow-red-950/40"
        >
          <Plus className="w-3.5 h-3.5 text-white" />
          <span>Start Session</span>
        </button>
      </div>
    </div>
  );
};
