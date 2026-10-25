import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  Clock,
  User,
  CreditCard,
  Banknote,
  QrCode,
  AlertTriangle,
  Receipt,
  Printer,
  Sparkles,
  Info,
  ArrowRight,
} from 'lucide-react';
import { Session, PaymentMethod, PaymentStatus } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/storage';
import {
  calculateGamingCharge,
  calculateFinalBill,
  validatePaymentAmounts,
} from '../../utils/pricing';
import {
  formatRupees,
  formatDateTime,
  formatDuration,
  rupeesToPaise,
  formatPaiseToInputRupees,
} from '../../utils/formatters';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  onCheckoutComplete?: () => void;
  onSessionCompleted?: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  session,
  onCheckoutComplete,
  onSessionCompleted,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const pricingConfig = db.getPricingConfig();

  const [endTimeISO, setEndTimeISO] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('gpay');

  // Input strings in Rupees (supports exact decimal paise like "137.50")
  const [gpayInput, setGpayInput] = useState<string>('0');
  const [cashInput, setCashInput] = useState<string>('0');
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [discountReason, setDiscountReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [completedSession, setCompletedSession] = useState<Session | null>(null);

  useEffect(() => {
    if (isOpen && session) {
      const nowISO = new Date().toISOString();
      setEndTimeISO(nowISO);
      setError(null);
      setShowReceipt(false);
      setCompletedSession(null);
      setDiscountInput('0');
      setDiscountReason('');
      setNotes('');

      // Pre-calculate exact initial bill to populate payment default
      const charge = calculateGamingCharge({
        gamingType: session.gamingType,
        billingType: session.billingType,
        startTimeISO: session.startTime,
        endTimeISO: nowISO,
        config: pricingConfig,
        isMultiplayer: session.isMultiplayer,
        fixedPlanId: session.fixedPlanId,
        framesCount: session.framesCount,
      });

      const bill = calculateFinalBill({
        gamingChargePaise: charge.gamingChargePaise,
        snackSubtotalPaise: session.snackSubtotalPaise,
        discountPaise: 0,
      });

      // Populate exact rupees and paise without dropping decimals
      const exactRupees = formatPaiseToInputRupees(bill.finalBillPaise);
      setPaymentMethod('gpay');
      setGpayInput(exactRupees);
      setCashInput('0');
    }
  }, [isOpen, session]);

  if (!session) return null;

  // Real-time recalculation based on current inputs
  const currentEndISO = endTimeISO || new Date().toISOString();
  const chargeCalc = calculateGamingCharge({
    gamingType: session.gamingType,
    billingType: session.billingType,
    startTimeISO: session.startTime,
    endTimeISO: currentEndISO,
    config: pricingConfig,
    isMultiplayer: session.isMultiplayer,
    fixedPlanId: session.fixedPlanId,
    framesCount: session.framesCount,
  });

  const discountPaise = rupeesToPaise(discountInput);
  const billBreakdown = calculateFinalBill({
    gamingChargePaise: chargeCalc.gamingChargePaise,
    snackSubtotalPaise: session.snackSubtotalPaise,
    discountPaise,
  });

  const gpayPaise = rupeesToPaise(gpayInput);
  const cashPaise = rupeesToPaise(cashInput);

  // Validate payment allocations strictly with zero floating loss
  const validation = validatePaymentAmounts({
    method: paymentMethod,
    finalBillPaise: billBreakdown.finalBillPaise,
    gpayAmountPaise: gpayPaise,
    cashAmountPaise: cashPaise,
    allowPartial: pricingConfig.allowPartialPayments,
  });

  const totalReceivedPaise = validation.totalReceivedPaise;
  const balancePaise = validation.outstandingBalancePaise;
  const changeDuePaise = validation.changeDuePaise;

  // Quick payment method selectors
  const handleSetMethod = (method: PaymentMethod) => {
    setPaymentMethod(method);
    const exactBillStr = formatPaiseToInputRupees(billBreakdown.finalBillPaise);

    if (method === 'gpay') {
      setGpayInput(exactBillStr);
      setCashInput('0');
    } else if (method === 'cash') {
      setGpayInput('0');
      setCashInput(exactBillStr);
    } else if (method === 'split') {
      const half = Math.floor(billBreakdown.finalBillPaise / 200);
      const remainder = (billBreakdown.finalBillPaise / 100) - half;
      setGpayInput(half.toString());
      setCashInput(remainder % 1 === 0 ? remainder.toFixed(0) : remainder.toFixed(2));
    }
  };

  const handleAdjustGpayToExact = () => {
    const exactBillStr = formatPaiseToInputRupees(billBreakdown.finalBillPaise);
    setGpayInput(exactBillStr);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Prevent duplicate submissions
    if (isSubmitting) return;

    // Validate employee discount authority
    if (!isAdmin && discountPaise > pricingConfig.maxEmployeeDiscountPaise) {
      setError(
        `Discount of ${formatRupees(discountPaise)} exceeds employee limit of ${formatRupees(
          pricingConfig.maxEmployeeDiscountPaise
        )}. Admin authorization required.`
      );
      return;
    }

    if (!validation.isValid) {
      setError(validation.error || 'Payment validation failed.');
      return;
    }

    try {
      setIsSubmitting(true);
      const finalized = db.completeSession({
        sessionId: session.id,
        endTimeISO: currentEndISO,
        discountPaise,
        discountReason: discountReason.trim() || undefined,
        paymentMethod,
        gpayAmountPaise: gpayPaise,
        cashAmountPaise: cashPaise,
        notes: notes.trim() || undefined,
        actor: currentUser,
      });

      setCompletedSession(finalized);
      setShowReceipt(true);
      onCheckoutComplete?.();
      onSessionCompleted?.();
    } catch (err: any) {
      setError(err.message || 'Failed to complete checkout.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={showReceipt ? 'Transaction Receipt' : 'Checkout & Financial Settlement'}
      description={
        showReceipt
          ? `Receipt #${completedSession?.id || '—'}`
          : `${session.customerName} • ${session.stationName} (${session.gamingType.toUpperCase()})`
      }
      maxWidth="2xl"
      onSubmit={showReceipt ? undefined : handleSubmit}
      footer={
        showReceipt ? (
          <div className="w-full flex items-center justify-between">
            <Button
              variant="secondary"
              size="md"
              type="button"
              onClick={handlePrint}
              leftIcon={<Printer className="w-4 h-4" />}
            >
              Print Receipt
            </Button>
            <Button variant="primary" size="md" type="button" onClick={onClose}>
              Done & Return to POS
            </Button>
          </div>
        ) : (
          <div className="w-full flex items-center justify-between">
            <div className="text-2xs text-slate-400 font-mono">
              Operator: <strong className="text-slate-200">{currentUser.displayName}</strong>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="md" type="button" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                isLoading={isSubmitting}
                leftIcon={<CheckCircle className="w-4 h-4" />}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold border-emerald-500"
              >
                Confirm Payment & End Session
              </Button>
            </div>
          </div>
        )
      }
    >
      {showReceipt && completedSession ? (
        /* Printable Thermal Receipt Card */
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-3">
            <div className="text-center pb-3 border-b border-dashed border-slate-700">
              <h3 className="font-bold text-sm tracking-wider text-white">VAULT 147</h3>
              <p className="text-3xs text-slate-400">PS5 & 8-Ball Snooker Lounge</p>
              <p className="text-3xs text-slate-500 mt-1">Receipt ID: {completedSession.id}</p>
              <p className="text-3xs text-slate-500">
                {formatDateTime(completedSession.endTime || completedSession.createdAt)}
              </p>
            </div>

            <div className="space-y-1 text-2xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Customer:</span>
                <span className="font-semibold text-white">{completedSession.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Station / Table:</span>
                <span>{completedSession.stationName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Billed Duration:</span>
                <span>{formatDuration(completedSession.durationMinutes)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Staff Operator:</span>
                <span>{completedSession.completedByName}</span>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="border-t border-b border-dashed border-slate-700 py-2 space-y-1">
              <div className="flex justify-between text-2xs font-bold text-slate-200">
                <span>Description</span>
                <span>Amount</span>
              </div>
              <div className="flex justify-between text-2xs">
                <span>Gaming Charge ({completedSession.gamingType.toUpperCase()})</span>
                <span>{formatRupees(completedSession.gamingChargePaise)}</span>
              </div>
              {completedSession.items.map((it) => (
                <div key={it.id} className="flex justify-between text-2xs text-slate-400 pl-2">
                  <span>
                    {it.quantity}x {it.name}
                  </span>
                  <span>{formatRupees(it.lineTotalPaise)}</span>
                </div>
              ))}
              {completedSession.discountPaise > 0 && (
                <div className="flex justify-between text-2xs text-rose-400">
                  <span>Discount</span>
                  <span>-{formatRupees(completedSession.discountPaise)}</span>
                </div>
              )}
            </div>

            {/* Totals & Payments */}
            <div className="space-y-1 text-2xs">
              <div className="flex justify-between text-sm font-bold text-white pt-1">
                <span>FINAL BILL:</span>
                <span>{formatRupees(completedSession.finalBillPaise)}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 space-y-0.5">
                <div className="flex justify-between text-slate-400">
                  <span>Payment Method:</span>
                  <span className="uppercase text-slate-200">{completedSession.payment?.method}</span>
                </div>
                {completedSession.payment?.gpayAmountPaise! > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>UPI / GPay Received:</span>
                    <span>{formatRupees(completedSession.payment?.gpayAmountPaise)}</span>
                  </div>
                )}
                {completedSession.payment?.cashAmountPaise! > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Cash Received:</span>
                    <span>{formatRupees(completedSession.payment?.cashAmountPaise)}</span>
                  </div>
                )}
                {completedSession.payment?.changeDuePaise! > 0 && (
                  <div className="flex justify-between text-emerald-400 font-bold">
                    <span>Cash Change Returned:</span>
                    <span>{formatRupees(completedSession.payment?.changeDuePaise)}</span>
                  </div>
                )}
                {completedSession.payment?.outstandingBalancePaise! > 0 && (
                  <div className="flex justify-between text-amber-400 font-bold">
                    <span>Outstanding Due:</span>
                    <span>{formatRupees(completedSession.payment?.outstandingBalancePaise)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-300 font-bold pt-1">
                  <span>Settlement Status:</span>
                  <span className="text-emerald-400">{completedSession.payment?.status}</span>
                </div>
              </div>
            </div>

            <div className="text-center pt-2 border-t border-dashed border-slate-700 text-3xs text-slate-500">
              <p>Thank you for gaming at VAULT 147!</p>
            </div>
          </div>
        </div>
      ) : (
        /* Active Checkout Form */
        <div className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{error}</p>
                {validation.discrepancyNote && paymentMethod === 'gpay' && (
                  <button
                    type="button"
                    onClick={handleAdjustGpayToExact}
                    className="mt-1.5 px-2 py-1 rounded bg-rose-900/80 hover:bg-rose-800 text-white text-2xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <span>Adjust GPay to Exact Bill ({formatRupees(billBreakdown.finalBillPaise)})</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Session Timing & Billed Duration */}
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2.5">
            <div className="grid grid-cols-3 gap-2 p-2.5 rounded bg-slate-900 border border-slate-800/80 text-xs font-mono">
              <div>
                <span className="text-3xs text-slate-500 uppercase block">Started</span>
                <span className="text-slate-200">{formatDateTime(session.startTime)}</span>
              </div>
              <div>
                <span className="text-3xs text-slate-500 uppercase block">Checkout Time</span>
                <span className="text-slate-200">{formatDateTime(currentEndISO)}</span>
              </div>
              <div>
                <span className="text-3xs text-slate-500 uppercase block">Billed Time</span>
                <span className="text-amber-400 font-bold">
                  {formatDuration(chargeCalc.billedMinutes)} ({chargeCalc.actualMinutes}m actual)
                </span>
              </div>
            </div>
            <p className="text-2xs text-slate-400 font-mono italic">
              {chargeCalc.explanation}
            </p>
          </div>

          {/* Itemized Charges & Discounts */}
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between items-center py-0.5">
              <span className="text-slate-300">Gaming Session Charge:</span>
              <span className="font-mono font-semibold text-slate-100">
                {formatRupees(chargeCalc.gamingChargePaise)}
              </span>
            </div>

            {session.items.length > 0 && (
              <div className="border-t border-slate-800/80 pt-1.5 space-y-1">
                <span className="text-3xs text-slate-500 uppercase font-semibold">Drinks & Snacks</span>
                {session.items.map((it) => (
                  <div key={it.id} className="flex justify-between text-slate-400 pl-2">
                    <span>
                      {it.quantity}x {it.name}
                    </span>
                    <span className="font-mono text-slate-300">
                      {formatRupees(it.lineTotalPaise)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between font-medium text-slate-200 pt-1 border-t border-slate-800/40">
                  <span>Snack Subtotal:</span>
                  <span className="font-mono text-amber-400">
                    {formatRupees(session.snackSubtotalPaise)}
                  </span>
                </div>
              </div>
            )}

            {/* Discount Inputs */}
            <div className="border-t border-slate-800/80 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-2xs font-semibold text-slate-400 mb-1">
                  Discount (₹)
                  {!isAdmin && (
                    <span className="text-slate-500 ml-1">
                      (Max ₹{(pricingConfig.maxEmployeeDiscountPaise / 100).toFixed(0)})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100 focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-400 mb-1">
                  Discount Reason / Promo
                </label>
                <input
                  type="text"
                  placeholder="e.g. Regular tournament offer"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:border-amber-500 outline-none"
                />
              </div>
            </div>

            {/* Final Bill Highlight */}
            <div className="mt-2 p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-2xs font-semibold uppercase text-slate-400 block">
                  Final Amount Due
                </span>
                <span className="text-3xs text-slate-500 font-mono">
                  Gross: {formatRupees(billBreakdown.grossTotalPaise)}
                  {billBreakdown.discountPaise > 0 && ` | Disc: -${formatRupees(billBreakdown.discountPaise)}`}
                </span>
              </div>
              <span className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
                {formatRupees(billBreakdown.finalBillPaise)}
              </span>
            </div>
          </div>

          {/* Payment Method & Allocation */}
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">
                Payment Method
              </label>
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => handleSetMethod('gpay')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                    paymentMethod === 'gpay'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>UPI / GPay</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetMethod('cash')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                    paymentMethod === 'cash'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetMethod('split')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                    paymentMethod === 'split'
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Split</span>
                </button>
              </div>
            </div>

            {/* Payment Inputs */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-2xs font-semibold text-slate-400">
                    UPI / GPay Received (₹)
                  </label>
                  {paymentMethod === 'split' && (
                    <button
                      type="button"
                      onClick={() => {
                        const remPaise = Math.max(0, billBreakdown.finalBillPaise - cashPaise);
                        setGpayInput(formatPaiseToInputRupees(remPaise));
                      }}
                      className="text-3xs text-blue-400 hover:text-blue-300 underline font-mono"
                    >
                      Fill Balance
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={gpayInput}
                  disabled={paymentMethod === 'cash'}
                  onChange={(e) => setGpayInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-mono text-slate-100 disabled:opacity-40 focus:border-amber-500 outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-2xs font-semibold text-slate-400">
                    Cash Tendered (₹)
                  </label>
                  {paymentMethod === 'split' && (
                    <button
                      type="button"
                      onClick={() => {
                        const remPaise = Math.max(0, billBreakdown.finalBillPaise - gpayPaise);
                        setCashInput(formatPaiseToInputRupees(remPaise));
                      }}
                      className="text-3xs text-emerald-400 hover:text-emerald-300 underline font-mono"
                    >
                      Fill Balance
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={cashInput}
                  disabled={paymentMethod === 'gpay'}
                  onChange={(e) => setCashInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-mono text-slate-100 disabled:opacity-40 focus:border-amber-500 outline-none"
                />
              </div>
            </div>

            {/* Settlement Status & Math Reconciliation */}
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">
                  Total Collected: <strong className="text-white">{formatRupees(totalReceivedPaise)}</strong>
                </span>

                {changeDuePaise > 0 ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Cash Change Due: {formatRupees(changeDuePaise)}</span>
                  </span>
                ) : balancePaise > 0 ? (
                  <span className="text-amber-400 font-bold">
                    Outstanding Due: {formatRupees(balancePaise)}
                  </span>
                ) : (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Paid in Full</span>
                  </span>
                )}
              </div>

              {changeDuePaise > 0 && (
                <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/50 text-2xs text-emerald-300 font-mono">
                  Cash drawer transaction: Tendered {formatRupees(cashPaise)} - Return {formatRupees(changeDuePaise)} change = Net {formatRupees(cashPaise - changeDuePaise)} drawer cash.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
