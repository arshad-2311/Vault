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
} from 'lucide-react';
import { Station, Session } from '../../types';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
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

  // Live timer tick for active session
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

  // Compute live estimate
  const estimatedGamingChargePaise = activeSession
    ? activeSession.billingType === 'fixed'
      ? activeSession.rateSnapshot.fixedPricePaise || activeSession.gamingChargePaise
      : Math.max(
          activeSession.rateSnapshot.hourlyRatePaise
            ? Math.round((Math.max(15, Math.ceil(elapsedSeconds / 60)) / 60) * activeSession.rateSnapshot.hourlyRatePaise)
            : 0
        )
    : 0;

  const estimatedTotalPaise = activeSession
    ? estimatedGamingChargePaise + activeSession.snackSubtotalPaise
    : 0;

  return (
    <div
      className={`flex flex-col justify-between rounded-xl border transition-all duration-150 ${
        isOccupied
          ? 'bg-slate-900/90 border-amber-600/40 shadow-lg shadow-amber-950/10'
          : station.status === 'maintenance'
          ? 'bg-slate-950 border-slate-800 opacity-60'
          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800/80">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                station.gamingType === 'ps5'
                  ? 'bg-blue-950/80 text-blue-400 border border-blue-800/40'
                  : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40'
              }`}
            >
              {station.gamingType === 'ps5' ? (
                <Gamepad2 className="w-4 h-4" />
              ) : (
                <CircleDot className="w-4 h-4" />
              )}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-100">{station.name}</h4>
              <p className="text-2xs text-slate-400 uppercase tracking-wider font-mono">
                {station.gamingType === 'ps5' ? 'PlayStation 5' : '8-Ball Pool'}
              </p>
            </div>
          </div>

          <Badge
            variant={
              isOccupied ? 'warning' : station.status === 'maintenance' ? 'neutral' : 'success'
            }
            size="sm"
          >
            {isOccupied ? 'OCCUPIED' : station.status.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Middle Body */}
      <div className="p-4 flex-1">
        {isOccupied && activeSession ? (
          <div className="space-y-3">
            {/* Customer & Start Time */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-200 font-medium truncate max-w-[150px]">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{activeSession.customerName}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400 text-2xs font-mono">
                <Clock className="w-3 h-3" />
                <span>Since {formatTimeOnly(activeSession.startTime)}</span>
              </div>
            </div>

            {/* Elapsed Timer Hero */}
            <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/40 flex items-center justify-between">
              <div>
                <span className="text-3xs uppercase tracking-wider text-amber-400/90 font-semibold block">
                  Elapsed Time
                </span>
                <div className="text-xl font-bold font-mono tracking-tight text-amber-200 flex items-center gap-1.5 tabular-nums">
                  <Timer className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span>{formatSecondsToTime(elapsedSeconds)}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-3xs uppercase tracking-wider text-amber-400/90 font-semibold block">
                  Est. Charge
                </span>
                <span className="text-base font-bold font-mono text-amber-100 tabular-nums">
                  {formatRupees(estimatedTotalPaise)}
                </span>
              </div>
            </div>

            {/* Billing detail & Snacks pill */}
            <div className="flex items-center justify-between text-2xs text-slate-400 border-t border-slate-800/60 pt-2">
              <span className="truncate max-w-[140px] text-slate-300">
                {activeSession.rateSnapshot.description}
              </span>
              <span>
                {activeSession.items.length > 0 ? (
                  <span className="text-blue-400 font-medium">
                    {activeSession.items.length} snack item(s)
                  </span>
                ) : (
                  'No snacks'
                )}
              </span>
            </div>
          </div>
        ) : (
          <div className="py-6 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-400 mb-2">
              <Clock className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-xs font-medium text-slate-300">Station Ready</p>
            <p className="text-2xs text-slate-500 mt-0.5">Available for immediate check-in</p>
          </div>
        )}
      </div>

      {/* Card Action Footer */}
      <div className="p-3 bg-slate-950/40 border-t border-slate-800/80">
        {isOccupied && activeSession ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onAddSnack(activeSession.id)}
              leftIcon={<Plus className="w-3.5 h-3.5 text-blue-400" />}
              className="text-xs"
            >
              Add Snack
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onEndSession(activeSession.id)}
              leftIcon={<CreditCard className="w-3.5 h-3.5" />}
              className="text-xs bg-amber-600 hover:bg-amber-500 border-amber-500"
            >
              End & Pay
            </Button>
          </div>
        ) : station.status === 'maintenance' ? (
          <div className="text-center py-1 text-2xs text-slate-500 flex items-center justify-center gap-1 font-mono">
            <AlertCircle className="w-3 h-3 text-amber-500" />
            <span>Under Maintenance</span>
          </div>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onStartSession(station.id)}
            leftIcon={<Plus className="w-3.5 h-3.5 text-emerald-400" />}
            className="w-full text-xs font-semibold hover:border-emerald-600 hover:text-emerald-300"
          >
            Start Session
          </Button>
        )}
      </div>
    </div>
  );
};
