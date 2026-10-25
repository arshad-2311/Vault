import React, { useState, useEffect } from 'react';
import {
  CircleDollarSign,
  Calculator,
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  ShieldCheck,
  CreditCard,
  Banknote,
  FileCheck,
} from 'lucide-react';
import { DailyClosing, CashDenominations } from '../types';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/storage';
import { formatRupees, getTodayDateString, formatDateTime } from '../utils/formatters';

export const CashClosingPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [closingDate, setClosingDate] = useState<string>(getTodayDateString());
  const [closings, setClosings] = useState<DailyClosing[]>([]);

  // Denominations State
  const [denominations, setDenominations] = useState<CashDenominations>({
    note500: 0,
    note200: 0,
    note100: 0,
    note50: 0,
    note20: 0,
    note10: 0,
    coins: 0,
  });

  const [notes, setNotes] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load existing closings
  const loadClosings = () => {
    setClosings(db.getDailyClosings());
  };

  useEffect(() => {
    loadClosings();
  }, []);

  // Compute expected cash and GPay from sessions for closing date
  const sessions = db.getSessions().filter((s) => {
    if (s.isVoided) return false;
    const sDate = s.startTime.split('T')[0];
    return sDate === closingDate;
  });

  let expectedCashPaise = 0;
  let expectedGpayPaise = 0;
  let totalSalesPaise = 0;

  sessions.forEach((s) => {
    if (s.payment) {
      expectedCashPaise += s.payment.cashAmountPaise;
      expectedGpayPaise += s.payment.gpayAmountPaise;
      totalSalesPaise += s.finalBillPaise;
    }
  });

  // Calculate counted physical cash from denominations
  const countedCashRupees =
    denominations.note500 * 500 +
    denominations.note200 * 200 +
    denominations.note100 * 100 +
    denominations.note50 * 50 +
    denominations.note20 * 20 +
    denominations.note10 * 10 +
    denominations.coins;

  const countedCashPaise = countedCashRupees * 100;
  const variancePaise = countedCashPaise - expectedCashPaise;

  const handleDenominationChange = (key: keyof CashDenominations, valStr: string) => {
    const parsed = Math.max(0, parseInt(valStr) || 0);
    setDenominations((prev) => ({ ...prev, [key]: parsed }));
  };

  const handleSaveClosing = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // If there is a variance and no notes provided, require notes
    if (variancePaise !== 0 && (!notes || notes.trim().length < 4)) {
      setError('Please provide an explanatory note for the cash variance.');
      return;
    }

    try {
      const closing = db.createDailyClosing({
        closingDate,
        countedCashPaise,
        denominations,
        notes: notes.trim() || undefined,
        actor: currentUser,
      });

      setSuccessMessage(
        `Daily cash closing for ${closingDate} successfully recorded and audited!`
      );
      loadClosings();
    } catch (err: any) {
      setError(err.message || 'Failed to submit daily closing.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CircleDollarSign className="w-6 h-6 text-emerald-400" />
            <span>Shift & Daily Cash Closing</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Physical drawer cash count, automated variance reconciliation, and auditable shift closure.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-medium">Closing Date:</label>
          <input
            type="date"
            value={closingDate}
            onChange={(e) => setClosingDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 font-mono"
          />
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2 font-medium">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Cash Count Form & Denomination Counter */}
        <div className="lg:col-span-2 space-y-5">
          {/* Expected vs Digital Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-slate-900 border border-emerald-900/40">
              <span className="text-3xs uppercase tracking-wider text-emerald-400 font-semibold block">
                System Expected Cash
              </span>
              <div className="text-xl font-bold font-mono text-emerald-100 mt-1 tabular-nums">
                {formatRupees(expectedCashPaise)}
              </div>
              <p className="text-3xs text-slate-400 mt-1">From recorded cash payments</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-blue-900/40">
              <span className="text-3xs uppercase tracking-wider text-blue-400 font-semibold block">
                GPay / UPI Received
              </span>
              <div className="text-xl font-bold font-mono text-blue-100 mt-1 tabular-nums">
                {formatRupees(expectedGpayPaise)}
              </div>
              <p className="text-3xs text-slate-400 mt-1">Bank digital (Not in cash drawer)</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-3xs uppercase tracking-wider text-slate-400 font-semibold block">
                Total Day Sales
              </span>
              <div className="text-xl font-bold font-mono text-white mt-1 tabular-nums">
                {formatRupees(totalSalesPaise)}
              </div>
              <p className="text-3xs text-slate-400 mt-1">Gross finalized revenue</p>
            </div>
          </div>

          {/* Physical Cash Denominations Form */}
          <form
            onSubmit={handleSaveClosing}
            className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-100">
                  Physical Cash Drawer Denomination Counter
                </h3>
              </div>
              <span className="text-2xs text-slate-400 font-mono">
                Operator: {currentUser.displayName}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {/* ₹500 */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>₹500 Notes</span>
                  <span className="font-mono text-emerald-400">
                    {formatRupees(denominations.note500 * 500 * 100)}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={denominations.note500 || ''}
                  placeholder="0"
                  onChange={(e) => handleDenominationChange('note500', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:border-emerald-500"
                />
              </div>

              {/* ₹200 */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>₹200 Notes</span>
                  <span className="font-mono text-emerald-400">
                    {formatRupees(denominations.note200 * 200 * 100)}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={denominations.note200 || ''}
                  placeholder="0"
                  onChange={(e) => handleDenominationChange('note200', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:border-emerald-500"
                />
              </div>

              {/* ₹100 */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>₹100 Notes</span>
                  <span className="font-mono text-emerald-400">
                    {formatRupees(denominations.note100 * 100 * 100)}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={denominations.note100 || ''}
                  placeholder="0"
                  onChange={(e) => handleDenominationChange('note100', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:border-emerald-500"
                />
              </div>

              {/* ₹50 */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>₹50 Notes</span>
                  <span className="font-mono text-emerald-400">
                    {formatRupees(denominations.note50 * 50 * 100)}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={denominations.note50 || ''}
                  placeholder="0"
                  onChange={(e) => handleDenominationChange('note50', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:border-emerald-500"
                />
              </div>

              {/* ₹20 */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>₹20 Notes</span>
                  <span className="font-mono text-emerald-400">
                    {formatRupees(denominations.note20 * 20 * 100)}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={denominations.note20 || ''}
                  placeholder="0"
                  onChange={(e) => handleDenominationChange('note20', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:border-emerald-500"
                />
              </div>

              {/* ₹10 & Coins */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>₹10 & Coins Total (₹)</span>
                  <span className="font-mono text-emerald-400">
                    {formatRupees(denominations.coins * 100)}
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={denominations.coins || ''}
                  placeholder="0"
                  onChange={(e) => handleDenominationChange('coins', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-100 font-mono focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Reconciliation Hero Box */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-3xs uppercase tracking-wider text-slate-400 font-semibold block">
                    Actual Counted Cash
                  </span>
                  <span className="text-2xl font-bold font-mono text-white tabular-nums">
                    {formatRupees(countedCashPaise)}
                  </span>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-3xs uppercase tracking-wider text-slate-400 font-semibold block">
                    Drawer Cash Discrepancy
                  </span>
                  <div className="flex items-center sm:justify-end gap-1.5">
                    {variancePaise === 0 ? (
                      <span className="text-lg font-bold font-mono text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span>₹0.00 (Exact Match)</span>
                      </span>
                    ) : variancePaise > 0 ? (
                      <span className="text-lg font-bold font-mono text-amber-400">
                        +{formatRupees(variancePaise)} (Surplus)
                      </span>
                    ) : (
                      <span className="text-lg font-bold font-mono text-rose-400">
                        {formatRupees(variancePaise)} (Shortage)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Discrepancy Reason / Closing Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Closing Remarks / Discrepancy Explanation{' '}
                {variancePaise !== 0 && <span className="text-rose-400">* Required</span>}
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Returned ₹10 loose coin change to customer / Verified morning drawer float of ₹500"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end pt-2">
              <Button
                variant="primary"
                size="md"
                type="submit"
                leftIcon={<FileCheck className="w-4 h-4" />}
                className="bg-emerald-600 hover:bg-emerald-500 border-emerald-500 font-semibold"
              >
                Submit Daily Closing & Audit
              </Button>
            </div>
          </form>
        </div>

        {/* Right Col: Past Closing Audits */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-200">Past Daily Closings</h3>
          </div>

          <div className="space-y-3">
            {closings.length === 0 ? (
              <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/50 text-center text-xs text-slate-500">
                No previous shift closings recorded yet.
              </div>
            ) : (
              closings.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs font-mono"
                >
                  <div className="flex items-start justify-between font-sans">
                    <div>
                      <span className="font-semibold text-white block">{c.closingDate}</span>
                      <span className="text-3xs text-slate-500">Closed by {c.closedByName}</span>
                    </div>
                    <Badge
                      variant={
                        c.cashVariancePaise === 0
                          ? 'success'
                          : c.cashVariancePaise > 0
                          ? 'warning'
                          : 'danger'
                      }
                      size="sm"
                    >
                      {c.cashVariancePaise === 0
                        ? 'EXACT'
                        : c.cashVariancePaise > 0
                        ? `+${formatRupees(c.cashVariancePaise)}`
                        : formatRupees(c.cashVariancePaise)}
                    </Badge>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 space-y-1 text-2xs text-slate-400">
                    <div className="flex justify-between">
                      <span>Expected Cash:</span>
                      <span className="text-slate-200">{formatRupees(c.expectedCashPaise)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Counted Cash:</span>
                      <span className="text-white font-semibold">
                        {formatRupees(c.countedCashPaise)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>GPay Total:</span>
                      <span className="text-blue-400">{formatRupees(c.gpayTotalPaise)}</span>
                    </div>
                  </div>

                  {c.notes && (
                    <p className="text-3xs text-slate-400 italic pt-1 border-t border-slate-800/60 font-sans">
                      "{c.notes}"
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
