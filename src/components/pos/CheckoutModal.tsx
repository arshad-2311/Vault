import React, { useState, useEffect } from 'react';
import {
  CheckCircle,
  Clock,
  User,
  CreditCard,
  Banknote,
  QrCode,
  AlertTriangle,
  Printer,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { Session, PaymentMethod } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
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
  onCheckoutComplete?: (completedSession?: Session) => void;
  onSessionCompleted?: (completedSession?: Session) => void;
  onPrintReceipt?: (completedSession: Session) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  session,
  onCheckoutComplete,
  onSessionCompleted,
  onPrintReceipt,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const pricingConfig = db.getPricingConfig();

  const [activeSession, setActiveSession] = useState<Session | null>(session);
  const [endTimeISO, setEndTimeISO] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('gpay');
  const [customMinutes, setCustomMinutes] = useState<number | null>(null);

  // Input strings in Rupees (supports exact decimal paise like "137.50")
  const [gpayInput, setGpayInput] = useState<string>('0');
  const [cashInput, setCashInput] = useState<string>('0');
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [discountReason, setDiscountReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && session) {
      setActiveSession(session);
      const nowISO = new Date().toISOString();
      setEndTimeISO(nowISO);
      setError(null);
      setIsSubmitting(false);
      setCustomMinutes(null);
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
        controllersCount: session.controllersCount,
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

  if (!activeSession) return null;

  // Real-time recalculation based on current inputs
  const currentEndISO = endTimeISO || new Date().toISOString();
  const chargeCalc = calculateGamingCharge({
    gamingType: activeSession.gamingType,
    billingType: activeSession.billingType,
    startTimeISO: activeSession.startTime,
    endTimeISO: currentEndISO,
    config: pricingConfig,
    isMultiplayer: activeSession.isMultiplayer,
    controllersCount: activeSession.controllersCount,
    fixedPlanId: activeSession.fixedPlanId,
    framesCount: activeSession.framesCount,
    customBilledMinutes: customMinutes !== null ? customMinutes : undefined,
  });

  const discountPaise = rupeesToPaise(discountInput);
  const billBreakdown = calculateFinalBill({
    gamingChargePaise: chargeCalc.gamingChargePaise,
    snackSubtotalPaise: activeSession.snackSubtotalPaise,
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
    setError(null);
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

  const applyDiscountValue = (discountRupeesStr: string, reason?: string) => {
    setDiscountInput(discountRupeesStr);
    if (reason) setDiscountReason(reason);
    const dPaise = rupeesToPaise(discountRupeesStr);
    const grossPaise = chargeCalc.gamingChargePaise + activeSession.snackSubtotalPaise;
    const newFinalPaise = Math.max(0, grossPaise - dPaise);
    const exactRupees = formatPaiseToInputRupees(newFinalPaise);
    if (paymentMethod === 'gpay') {
      setGpayInput(exactRupees);
      setCashInput('0');
    } else if (paymentMethod === 'cash') {
      setCashInput(exactRupees);
      setGpayInput('0');
    }
  };

  const handleRemoveSnackItem = (itemId: string) => {
    if (!activeSession) return;
    try {
      const updated = db.removeSnackFromSession({
        sessionId: activeSession.id,
        itemId,
        actor: currentUser,
      });
      setActiveSession(updated);
      const charge = calculateGamingCharge({
        gamingType: updated.gamingType,
        billingType: updated.billingType,
        startTimeISO: updated.startTime,
        endTimeISO: currentEndISO,
        config: pricingConfig,
        isMultiplayer: updated.isMultiplayer,
        controllersCount: updated.controllersCount,
        fixedPlanId: updated.fixedPlanId,
        framesCount: updated.framesCount,
      });
      const newBill = calculateFinalBill({
        gamingChargePaise: charge.gamingChargePaise,
        snackSubtotalPaise: updated.snackSubtotalPaise,
        discountPaise,
      });
      const exactRupees = formatPaiseToInputRupees(newBill.finalBillPaise);
      if (paymentMethod === 'gpay') {
        setGpayInput(exactRupees);
      } else if (paymentMethod === 'cash') {
        setCashInput(exactRupees);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove snack.');
    }
  };

  const executeCheckout = (triggerPrint: boolean) => {
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
        sessionId: activeSession.id,
        endTimeISO: currentEndISO,
        discountPaise,
        discountReason: discountReason.trim() || undefined,
        paymentMethod,
        gpayAmountPaise: gpayPaise,
        cashAmountPaise: cashPaise,
        customBilledMinutes: customMinutes !== null ? customMinutes : undefined,
        notes: notes.trim() || undefined,
        actor: currentUser,
      });

      // Instant UI exit: close modal immediately in 0ms!
      onClose();

      // Trigger completion callbacks
      onCheckoutComplete?.(finalized);
      onSessionCompleted?.(finalized);

      if (triggerPrint) {
        onPrintReceipt?.(finalized);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete checkout.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeCheckout(false);
  };

  const handleSubmitWithPrint = (e: React.MouseEvent) => {
    e.preventDefault();
    executeCheckout(true);
  };

  const handleClose = () => {
    setIsSubmitting(false);
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="End Payment & Settle Session"
      description={`${activeSession.customerName} • ${activeSession.stationName} (${activeSession.gamingType.toUpperCase()})`}
      maxWidth="2xl"
      onSubmit={handleSubmit}
      footer={
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-2xs text-slate-400 font-mono w-full sm:w-auto text-left">
            Staff: <strong className="text-slate-200">{currentUser.displayName}</strong>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="secondary"
              size="md"
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="md"
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmitWithPrint}
              leftIcon={<Printer className="w-4 h-4 text-red-400" />}
              className="hover:border-red-500 hover:text-red-300"
            >
              End & Print
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              isLoading={isSubmitting}
              leftIcon={<CheckCircle className="w-4 h-4" />}
              className="bg-red-600 hover:bg-red-500 text-white font-bold border-red-500 shadow-md shadow-red-950/60"
            >
              End Payment & Settle ({formatRupees(billBreakdown.finalBillPaise)})
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-950/70 border border-red-800 text-red-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{error}</p>
              {validation.discrepancyNote && paymentMethod === 'gpay' && (
                <button
                  type="button"
                  onClick={handleAdjustGpayToExact}
                  className="mt-1.5 px-2 py-1 rounded bg-red-900/80 hover:bg-red-800 text-white text-2xs font-semibold flex items-center gap-1 transition-colors"
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
              <span className="text-slate-200">{formatDateTime(activeSession.startTime)}</span>
            </div>
            <div>
              <span className="text-3xs text-slate-500 uppercase block">Checkout Time</span>
              <span className="text-slate-200">{formatDateTime(currentEndISO)}</span>
            </div>
            <div>
              <span className="text-3xs text-slate-500 uppercase block">Billed Time</span>
              <span className="text-red-400 font-bold">
                {formatDuration(chargeCalc.billedMinutes)} ({chargeCalc.actualMinutes}m actual)
              </span>
            </div>
          </div>

          {/* Interactive Billed Minutes Tuner */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-black/40 border border-white/[0.06]">
            <div className="flex items-center gap-1.5">
              <span className="text-2xs text-slate-300 font-semibold">Adjust Billed Minutes:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Subtract 5 minutes"
                  onClick={() => {
                    const cur = customMinutes ?? chargeCalc.billedMinutes;
                    setCustomMinutes(Math.max(1, cur - 5));
                  }}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-mono font-bold text-zinc-200"
                >
                  -5m
                </button>
                <button
                  type="button"
                  title="Subtract 1 minute"
                  onClick={() => {
                    const cur = customMinutes ?? chargeCalc.billedMinutes;
                    setCustomMinutes(Math.max(1, cur - 1));
                  }}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-mono font-bold text-zinc-200"
                >
                  -1m
                </button>
                <input
                  type="number"
                  min="1"
                  value={customMinutes ?? chargeCalc.billedMinutes}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setCustomMinutes(isNaN(val) ? null : Math.max(1, val));
                  }}
                  className="w-14 px-1 py-0.5 text-center rounded bg-black border border-zinc-700 text-xs font-mono font-bold text-white focus:border-red-500 outline-none"
                />
                <span className="text-3xs font-mono text-zinc-400">m</span>
                <button
                  type="button"
                  title="Add 1 minute"
                  onClick={() => {
                    const cur = customMinutes ?? chargeCalc.billedMinutes;
                    setCustomMinutes(cur + 1);
                  }}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-mono font-bold text-zinc-200"
                >
                  +1m
                </button>
                <button
                  type="button"
                  title="Add 5 minutes"
                  onClick={() => {
                    const cur = customMinutes ?? chargeCalc.billedMinutes;
                    setCustomMinutes(cur + 5);
                  }}
                  className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-mono font-bold text-zinc-200"
                >
                  +5m
                </button>
                {customMinutes !== null && (
                  <button
                    type="button"
                    onClick={() => setCustomMinutes(null)}
                    className="text-3xs text-red-400 hover:text-red-300 underline font-mono ml-1"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
            {customMinutes !== null && (
              <span className="text-3xs font-mono text-amber-400 font-semibold">
                Manual override active
              </span>
            )}
          </div>

          <p className="text-2xs text-slate-400 font-mono italic">
            {chargeCalc.explanation}
          </p>
        </div>

        {/* Itemized Charges & Discounts */}
        <div className="p-3.5 rounded-lg bg-[#08080c] border border-white/[0.08] space-y-2 text-xs">
          <div className="flex justify-between items-center py-0.5">
            <span className="text-slate-300">Gaming Session Charge:</span>
            <span className="font-mono font-semibold text-slate-100">
              {formatRupees(chargeCalc.gamingChargePaise)}
            </span>
          </div>

          {activeSession.items.length > 0 && (
            <div className="border-t border-white/[0.06] pt-1.5 space-y-1">
              <div className="flex items-center justify-between pb-0.5">
                <span className="text-3xs text-slate-400 uppercase font-semibold">Drinks & Snacks</span>
                <span className="text-3xs text-slate-500 font-mono">Click trash to remove item</span>
              </div>
              {activeSession.items.map((it) => (
                <div key={it.id} className="flex items-center justify-between text-slate-300 pl-1 py-0.5 group">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      title="Remove snack from bill"
                      onClick={() => handleRemoveSnackItem(it.id)}
                      className="p-1 rounded hover:bg-red-950/80 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span>
                      {it.quantity}x {it.name}
                    </span>
                  </div>
                  <span className="font-mono text-slate-200">
                    {formatRupees(it.lineTotalPaise)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between font-medium text-slate-200 pt-1 border-t border-white/[0.04]">
                <span>Snack Subtotal:</span>
                <span className="font-mono text-red-400 font-semibold">
                  {formatRupees(activeSession.snackSubtotalPaise)}
                </span>
              </div>
            </div>
          )}

          {/* Quick 1-Click Round-Off Buttons */}
          {(() => {
            const grossRupees = Math.round((chargeCalc.gamingChargePaise + activeSession.snackSubtotalPaise) / 100);
            const round50 = Math.floor(grossRupees / 50) * 50;
            const diff50 = grossRupees - round50;
            const round10 = Math.floor(grossRupees / 10) * 10;
            const diff10 = grossRupees - round10;
            const hasOptions = (diff50 > 0 && round50 > 0) || (diff10 > 0 && round10 > 0 && diff10 !== diff50);

            if (!hasOptions && Number(discountInput) <= 0) return null;

            return (
              <div className="border-t border-white/[0.06] pt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-3xs uppercase font-mono text-slate-400 font-bold">Round Off:</span>
                {diff50 > 0 && round50 > 0 && (
                  <button
                    type="button"
                    onClick={() => applyDiscountValue(diff50.toString(), `Round off to ₹${round50}`)}
                    className="px-2.5 py-1 rounded-md bg-red-950/40 hover:bg-red-900/60 text-xs font-mono font-bold text-red-300 border border-red-700/60 transition-colors"
                  >
                    Round to ₹{round50} (-₹{diff50})
                  </button>
                )}
                {diff10 > 0 && round10 > 0 && diff10 !== diff50 && (
                  <button
                    type="button"
                    onClick={() => applyDiscountValue(diff10.toString(), `Round off to ₹${round10}`)}
                    className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-mono font-bold text-zinc-200 border border-zinc-700 transition-colors"
                  >
                    Round to ₹{round10} (-₹{diff10})
                  </button>
                )}
                {Number(discountInput) > 0 && (
                  <button
                    type="button"
                    onClick={() => applyDiscountValue('0', '')}
                    className="px-2 py-0.5 rounded text-3xs text-zinc-400 hover:text-white underline font-mono ml-auto"
                  >
                    Remove Discount
                  </button>
                )}
              </div>
            );
          })()}

          {/* Discount Inputs */}
          <div className="border-t border-white/[0.06] pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                onChange={(e) => applyDiscountValue(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-1.5 rounded-md bg-[#050507] border border-white/[0.1] text-xs font-mono text-slate-100 focus:border-red-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-2xs font-semibold text-slate-400 mb-1">
                Discount Reason / Promo
              </label>
              <input
                type="text"
                placeholder="e.g. Round off, Regular customer"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                className="w-full px-3 py-1.5 rounded-md bg-[#050507] border border-white/[0.1] text-xs text-slate-100 focus:border-red-500 outline-none"
              />
            </div>
          </div>

          {/* Final Bill Highlight */}
          <div className="mt-2 p-3 rounded-lg bg-[#0e0e14] border border-red-950/50 flex items-center justify-between">
            <div>
              <span className="text-2xs font-semibold uppercase text-slate-400 block">
                Final Amount Due
              </span>
              <span className="text-3xs text-slate-500 font-mono">
                Gross: {formatRupees(billBreakdown.grossTotalPaise)}
                {billBreakdown.discountPaise > 0 && ` | Disc: -${formatRupees(billBreakdown.discountPaise)}`}
              </span>
            </div>
            <span className="text-2xl font-black font-mono text-white tabular-nums">
              {formatRupees(billBreakdown.finalBillPaise)}
            </span>
          </div>
        </div>

        {/* Payment Method & Allocation */}
        <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-300">
              Payment Method
            </label>
            <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => handleSetMethod('gpay')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                  paymentMethod === 'gpay'
                    ? 'bg-red-600 text-white font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>UPI / GPay</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetMethod('cash')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                  paymentMethod === 'cash'
                    ? 'bg-red-600 text-white font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>Cash</span>
              </button>

              <button
                type="button"
                onClick={() => handleSetMethod('split')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all flex items-center gap-1.5 ${
                  paymentMethod === 'split'
                    ? 'bg-red-600 text-white font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Split</span>
              </button>
            </div>
          </div>

          {/* Quick Accidental Switch Pill */}
          <div className="flex items-center justify-between text-2xs p-2 rounded-lg bg-zinc-900/60 border border-zinc-800">
            <span className="text-zinc-400">Accidental click?</span>
            {paymentMethod === 'gpay' ? (
              <button
                type="button"
                onClick={() => handleSetMethod('cash')}
                className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-red-400 hover:text-red-300 font-bold font-mono transition-colors flex items-center gap-1.5"
              >
                <span>⇄ Switch to Cash</span>
              </button>
            ) : paymentMethod === 'cash' ? (
              <button
                type="button"
                onClick={() => handleSetMethod('gpay')}
                className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-red-400 hover:text-red-300 font-bold font-mono transition-colors flex items-center gap-1.5"
              >
                <span>⇄ Switch to GPay / UPI</span>
              </button>
            ) : (
              <span className="text-3xs text-zinc-500 font-mono">Split payment active</span>
            )}
          </div>

          {/* Payment Inputs */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[#08080c] border border-zinc-800">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-2xs font-semibold text-zinc-400">
                  UPI / GPay Received (₹)
                </label>
                {paymentMethod === 'split' && (
                  <button
                    type="button"
                    onClick={() => {
                      const remPaise = Math.max(0, billBreakdown.finalBillPaise - cashPaise);
                      setGpayInput(formatPaiseToInputRupees(remPaise));
                    }}
                    className="text-3xs text-red-400 hover:text-red-300 underline font-mono"
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
                className="w-full px-3 py-2 rounded-lg bg-[#050507] border border-zinc-800 text-sm font-mono text-white disabled:opacity-40 focus:border-red-500 outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-2xs font-semibold text-zinc-400">
                  Cash Tendered (₹)
                </label>
                {paymentMethod === 'split' && (
                  <button
                    type="button"
                    onClick={() => {
                      const remPaise = Math.max(0, billBreakdown.finalBillPaise - gpayPaise);
                      setCashInput(formatPaiseToInputRupees(remPaise));
                    }}
                    className="text-3xs text-red-400 hover:text-red-300 underline font-mono"
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
                className="w-full px-3 py-2 rounded-lg bg-[#050507] border border-zinc-800 text-sm font-mono text-white disabled:opacity-40 focus:border-red-500 outline-none"
              />
            </div>
          </div>

          {/* Settlement Status & Math Reconciliation */}
          <div className="p-3 rounded-lg bg-[#08080c] border border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400">
                Total Collected: <strong className="text-white">{formatRupees(totalReceivedPaise)}</strong>
              </span>

              {changeDuePaise > 0 ? (
                <span className="text-zinc-200 font-bold flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Cash Change Due: {formatRupees(changeDuePaise)}</span>
                </span>
              ) : balancePaise > 0 ? (
                <span className="text-red-400 font-bold">
                  Outstanding Due: {formatRupees(balancePaise)}
                </span>
              ) : (
                <span className="text-zinc-200 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Paid in Full</span>
                </span>
              )}
            </div>

            {changeDuePaise > 0 && (
              <div className="p-2 rounded bg-zinc-900 border border-zinc-800 text-2xs text-zinc-300 font-mono">
                Cash drawer transaction: Tendered {formatRupees(cashPaise)} - Return {formatRupees(changeDuePaise)} change = Net {formatRupees(cashPaise - changeDuePaise)} drawer cash.
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
