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
  const [stations, setStations] = useState<Station[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  // Date range filter for dashboard: 'today' | 'yesterday' | 'week' | 'month'
  const [rangePreset, setRangePreset] = useState<'today' | 'yesterday' | 'week' | 'month'>('today');

  const loadData = () => {
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
      const yStr = y.toISOString().split('T')[0];
      startDate = yStr;
      endDate = yStr;
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Gaming Operations Hub</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time station occupancy, financial accounting, and register monitoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Preset buttons */}
          <div className="flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium">
            <button
              onClick={() => setRangePreset('today')}
              className={`px-3 py-1 rounded-md transition-colors ${
                rangePreset === 'today'
                  ? 'bg-brand-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setRangePreset('yesterday')}
              className={`px-3 py-1 rounded-md transition-colors ${
                rangePreset === 'yesterday'
                  ? 'bg-brand-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Yesterday
            </button>
            <button
              onClick={() => setRangePreset('week')}
              className={`px-3 py-1 rounded-md transition-colors ${
                rangePreset === 'week'
                  ? 'bg-brand-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setRangePreset('month')}
              className={`px-3 py-1 rounded-md transition-colors ${
                rangePreset === 'month'
                  ? 'bg-brand-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              This Month
            </button>
          </div>

          <Button variant="secondary" size="sm" onClick={loadData} title="Refresh data">
            <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
          </Button>
        </div>
      </div>

      {/* Real Financial Metrics Grid */}
      {metrics && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 1. Total Finalized Sales */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-sm relative overflow-hidden">
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
            <div className="p-4 rounded-xl bg-slate-900/90 border border-blue-900/30 shadow-sm">
              <div className="flex items-center justify-between text-blue-400 text-xs mb-1">
                <span className="font-semibold uppercase tracking-wider text-3xs text-blue-300">
                  GPay / UPI Collections
                </span>
                <CreditCard className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold font-mono tracking-tight text-blue-100 tabular-nums">
                {formatRupees(metrics.gpayCollectionsPaise)}
              </div>
              <p className="text-2xs text-slate-400 mt-1">Direct digital bank transfer</p>
            </div>

            {/* 3. Cash Collections */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-emerald-900/30 shadow-sm">
              <div className="flex items-center justify-between text-emerald-400 text-xs mb-1">
                <span className="font-semibold uppercase tracking-wider text-3xs text-emerald-300">
                  Cash Collections
                </span>
                <Banknote className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold font-mono tracking-tight text-emerald-100 tabular-nums">
                {formatRupees(metrics.cashCollectionsPaise)}
              </div>
              <p className="text-2xs text-slate-400 mt-1">Must match drawer cash count</p>
            </div>

            {/* 4. Outstanding Balances */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-amber-900/30 shadow-sm">
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
                <span className="text-3xs text-slate-400 uppercase font-semibold block">8-Ball Pool</span>
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
                <span className="text-3xs text-slate-400 uppercase font-semibold block">Snacks Sales</span>
                <span className="font-mono font-bold text-slate-100">
                  {formatRupees(metrics.snackRevenuePaise)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-400">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-3xs text-slate-400 uppercase font-semibold block">Avg Ticket Value</span>
                <span className="font-mono font-bold text-slate-100">
                  {formatRupees(metrics.averageTransactionValuePaise)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live Gaming Stations Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Station Live Overview</h2>
            <p className="text-2xs text-slate-400">
              Interactive console bays and billiard tables with real-time timers.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenNewEntry}
            leftIcon={<Plus className="w-3.5 h-3.5 text-brand-400" />}
            className="text-xs"
          >
            New Session
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stations.map((st) => (
            <StationCard
              key={st.id}
              station={st}
              activeSession={activeSessionMap.get(st.id)}
              onStartSession={onStartSession}
              onAddSnack={onAddSnack}
              onEndSession={onEndSession}
            />
          ))}
        </div>
      </div>

      {/* Recent Settled Transactions Table */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Recent Completed Entries</h3>
            <p className="text-2xs text-slate-400">Latest settled customer bills and payment splits.</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAllTransactions}
            rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
            className="text-xs text-brand-400 hover:text-brand-300"
          >
            View All Transactions
          </Button>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono text-3xs">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Station</th>
                  <th className="px-4 py-3">Billed Time</th>
                  <th className="px-4 py-3">Gaming Charge</th>
                  <th className="px-4 py-3">Snacks</th>
                  <th className="px-4 py-3">Total Bill</th>
                  <th className="px-4 py-3">Payment Split</th>
                  <th className="px-4 py-3">Cashier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {recentCompleted.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-6 text-center text-slate-500 font-sans">
                      No completed transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentCompleted.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="px-4 py-3 font-sans font-medium text-slate-200">
                        {s.customerName}
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-sans">{s.stationName}</td>
                      <td className="px-4 py-3 text-slate-300">{s.durationMinutes}m</td>
                      <td className="px-4 py-3 text-slate-300">
                        {formatRupees(s.gamingChargePaise)}
                      </td>
                      <td className="px-4 py-3 text-amber-400">
                        {s.snackSubtotalPaise > 0 ? formatRupees(s.snackSubtotalPaise) : '—'}
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-400">
                        {formatRupees(s.finalBillPaise)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-sans">
                          <Badge
                            variant={
                              s.payment?.method === 'gpay'
                                ? 'info'
                                : s.payment?.method === 'cash'
                                ? 'success'
                                : 'purple'
                            }
                            size="sm"
                          >
                            {s.payment?.method.toUpperCase()}
                          </Badge>
                          {s.payment?.method === 'split' && (
                            <span className="text-3xs text-slate-400 font-mono">
                              ({formatRupees(s.payment.gpayAmountPaise)} GPay + {formatRupees(s.payment.cashAmountPaise)} Cash)
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-sans text-2xs">
                        {s.completedByName}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
