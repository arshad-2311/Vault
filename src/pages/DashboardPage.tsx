import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  CreditCard,
  Banknote,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Station, Session, DashboardMetrics } from '../types';
import { StationCard } from '../components/pos/StationCard';
import { db, VAULT_DATA_CHANGED_EVENT } from '../services/storage';
import { formatRupees, getTodayDateString } from '../utils/formatters';

interface DashboardPageProps {
  onStartSession: (stationId: string) => void;
  onAddSnack: (sessionId: string) => void;
  onEndSession: (sessionId: string) => void;
  onViewAllTransactions?: () => void;
  onOpenNewEntry?: () => void;
  onPrintReceipt?: (session: Session) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onStartSession,
  onAddSnack,
  onEndSession,
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

  const [stationFilter, setStationFilter] = useState<'all' | 'occupied' | 'available'>('all');
  const occupiedCount = stations.filter((s) => s.status === 'occupied').length;
  const availableCount = stations.length - occupiedCount;

  const filteredStations = stations.filter((st) => {
    if (stationFilter === 'occupied') return st.status === 'occupied';
    if (stationFilter === 'available') return st.status === 'available';
    return true;
  });

  return (
    <div className="space-y-6 sm:space-y-8 max-w-7xl mx-auto font-sans">
      {/* 1. Header Toolbar & Period Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 shadow-sm shadow-red-500/50" />
            <span>Operations Dashboard</span>
          </h1>
          <p className="text-xs text-zinc-400 font-mono mt-1">
            Real-time station occupancy and register accounting • Asia/Kolkata
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          {/* Period selector */}
          <div className="flex items-center p-1 rounded-xl bg-black/60 border border-white/[0.08] text-xs font-mono overflow-x-auto gap-1">
            {(['today', 'yesterday', 'week', 'month'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setRangePreset(period)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors shrink-0 ${
                  rangePreset === period
                    ? 'bg-red-600 text-white font-bold shadow-sm shadow-red-950/60'
                    : 'text-zinc-400 hover:text-zinc-200'
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
            className="p-2 rounded-xl bg-black/40 hover:bg-white/[0.08] border border-white/[0.08] text-zinc-400 hover:text-white transition-colors shrink-0"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-red-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Coherent Sales Summary Bar (4 Distinct Financial Pillars with generous spacing) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4.5">
        {/* Total Billed Sales */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#0c0c12] border border-zinc-800/80 shadow-lg shadow-black/40 space-y-1.5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-3xs sm:text-2xs font-mono uppercase tracking-wider text-zinc-400 font-bold">
              Total Sales
            </span>
            <TrendingUp className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white tabular-nums">
            {formatRupees(metrics.totalSalesPaise)}
          </div>
          <p className="text-3xs text-zinc-500 font-mono">
            {metrics.completedSessionsCount} closed session(s)
          </p>
        </div>

        {/* GPay / UPI Collections */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#0c0c12] border border-zinc-800/80 shadow-lg shadow-black/40 space-y-1.5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-3xs sm:text-2xs font-mono uppercase tracking-wider text-zinc-400 font-bold">
              GPay / UPI
            </span>
            <CreditCard className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white tabular-nums">
            {formatRupees(metrics.gpayCollectionsPaise)}
          </div>
          <p className="text-3xs text-zinc-500 font-mono">Digital bank intake</p>
        </div>

        {/* Physical Cash Collections */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#0c0c12] border border-zinc-800/80 shadow-lg shadow-black/40 space-y-1.5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-3xs sm:text-2xs font-mono uppercase tracking-wider text-zinc-400 font-bold">
              Cash Drawer
            </span>
            <Banknote className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white tabular-nums">
            {formatRupees(metrics.cashCollectionsPaise)}
          </div>
          <p className="text-3xs text-zinc-500 font-mono">Cash in register</p>
        </div>

        {/* Outstanding Due */}
        <div className="p-4 sm:p-5 rounded-xl bg-[#0c0c12] border border-red-950/60 shadow-lg shadow-black/40 space-y-1.5">
          <div className="flex items-center justify-between text-red-500">
            <span className="text-3xs sm:text-2xs font-mono uppercase tracking-wider text-red-400 font-bold">
              Pending Dues
            </span>
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-red-400 tabular-nums">
            {formatRupees(metrics.outstandingBalancePaise)}
          </div>
          <p className="text-3xs text-zinc-500 font-mono">Unsettled balance</p>
        </div>
      </div>

      {/* 3. Station Board (Compact, Responsive Grid with Mobile Quick Filter) */}
      <div className="space-y-4 pt-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-200 font-microgramma">
              Gaming Stations
            </h2>
            {/* Filter pills - Super easy on phone! */}
            <div className="flex items-center p-1 rounded-xl bg-black/60 border border-white/[0.08] text-xs font-mono gap-1">
              <button
                type="button"
                onClick={() => setStationFilter('all')}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  stationFilter === 'all'
                    ? 'bg-red-600 text-white font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                All ({stations.length})
              </button>
              <button
                type="button"
                onClick={() => setStationFilter('occupied')}
                className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5 ${
                  stationFilter === 'occupied'
                    ? 'bg-red-600 text-white font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span>In Use ({occupiedCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setStationFilter('available')}
                className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1.5 ${
                  stationFilter === 'available'
                    ? 'bg-red-600 text-white font-bold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-zinc-500" />
                <span>Ready ({availableCount})</span>
              </button>
            </div>
          </div>
          <span className="text-xs text-zinc-500 font-mono hidden sm:inline">
            Tap 'In Use' or 'Ready' to filter
          </span>
        </div>

        {/* The station cards with generous spacing */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredStations.map((station) => (
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
    </div>
  );
};
