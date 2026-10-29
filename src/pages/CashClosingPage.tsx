import React, { useState, useEffect } from 'react';
import {
  Banknote,
  CheckCircle,
  AlertTriangle,
  History,
  Lock,
  Calendar,
  Save,
  ArrowRight,
} from 'lucide-react';
import { DailyClosing, Session } from '../types';
import { db, VAULT_DATA_CHANGED_EVENT } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import {
  formatRupees,
  formatDateTime,
  getTodayDateString,
} from '../utils/formatters';

export const CashClosingPage: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const todayStr = getTodayDateString();

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [closings, setClosings] = useState<DailyClosing[]>([]);
  const [notes, setNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cash denomination counts
  const [counts, setCounts] = useState<{ [key: string]: number }>({
    500: 0,
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    coins: 0,
  });

  const loadData = () => {
    setClosings(db.getDailyClosings());
  };

  useEffect(() => {
    loadData();
    window.addEventListener(VAULT_DATA_CHANGED_EVENT, loadData);
    return () => window.removeEventListener(VAULT_DATA_CHANGED_EVENT, loadData);
  }, []);

  // System calculations for selected date
  const allSessions = db.getSessions();
  const daySessions = allSessions.filter((s) => {
    const sDate = s.startTime.split('T')[0];
    return sDate === selectedDate && s.status === 'completed' && !s.isVoided;
  });

  const expectedCashPaise = daySessions.reduce((sum, s) => {
    const cashRec = s.payment?.cashAmountPaise || 0;
    const changeDue = s.payment?.changeDuePaise || 0;
    return sum + (cashRec - changeDue);
  }, 0);

  const totalGpayPaise = daySessions.reduce((sum, s) => {
    return sum + (s.payment?.gpayAmountPaise || 0);
  }, 0);

  const totalSalesPaise = daySessions.reduce((sum, s) => sum + s.finalBillPaise, 0);

  // Counted cash in paise
  const countedCashPaise =
    counts[500] * 500 * 100 +
    counts[200] * 200 * 100 +
    counts[100] * 100 * 100 +
    counts[50] * 50 * 100 +
    counts[20] * 20 * 100 +
    counts[10] * 10 * 100 +
    counts.coins * 100;

  const variancePaise = countedCashPaise - expectedCashPaise;

  const handleDenominationChange = (denom: string, val: string) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setCounts((prev) => ({ ...prev, [denom]: num }));
  };

  const handleFillExpected = () => {
    // Quick helper to fill exact expected
    const remainingRupees = Math.floor(expectedCashPaise / 100);
    let rem = remainingRupees;
    const n500 = Math.floor(rem / 500);
    rem %= 500;
    const n200 = Math.floor(rem / 200);
    rem %= 200;
    const n100 = Math.floor(rem / 100);
    rem %= 100;
    const n50 = Math.floor(rem / 50);
    rem %= 50;
    const n20 = Math.floor(rem / 20);
    rem %= 20;
    const n10 = Math.floor(rem / 10);
    rem %= 10;
    const coins = rem;

    setCounts({
      500: n500,
      200: n200,
      100: n100,
      50: n50,
      20: n20,
      10: n10,
      coins,
    });
  };

  const handleSaveClosing = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      db.createDailyClosing({
        closingDate: selectedDate,
        countedCashPaise,
        denominations: {
          note500: counts[500] || 0,
          note200: counts[200] || 0,
          note100: counts[100] || 0,
          note50: counts[50] || 0,
          note20: counts[20] || 0,
          note10: counts[10] || 0,
          coins: counts.coins || 0,
        },
        notes: notes.trim() || undefined,
        actor: currentUser,
      });

      setSuccessMsg(`Cash closing for ${selectedDate} finalized and audited.`);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save daily closing.');
    }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Banknote className="w-5 h-5 text-red-500" />
            <span>Cash Drawer Reconciliation</span>
          </h1>
          <p className="text-2xs text-slate-400 mt-0.5">
            End-of-shift register count, expected drawer cash verification, and audit sign-off.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-2xs font-mono text-slate-400">Audit Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-2.5 py-1 rounded bg-[#131722] border border-white/[0.08] text-xs font-mono text-slate-200 outline-none focus:border-red-500"
          />
        </div>
      </div>

      {successMsg && (
        <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Register Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 rounded-lg bg-[#121620] border border-white/[0.08]">
        <div>
          <span className="text-3xs uppercase tracking-wider text-slate-400 font-mono block">
            System Expected Cash
          </span>
          <span className="text-lg font-bold font-mono text-white tabular-nums">
            {formatRupees(expectedCashPaise)}
          </span>
          <span className="text-3xs text-slate-500 block font-mono">Net drawer currency</span>
        </div>

        <div>
          <span className="text-3xs uppercase tracking-wider text-slate-400 font-mono block">
            GPay / UPI Digital
          </span>
          <span className="text-lg font-bold font-mono text-zinc-300 tabular-nums">
            {formatRupees(totalGpayPaise)}
          </span>
          <span className="text-3xs text-slate-500 block font-mono">Direct bank transfers</span>
        </div>

        <div>
          <span className="text-3xs uppercase tracking-wider text-slate-400 font-mono block">
            Total Billed Today
          </span>
          <span className="text-lg font-bold font-mono text-white tabular-nums">
            {formatRupees(totalSalesPaise)}
          </span>
          <span className="text-3xs text-slate-500 block font-mono">
            {daySessions.length} closed session(s)
          </span>
        </div>

        <div>
          <span className="text-3xs uppercase tracking-wider text-slate-400 font-mono block">
            Current Variance
          </span>
          <span
            className={`text-lg font-bold font-mono tabular-nums ${
              variancePaise === 0
                ? 'text-zinc-200'
                : 'text-red-400'
            }`}
          >
            {variancePaise === 0
              ? 'Balanced (₹0)'
              : `${variancePaise > 0 ? '+' : ''}${formatRupees(variancePaise)}`}
          </span>
          <span className="text-3xs text-slate-500 block font-mono">Counted vs Expected</span>
        </div>
      </div>

      {/* Denominations Counting Grid */}
      <form onSubmit={handleSaveClosing} className="space-y-4">
        <div className="p-4 rounded-lg bg-[#121620] border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Physical Cash Breakdown
              </h3>
              <p className="text-3xs text-slate-400">
                Count notes and coins in cash drawer.
              </p>
            </div>
            <button
              type="button"
              onClick={handleFillExpected}
              className="text-2xs text-red-400 hover:text-red-300 underline font-mono"
            >
              Autofill Expected Count
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
            {[500, 200, 100, 50, 20, 10].map((d) => (
              <div key={d} className="p-2.5 rounded bg-[#0b0e14] border border-white/[0.06] text-center">
                <span className="text-2xs font-bold font-mono text-slate-300 block mb-1">
                  ₹{d} Notes
                </span>
                <input
                  type="number"
                  min="0"
                  value={counts[d] || 0}
                  onChange={(e) => handleDenominationChange(String(d), e.target.value)}
                  className="w-full text-center py-1 rounded bg-[#131722] border border-white/[0.08] text-xs font-mono text-white outline-none focus:border-red-500"
                />
                <span className="text-3xs text-slate-500 font-mono block mt-1">
                  = {formatRupees(counts[d] * d * 100)}
                </span>
              </div>
            ))}

            <div className="p-2.5 rounded bg-[#0b0e14] border border-white/[0.06] text-center">
              <span className="text-2xs font-bold font-mono text-slate-300 block mb-1">
                Coins / Change
              </span>
              <input
                type="number"
                min="0"
                value={counts.coins || 0}
                onChange={(e) => handleDenominationChange('coins', e.target.value)}
                className="w-full text-center py-1 rounded bg-[#131722] border border-white/[0.08] text-xs font-mono text-white outline-none focus:border-red-500"
              />
              <span className="text-3xs text-slate-500 font-mono block mt-1">
                = {formatRupees(counts.coins * 100)}
              </span>
            </div>
          </div>

          {/* Variance Banner */}
          <div
            className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
              variancePaise === 0
                ? 'bg-zinc-900 border-zinc-700 text-zinc-200'
                : 'bg-red-950/40 border-red-800/60 text-red-300'
            }`}
          >
            <div>
              <strong>Total Counted: {formatRupees(countedCashPaise)}</strong>
              <span className="text-3xs ml-2 opacity-80">
                (Expected {formatRupees(expectedCashPaise)})
              </span>
            </div>
            <div>
              {variancePaise === 0 ? (
                <span className="flex items-center gap-1 font-bold text-zinc-300">
                  <CheckCircle className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Drawer Reconciled Exactly</span>
                </span>
              ) : (
                <span className="font-bold text-red-400">
                  Variance: {variancePaise > 0 ? `+${formatRupees(variancePaise)} Overage` : `${formatRupees(variancePaise)} Shortage`}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-2xs font-semibold text-slate-400 mb-1">
              Closing Notes & Staff Handover Memo
            </label>
            <input
              type="text"
              placeholder="e.g. End of evening shift, drawer handed over to night lead."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 rounded bg-[#0b0e14] border border-white/[0.08] text-xs text-slate-200 outline-none focus:border-red-500"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-sm transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Finalize & Record Daily Closing</span>
            </button>
          </div>
        </div>
      </form>

      {/* Historical Closings Log */}
      <div className="p-4 rounded-lg bg-[#121620] border border-white/[0.08] space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
          <History className="w-4 h-4 text-slate-400" />
          <span>Past Shift Closings Log</span>
        </h3>

        {closings.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4 text-center">
            No daily closing records logged yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0b0e14] text-slate-400 text-3xs uppercase border-b border-white/[0.06]">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Expected Cash</th>
                  <th className="px-3 py-2">Counted Cash</th>
                  <th className="px-3 py-2">Variance</th>
                  <th className="px-3 py-2">Closed By</th>
                  <th className="px-3 py-2">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {closings.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2 text-white font-semibold">{c.closingDate}</td>
                    <td className="px-3 py-2 text-slate-300">{formatRupees(c.expectedCashPaise)}</td>
                    <td className="px-3 py-2 text-slate-200">{formatRupees(c.countedCashPaise)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`font-semibold ${
                          c.cashVariancePaise === 0
                            ? 'text-zinc-300'
                            : 'text-red-400'
                        }`}
                      >
                        {c.cashVariancePaise === 0
                          ? 'Balanced'
                          : `${c.cashVariancePaise > 0 ? '+' : ''}${formatRupees(c.cashVariancePaise)}`}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-400">{c.closedByName}</td>
                    <td className="px-3 py-2 text-slate-500 text-2xs truncate max-w-[200px]">
                      {c.notes || '—'}
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
