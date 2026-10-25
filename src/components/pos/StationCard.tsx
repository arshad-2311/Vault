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
      <div className="flex flex-col justify-between p-3.5 rounded-lg bg-[#141824] border border-amber-500/35 shadow-md shadow-black/20 transition-all duration-150 relative overflow-hidden group">
        {/* Subtle accent line on top */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-500" />

        {/* Header: Station & Customer */}
        <div className="flex items-start justify-between gap-2 pb-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/20 shrink-0" />
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold font-mono text-white tracking-tight">
                  {station.name}
                </h4>
                <span className="text-3xs uppercase font-mono px-1 py-0.2 rounded bg-white/[0.05] text-slate-400">
                  {station.gamingType}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right truncate max-w-[170px]">
            <span className="text-xs font-semibold text-slate-100 block truncate">
              {activeSession.customerName}
            </span>
            <span className="text-3xs text-slate-400 font-mono block">
              Since {formatTimeOnly(activeSession.startTime)}
            </span>
          </div>
        </div>

        {/* Telemetry Hero: Live Timer & Live Estimated Charge */}
        <div className="py-2.5 grid grid-cols-2 gap-2 items-center">
          <div>
            <span className="text-3xs font-mono uppercase tracking-wider text-slate-400 block">
              Elapsed Time
            </span>
            <div className="text-lg font-bold font-mono text-amber-300 flex items-center gap-1.5 tabular-nums">
              <Timer className="w-3.5 h-3.5 text-amber-400" />
              <span>{formatSecondsToTime(elapsedSeconds)}</span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-3xs font-mono uppercase tracking-wider text-slate-400 block">
              Running Bill
            </span>
            <div className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
              {formatRupees(estimatedTotalPaise)}
            </div>
            {activeSession.items.length > 0 && (
              <span className="text-3xs text-slate-400 font-mono block">
                {activeSession.items.length} snack(s) included
              </span>
            )}
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onAddSnack(activeSession.id)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-white/[0.05] hover:bg-white/[0.1] text-2xs font-medium text-slate-200 border border-white/[0.06] transition-colors"
          >
            <UtensilsCrossed className="w-3 h-3 text-amber-400" />
            <span>+ Snack</span>
          </button>

          <button
            type="button"
            onClick={() => onEndSession(activeSession.id)}
            className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-2xs font-bold transition-all shadow-sm active:scale-[0.98]"
          >
            <CreditCard className="w-3 h-3" />
            <span>End & Pay</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. MAINTENANCE STATE
  if (station.status === 'maintenance') {
    return (
      <div className="p-3.5 rounded-lg bg-[#0e121a] border border-white/[0.04] opacity-60 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-600 shrink-0" />
            <h4 className="text-xs font-bold font-mono text-slate-300">{station.name}</h4>
          </div>
          <span className="text-3xs uppercase font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400">
            Maintenance
          </span>
        </div>
        <div className="py-2 text-2xs text-slate-500 flex items-center gap-1.5 font-mono">
          <AlertCircle className="w-3.5 h-3.5 text-amber-500/80" />
          <span>Station temporarily disabled</span>
        </div>
        <div className="pt-2 border-t border-white/[0.04] text-right">
          <span className="text-3xs text-slate-600 font-mono">Admin access only</span>
        </div>
      </div>
    );
  }

  // 3. AVAILABLE STATE (Compact, Calm, Zero Clutter)
  return (
    <div className="flex flex-col justify-between p-3.5 rounded-lg bg-[#10141e] border border-white/[0.06] hover:border-white/[0.12] transition-colors">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold font-mono text-slate-200">{station.name}</h4>
              <span className="text-3xs uppercase font-mono px-1 py-0.2 rounded bg-white/[0.04] text-slate-400">
                {station.gamingType}
              </span>
            </div>
          </div>
        </div>

        <span className="text-3xs font-mono uppercase text-emerald-400 font-semibold px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40">
          Ready
        </span>
      </div>

      {/* Middle Specs */}
      <div className="py-2 flex items-center justify-between text-2xs font-mono text-slate-400">
        <span>Standard Rate:</span>
        <span className="text-slate-200 font-semibold">{formatRupees(defaultHourlyPaise)}/hr</span>
      </div>

      {/* Action Row */}
      <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
        <span className="text-3xs text-slate-500 font-mono">Immediate Check-in</span>
        <button
          type="button"
          onClick={() => onStartSession(station.id)}
          className="flex items-center gap-1 px-3 py-1 rounded bg-white/[0.06] hover:bg-white/[0.12] text-white text-2xs font-semibold border border-white/[0.08] transition-all active:scale-[0.98]"
        >
          <Plus className="w-3 h-3 text-emerald-400" />
          <span>Start Session</span>
        </button>
      </div>
    </div>
  );
};
