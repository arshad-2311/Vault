import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  CreditCard,
  Banknote,
  AlertCircle,
  Clock,
  ArrowUpRight,
  RefreshCw,
  Plus,
  Printer,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { Station, Session, DashboardMetrics } from '../types';
import { StationCard } from '../components/pos/StationCard';
import { db, VAULT_DATA_CHANGED_EVENT } from '../services/storage';
import { formatRupees, formatDateTime, getTodayDateString } from '../utils/formatters';

interface DashboardPageProps {
  onStartSession: (stationId: string) => void;
  onAddSnack: (sessionId: string) => void;
  onEndSession: (sessionId: string) => void;
  onViewAllTransactions: () => void;
  onOpenNewEntry: () => void;
  onPrintReceipt?: (session: Session) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onStartSession,
  onAddSnack,
  onEndSession,
  onViewAllTransactions,
  onOpenNewEntry,
  onPrintReceipt,
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
    const handleDataChanged = () => loadData();
    window.addEventListener(VAULT_DATA_CHANGED_EVENT, handleDataChanged);
    const interval = setInterval(loadData, 30000);
    return () => {
      window.removeEventListener(VAULT_DATA_CHANGED_EVENT, handleDataChanged);
      clearInterval(interval);
    };
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

  const occupiedCount = stations.filter((s) => s.status === 'occupied').length;

  return (
    <div className="space-y-4 max-w-7xl mx-auto font-sans">
      {/* 1. Header Toolbar & Period Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Operations Overview</span>
          </h1>
          <p className="text-3xs text-slate-400 font-mono mt-0.5">
            Real-time station occupancy and register accounting • Asia/Kolkata
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period selector */}
          <div className="flex items-center p-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-xs font-mono">
            {(['today', 'yesterday', 'week', 'month'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setRangePreset(period)}
                className={`px-2.5 py-1 rounded text-2xs transition-colors ${
                  rangePreset === period
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {period === 'today'
                  ? 'Today'
                  : period === 'yesterday'
                  ? 'Yesterday'
                  : period === 'week'
                  ? 'This Week'
                  : 'This Month'}
              </button>
            ))}
          </div>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-1.5 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-400 hover:text-slate-200 transition-colors"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Coherent Sales Summary Bar (4 Distinct Financial Pillars) */}
      <div className="rounded-lg bg-[#121620] border border-white/[0.08] divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06] grid grid-cols-2 md:grid-cols-4">
        {/* Total Billed Sales */}
        <div className="p-3.5 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-3xs font-mono uppercase tracking-wider text-slate-400">
              Total Sales Billed
            </span>
            <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-white tabular-nums">
            {formatRupees(metrics.totalSalesPaise)}
          </div>
          <p className="text-3xs text-slate-500 font-mono">
            {metrics.completedSessionsCount} closed session(s)
          </p>
        </div>

        {/* GPay / UPI Collections */}
        <div className="p-3.5 space-y-1">
          <div className="flex items-center justify-between text-blue-400">
            <span className="text-3xs font-mono uppercase tracking-wider text-blue-300/80">
              GPay / UPI Collected
            </span>
            <CreditCard className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-blue-100 tabular-nums">
            {formatRupees(metrics.gpayCollectionsPaise)}
          </div>
          <p className="text-3xs text-slate-500 font-mono">Direct digital bank intake</p>
        </div>

        {/* Physical Cash Collections */}
        <div className="p-3.5 space-y-1">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-3xs font-mono uppercase tracking-wider text-emerald-300/80">
              Cash Drawer Collected
            </span>
            <Banknote className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-emerald-100 tabular-nums">
            {formatRupees(metrics.cashCollectionsPaise)}
          </div>
          <p className="text-3xs text-slate-500 font-mono">Net physical currency intake</p>
        </div>

        {/* Outstanding Due */}
        <div className="p-3.5 space-y-1">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-3xs font-mono uppercase tracking-wider text-amber-300/80">
              Outstanding Due
            </span>
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono tracking-tight text-amber-200 tabular-nums">
            {formatRupees(metrics.outstandingBalancePaise)}
          </div>
          <p className="text-3xs text-slate-500 font-mono">Pending customer dues</p>
        </div>
      </div>

      {/* 3. Station Board (Compact, Responsive Grid) */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
              Station Board
            </h2>
            <span className="text-3xs font-mono px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-slate-300">
              {occupiedCount} IN USE • {stations.length - occupiedCount} AVAILABLE
            </span>
          </div>
          <span className="text-3xs text-slate-500 font-mono hidden sm:inline">
            Real-time occupancy • 6 Gaming Stations
          </span>
        </div>

        {/* The 6 station cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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

      {/* 4. Recent Completed Transactions Ledger */}
      <div className="space-y-2.5 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
              Recent Settlement Ledger
            </h3>
            <p className="text-3xs text-slate-400">
              Last {recentCompleted.length} closed transactions in current session
            </p>
          </div>

          <button
            onClick={onViewAllTransactions}
            className="flex items-center gap-1 text-2xs font-mono text-amber-400 hover:text-amber-300 transition-colors"
          >
            <span>Full Ledger</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentCompleted.length === 0 ? (
          <div className="p-6 rounded-lg bg-[#121620] border border-white/[0.08] text-center">
            <CheckCircle2 className="w-6 h-6 text-slate-600 mx-auto mb-1.5" />
            <p className="text-xs font-medium text-slate-300">No Completed Transactions</p>
            <p className="text-3xs text-slate-500 mt-0.5">
              Closed sessions and customer settlements will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/[0.08] bg-[#121620]">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0b0e14] text-slate-400 text-3xs uppercase border-b border-white/[0.06]">
                <tr>
                  <th className="px-3.5 py-2">Customer</th>
                  <th className="px-3.5 py-2">Station</th>
                  <th className="px-3.5 py-2">Duration</th>
                  <th className="px-3.5 py-2">Breakdown</th>
                  <th className="px-3.5 py-2">Payment</th>
                  <th className="px-3.5 py-2">Status</th>
                  <th className="px-3.5 py-2 text-right">Settled</th>
                  <th className="px-3.5 py-2 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {recentCompleted.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-3.5 py-2 font-sans font-medium text-slate-100">
                      <div>{s.customerName}</div>
                      <div className="text-3xs text-slate-500 font-mono">
                        {formatDateTime(s.endTime || s.createdAt)}
                      </div>
                    </td>
                    <td className="px-3.5 py-2 text-slate-300">
                      <span className="font-semibold">{s.stationName}</span>
                      <span className="text-3xs text-slate-500 block uppercase font-mono">
                        {s.gamingType}
                      </span>
                    </td>
                    <td className="px-3.5 py-2 text-slate-300">
                      {s.durationMinutes ? `${s.durationMinutes}m` : '—'}
                    </td>
                    <td className="px-3.5 py-2 text-3xs text-slate-400">
                      <div>Game: {formatRupees(s.gamingChargePaise)}</div>
                      {s.snackSubtotalPaise > 0 && (
                        <div>Snacks: {formatRupees(s.snackSubtotalPaise)}</div>
                      )}
                      {s.discountPaise > 0 && (
                        <div className="text-rose-400">Disc: -{formatRupees(s.discountPaise)}</div>
                      )}
                    </td>
                    <td className="px-3.5 py-2 text-3xs text-slate-300">
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
                    <td className="px-3.5 py-2">
                      <span
                        className={`text-3xs font-mono uppercase px-1.5 py-0.5 rounded font-semibold ${
                          s.payment?.status === 'PAID' || s.payment?.status === 'OVERPAID_CHANGE_DUE'
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                            : s.payment?.status === 'PARTIAL'
                            ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40'
                            : 'bg-white/[0.05] text-slate-400'
                        }`}
                      >
                        {s.payment?.status === 'OVERPAID_CHANGE_DUE' ? 'PAID (CHANGE)' : (s.payment?.status || 'UNPAID')}
                      </span>
                    </td>
                    <td className="px-3.5 py-2 text-right font-bold text-sm text-slate-100 tabular-nums">
                      {formatRupees(s.finalBillPaise)}
                    </td>
                    <td className="px-3.5 py-2 text-right">
                      {onPrintReceipt && (
                        <button
                          type="button"
                          onClick={() => onPrintReceipt(s)}
                          className="px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-2xs text-slate-300 hover:text-white border border-white/[0.06] transition-colors"
                        >
                          <Printer className="w-3 h-3 text-amber-400 inline mr-1" />
                          <span>Slip</span>
                        </button>
                      )}
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
