import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  CreditCard,
  Banknote,
  AlertCircle,
  Gamepad2,
  CircleDot,
  UtensilsCrossed,
  Users,
  Timer,
  CheckCircle2,
  Calendar,
  ArrowUpRight,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { Station, Session, DashboardMetrics } from '../types';
import { StationCard } from '../components/pos/StationCard';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { db } from '../services/storage';
import { formatRupees, formatDateTime, getTodayDateString } from '../utils/formatters';

interface DashboardPageProps {
  onStartSession: (stationId: string) => void;
  onAddSnack: (sessionId: string) => void;
  onEndSession: (sessionId: string) => void;
  onViewAllTransactions: () => void;
  onOpenNewEntry: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onStartSession,
  onAddSnack,
  onEndSession,
  onViewAllTransactions,
  onOpenNewEntry,
}) => {
  // Synchronous initial state guarantees no 0/0 stations or missing cards flicker on mount
  const [stations, setStations] = useState<Station[]>(() => db.getStations());
  const [sessions, setSessions] = useState<Session[]>(() => db.getSessions());
  const [rangePreset, setRangePreset] = useState<'today' | 'yesterday' | 'week' | 'month'>('today');
  const [metrics, setMetrics] = useState<DashboardMetrics>(() => {
    const today = getTodayDateString();
    return db.calculateDashboardMetrics(today, today);
  });
  const [isLoading, setIsLoading] = useState(false);

  const loadData = () => {
    setIsLoading(true);
    try {
      const allStations = db.getStations();
      const allSessions = db.getSessions();
      setStations(allStations);
      setSessions(allSessions);

      // Compute date ranges
      const today = getTodayDateString();
      let startDate = today;
      let endDate = today;

      if (rangePreset === 'yesterday') {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        startDate = y.toISOString().split('T')[0];
        endDate = startDate;
      } else if (rangePreset === 'week') {
        const now = new Date();
        const firstDay = new Date(now.setDate(now.getDate() - now.getDay() + 1));
        startDate = firstDay.toISOString().split('T')[0];
        endDate = getTodayDateString();
      } else if (rangePreset === 'month') {
        const now = new Date();
        startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        endDate = getTodayDateString();
      }

      const calculated = db.calculateDashboardMetrics(startDate, endDate);
      setMetrics(calculated);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto-refresh every 30 seconds for live counter monitoring
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [rangePreset]);

  // Find active sessions map
  const activeSessionMap = new Map<string, Session>();
  sessions.forEach((s) => {
    if (s.status === 'active') {
      activeSessionMap.set(s.stationId, s);
    }
  });

  const recentCompleted = sessions
    .filter((s) => s.status === 'completed' && !s.isVoided)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Banner & Date Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Gaming Operations Hub</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time station occupancy, counter financial accounting, and register monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Preset buttons */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium">
            <button
              onClick={() => setRangePreset('today')}
              className={`px-3 py-1 rounded-md transition-colors ${
                rangePreset === 'today'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setRangePreset('yesterday')}
              className={`px-3 py-1 rounded-md transition-colors ${
                rangePreset === 'yesterday'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => setRangePreset('week')}
              className={`px-3 py-1 rounded-md transition-colors ${
                rangePreset === 'week'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setRangePreset('month')}
              className={`px-3 py-1 rounded-md transition-colors ${
                rangePreset === 'month'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              This Month
            </button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            title="Refresh data"
            isLoading={isLoading}
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={onOpenNewEntry}
            leftIcon={<Plus className="w-4 h-4" />}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border-amber-400"
          >
            New Entry (Alt+N)
          </Button>
        </div>
      </div>

      {/* Real Financial Metrics Grid */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* 1. Total Finalized Sales */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span className="font-semibold uppercase tracking-wider text-3xs text-slate-400">
                Total Finalized Sales
              </span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
              {formatRupees(metrics.totalSalesPaise)}
            </div>
            <p className="text-2xs text-slate-400 mt-1 font-mono">
              From {metrics.completedSessionsCount} closed sessions
            </p>
          </div>

          {/* 2. GPay Collections */}
          <div className="p-4 rounded-xl bg-slate-900 border border-blue-900/30 shadow-sm">
            <div className="flex items-center justify-between text-blue-400 text-xs mb-1">
              <span className="font-semibold uppercase tracking-wider text-3xs text-blue-300">
                GPay / UPI Received
              </span>
              <CreditCard className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-blue-100 tabular-nums">
              {formatRupees(metrics.gpayCollectionsPaise)}
            </div>
            <p className="text-2xs text-slate-400 mt-1">Direct digital bank transfer</p>
          </div>

          {/* 3. Cash Collections */}
          <div className="p-4 rounded-xl bg-slate-900 border border-emerald-900/30 shadow-sm">
            <div className="flex items-center justify-between text-emerald-400 text-xs mb-1">
              <span className="font-semibold uppercase tracking-wider text-3xs text-emerald-300">
                Cash Collections
              </span>
              <Banknote className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-emerald-100 tabular-nums">
              {formatRupees(metrics.cashCollectionsPaise)}
            </div>
            <p className="text-2xs text-slate-400 mt-1">Physical register currency</p>
          </div>

          {/* 4. Outstanding Balances */}
          <div className="p-4 rounded-xl bg-slate-900 border border-amber-900/30 shadow-sm">
            <div className="flex items-center justify-between text-amber-400 text-xs mb-1">
              <span className="font-semibold uppercase tracking-wider text-3xs text-amber-300">
                Outstanding Due
              </span>
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono tracking-tight text-amber-100 tabular-nums">
              {formatRupees(metrics.outstandingBalancePaise)}
            </div>
            <p className="text-2xs text-slate-400 mt-1">Pending customer settlement</p>
          </div>
        </div>

        {/* Secondary Metrics Bar: Revenue Streams & Average Value */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-950/60 border border-blue-800/50 flex items-center justify-center text-blue-400">
              <Gamepad2 className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-3xs text-slate-400 uppercase font-semibold block">PS5 Revenue</span>
              <span className="font-mono font-bold text-slate-100">
                {formatRupees(metrics.ps5RevenuePaise)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
              <CircleDot className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-3xs text-slate-400 uppercase font-semibold block">Pool Table Revenue</span>
              <span className="font-mono font-bold text-slate-100">
                {formatRupees(metrics.poolRevenuePaise)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-400">
              <UtensilsCrossed className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-3xs text-slate-400 uppercase font-semibold block">Snack Concessions</span>
              <span className="font-mono font-bold text-slate-100">
                {formatRupees(metrics.snackRevenuePaise)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-400">
              <Users className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-3xs text-slate-400 uppercase font-semibold block">Avg Ticket Size</span>
              <span className="font-mono font-bold text-slate-100">
                {formatRupees(metrics.averageTransactionValuePaise)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Station Occupancy Matrix (6 Gaming Stations) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-100">Station Occupancy Matrix</h2>
            <Badge variant="neutral" size="sm">
              {stations.filter((s) => s.status === 'occupied').length} active
            </Badge>
          </div>
          <span className="text-xs text-slate-400 hidden sm:block">
            Auto-refreshes every 30s • Real-time counter status
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stations.map((station) => (
            <StationCard
              key={station.id}
              station={station}
              activeSession={activeSessionMap.get(station.id)}
              onStartSession={onStartSession}
              onAddSnack={onAddSnack}
              onEndSession={onEndSession}
            />
          ))}
        </div>
      </div>

      {/* Recent Completed Transactions */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-100">Recent Completed Sessions</h3>
            <p className="text-xs text-slate-400">Audited settlement history</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAllTransactions}
            rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
          >
            View All Transactions
          </Button>
        </div>

        {recentCompleted.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <CheckCircle2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-300">No completed sessions in this period</p>
            <p className="text-xs text-slate-500 mt-1">
              Active sessions will appear here once checked out.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Station</th>
                  <th className="px-4 py-3">Billed Time</th>
                  <th className="px-4 py-3">Bill Breakdown</th>
                  <th className="px-4 py-3">Payment Split</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Settled Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {recentCompleted.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-100">
                      <div>{s.customerName}</div>
                      <div className="text-3xs text-slate-500 font-mono">
                        {formatDateTime(s.endTime || s.createdAt)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      <span className="font-semibold">{s.stationName}</span>
                      <span className="text-2xs text-slate-500 block uppercase">
                        {s.gamingType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-300">
                      {s.durationMinutes ? `${s.durationMinutes}m` : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-2xs text-slate-400">
                      <div>Game: {formatRupees(s.gamingChargePaise)}</div>
                      {s.snackSubtotalPaise > 0 && (
                        <div>Snacks: {formatRupees(s.snackSubtotalPaise)}</div>
                      )}
                      {s.discountPaise > 0 && (
                        <div className="text-rose-400">Disc: -{formatRupees(s.discountPaise)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-2xs font-mono text-slate-300">
                      {s.payment ? (
                        <div>
                          {s.payment.gpayAmountPaise > 0 && (
                            <span className="text-blue-400 block">
                              GPay: {formatRupees(s.payment.gpayAmountPaise)}
                            </span>
                          )}
                          {s.payment.cashAmountPaise > 0 && (
                            <span className="text-emerald-400 block">
                              Cash: {formatRupees(s.payment.cashAmountPaise)}
                            </span>
                          )}
                          {s.payment.changeDuePaise! > 0 && (
                            <span className="text-emerald-300 block">
                              Change: {formatRupees(s.payment.changeDuePaise)}
                            </span>
                          )}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          s.payment?.status === 'PAID' || s.payment?.status === 'OVERPAID_CHANGE_DUE'
                            ? 'success'
                            : s.payment?.status === 'PARTIAL'
                            ? 'warning'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {s.payment?.status === 'OVERPAID_CHANGE_DUE' ? 'PAID (CHANGE GIVEN)' : (s.payment?.status || 'UNPAID')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-sm text-slate-100">
                      {formatRupees(s.finalBillPaise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
