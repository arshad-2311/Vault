import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  CreditCard,
  Banknote,
  AlertCircle,
  TrendingUp,
  Gamepad2,
  CircleDot,
  UtensilsCrossed,
  Users,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { DashboardMetrics, Session } from '../types';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { db } from '../services/storage';
import { formatRupees, getTodayDateString, formatDateOnly } from '../utils/formatters';

export const ReportsPage: React.FC = () => {
  const [rangeMode, setRangeMode] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [customStart, setCustomStart] = useState<string>(getTodayDateString());
  const [customEnd, setCustomEnd] = useState<string>(getTodayDateString());

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [reportSessions, setReportSessions] = useState<Session[]>([]);

  const calculateReport = () => {
    let start = selectedDate;
    let end = selectedDate;

    if (rangeMode === 'daily') {
      start = selectedDate;
      end = selectedDate;
    } else if (rangeMode === 'weekly') {
      const curr = new Date(selectedDate);
      const first = curr.getDate() - curr.getDay() + 1; // Monday
      const last = first + 6; // Sunday
      const firstDay = new Date(curr.setDate(first));
      const lastDay = new Date(curr.setDate(last));
      start = firstDay.toISOString().split('T')[0];
      end = lastDay.toISOString().split('T')[0];
    } else if (rangeMode === 'monthly') {
      const [year, month] = selectedDate.split('-');
      const lastDayOfMonth = new Date(Number(year), Number(month), 0).getDate();
      start = `${year}-${month}-01`;
      end = `${year}-${month}-${String(lastDayOfMonth).padStart(2, '0')}`;
    } else if (rangeMode === 'custom') {
      start = customStart;
      end = customEnd;
    }

    const calculated = db.calculateDashboardMetrics(start, end);
    setMetrics(calculated);

    const filtered = db.getSessions().filter((s) => {
      if (s.isVoided) return false;
      const sDate = s.startTime.split('T')[0];
      return sDate >= start && sDate <= end;
    });
    setReportSessions(filtered);
  };

  useEffect(() => {
    calculateReport();
  }, [rangeMode, selectedDate, customStart, customEnd]);

  const handleExportCSV = () => {
    const csvContent = db.exportSessionsToCSV(reportSessions);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vault_financial_report_${rangeMode}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-400" />
            <span>Financial Accounting & Settlement Reports</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Verified aggregation of gross sales, GPay vs Cash collections, and employee performance.
          </p>
        </div>

        <Button
          variant="secondary"
          size="md"
          onClick={handleExportCSV}
          leftIcon={<Download className="w-4 h-4 text-emerald-400" />}
          className="font-medium"
        >
          Export Report to CSV
        </Button>
      </div>

      {/* Range Mode Selector & Date Inputs */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center p-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-medium">
            <button
              onClick={() => setRangeMode('daily')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                rangeMode === 'daily'
                  ? 'bg-brand-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Daily Report
            </button>
            <button
              onClick={() => setRangeMode('weekly')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                rangeMode === 'weekly'
                  ? 'bg-brand-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Weekly Report
            </button>
            <button
              onClick={() => setRangeMode('monthly')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                rangeMode === 'monthly'
                  ? 'bg-brand-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Monthly Report
            </button>
            <button
              onClick={() => setRangeMode('custom')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                rangeMode === 'custom'
                  ? 'bg-brand-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Custom Range
            </button>
          </div>

          {/* Date controls */}
          <div className="flex items-center gap-2">
            {rangeMode === 'custom' ? (
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-mono"
                />
                <span className="text-slate-500">to</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-mono"
                />
              </div>
            ) : rangeMode === 'monthly' ? (
              <input
                type="month"
                value={selectedDate.substring(0, 7)}
                onChange={(e) => setSelectedDate(`${e.target.value}-01`)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 font-mono"
              />
            ) : (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 font-mono"
              />
            )}
          </div>
        </div>
      </div>

      {/* Headline Totals Breakdown */}
      {metrics && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-3xs uppercase tracking-wider text-slate-400 font-semibold block">
                Total Finalized Sales
              </span>
              <div className="text-2xl font-bold font-mono text-white mt-1 tabular-nums">
                {formatRupees(metrics.totalSalesPaise)}
              </div>
              <p className="text-2xs text-slate-400 mt-1">
                From {metrics.completedSessionsCount} settled sessions
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-blue-900/30">
              <span className="text-3xs uppercase tracking-wider text-blue-300 font-semibold block">
                GPay / UPI Collections
              </span>
              <div className="text-2xl font-bold font-mono text-blue-100 mt-1 tabular-nums">
                {formatRupees(metrics.gpayCollectionsPaise)}
              </div>
              <p className="text-2xs text-slate-400 mt-1">Bank verified digital total</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-emerald-900/30">
              <span className="text-3xs uppercase tracking-wider text-emerald-300 font-semibold block">
                Physical Cash Collections
              </span>
              <div className="text-2xl font-bold font-mono text-emerald-100 mt-1 tabular-nums">
                {formatRupees(metrics.cashCollectionsPaise)}
              </div>
              <p className="text-2xs text-slate-400 mt-1">To match daily cash closing</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-amber-900/30">
              <span className="text-3xs uppercase tracking-wider text-amber-300 font-semibold block">
                Outstanding Balance Due
              </span>
              <div className="text-2xl font-bold font-mono text-amber-100 mt-1 tabular-nums">
                {formatRupees(metrics.outstandingBalancePaise)}
              </div>
              <p className="text-2xs text-slate-400 mt-1">Unpaid customer balances</p>
            </div>
          </div>

          {/* Mathematical Reconciliation Box */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <HelpCircle className="w-4 h-4 text-brand-400" />
              <span>Mathematical Integrity & Derivation Breakdown</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono pt-1 text-slate-400">
              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-850">
                <span className="text-3xs uppercase text-slate-500 block font-sans">
                  Revenue Origin:
                </span>
                <span className="text-slate-200">
                  PS5 ({formatRupees(metrics.ps5RevenuePaise)}) + Pool ({formatRupees(metrics.poolRevenuePaise)}) + Snacks ({formatRupees(metrics.snackRevenuePaise)}) = <strong className="text-white">{formatRupees(metrics.ps5RevenuePaise + metrics.poolRevenuePaise + metrics.snackRevenuePaise)}</strong>
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-850">
                <span className="text-3xs uppercase text-slate-500 block font-sans">
                  Total Collections:
                </span>
                <span className="text-slate-200">
                  GPay ({formatRupees(metrics.gpayCollectionsPaise)}) + Cash ({formatRupees(metrics.cashCollectionsPaise)}) = <strong className="text-emerald-400">{formatRupees(metrics.gpayCollectionsPaise + metrics.cashCollectionsPaise)}</strong>
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-850">
                <span className="text-3xs uppercase text-slate-500 block font-sans">
                  Net Outstanding Check:
                </span>
                <span className="text-slate-200">
                  Sales ({formatRupees(metrics.totalSalesPaise)}) - Collections ({formatRupees(metrics.gpayCollectionsPaise + metrics.cashCollectionsPaise)}) = <strong className="text-amber-400">{formatRupees(metrics.outstandingBalancePaise)}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Visual Revenue Stream Split */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Revenue Composition */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Revenue by Category
              </h3>

              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between font-mono mb-1">
                    <span className="text-slate-300">PS5 Gaming Sessions:</span>
                    <span className="text-white font-bold">{formatRupees(metrics.ps5RevenuePaise)}</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full"
                      style={{
                        width: `${metrics.totalSalesPaise > 0 ? (metrics.ps5RevenuePaise / metrics.totalSalesPaise) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-mono mb-1">
                    <span className="text-slate-300">8-Ball Pool Tables:</span>
                    <span className="text-white font-bold">{formatRupees(metrics.poolRevenuePaise)}</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full"
                      style={{
                        width: `${metrics.totalSalesPaise > 0 ? (metrics.poolRevenuePaise / metrics.totalSalesPaise) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-mono mb-1">
                    <span className="text-slate-300">Snacks & Concessions:</span>
                    <span className="text-white font-bold">{formatRupees(metrics.snackRevenuePaise)}</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full"
                      style={{
                        width: `${metrics.totalSalesPaise > 0 ? (metrics.snackRevenuePaise / metrics.totalSalesPaise) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Method Split */}
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Payment Collections Split
              </h3>

              <div className="space-y-2 text-xs">
                <div>
                  <div className="flex justify-between font-mono mb-1">
                    <span className="text-slate-300">GPay / UPI (Digital):</span>
                    <span className="text-blue-300 font-bold">
                      {formatRupees(metrics.gpayCollectionsPaise)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full"
                      style={{
                        width: `${
                          metrics.gpayCollectionsPaise + metrics.cashCollectionsPaise > 0
                            ? (metrics.gpayCollectionsPaise /
                                (metrics.gpayCollectionsPaise + metrics.cashCollectionsPaise)) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between font-mono mb-1">
                    <span className="text-slate-300">Physical Cash:</span>
                    <span className="text-emerald-300 font-bold">
                      {formatRupees(metrics.cashCollectionsPaise)}
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full"
                      style={{
                        width: `${
                          metrics.gpayCollectionsPaise + metrics.cashCollectionsPaise > 0
                            ? (metrics.cashCollectionsPaise /
                                (metrics.gpayCollectionsPaise + metrics.cashCollectionsPaise)) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sales By Staff Member */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-semibold text-slate-100">
              Staff Member Settlement Breakdown
            </h3>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono text-3xs">
                  <tr>
                    <th className="px-4 py-3">Staff Member</th>
                    <th className="px-4 py-3">Closed Sessions</th>
                    <th className="px-4 py-3">Total Sales Settled</th>
                    <th className="px-4 py-3">Cash Handled</th>
                    <th className="px-4 py-3">GPay Handled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {metrics.salesByEmployee.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500 font-sans">
                        No transactions found for the selected period.
                      </td>
                    </tr>
                  ) : (
                    metrics.salesByEmployee.map((emp) => (
                      <tr key={emp.employeeId} className="hover:bg-slate-850/50">
                        <td className="px-4 py-3 font-sans font-medium text-slate-200">
                          {emp.employeeName}
                        </td>
                        <td className="px-4 py-3 text-slate-300">{emp.sessionCount}</td>
                        <td className="px-4 py-3 font-bold text-slate-100">
                          {formatRupees(emp.totalSalesPaise)}
                        </td>
                        <td className="px-4 py-3 text-emerald-400">
                          {formatRupees(emp.cashCollectedPaise)}
                        </td>
                        <td className="px-4 py-3 text-blue-400">
                          {formatRupees(emp.gpayCollectedPaise)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
