import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  QrCode,
  Banknote,
  Receipt,
  Printer,
  CheckCircle,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Session, PaymentMethod } from '../../types';
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
  paiseToRupees,
} from '../../utils/formatters';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  onSessionCompleted: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  session,
  onSessionCompleted,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const pricingConfig = db.getPricingConfig();

  // End time ISO
  const [endTimeISO, setEndTimeISO] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('gpay');

  // Amounts in Rupees for user input
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

      // Pre-calculate initial bill to populate full payment default
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

      const totalRupees = (bill.finalBillPaise / 100).toFixed(0);
      setPaymentMethod('gpay');
      setGpayInput(totalRupees);
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
  const totalReceivedPaise = gpayPaise + cashPaise;
  const balancePaise = Math.max(0, billBreakdown.finalBillPaise - totalReceivedPaise);

  // Quick preset handlers
  const handleSetMethod = (method: PaymentMethod) => {
    setPaymentMethod(method);
    const billRupees = (billBreakdown.finalBillPaise / 100).toFixed(0);

    if (method === 'gpay') {
      setGpayInput(billRupees);
      setCashInput('0');
    } else if (method === 'cash') {
      setGpayInput('0');
      setCashInput(billRupees);
    } else if (method === 'split') {
      // Default to 50/50 split or prompt
      const half = Math.floor(billBreakdown.finalBillPaise / 200);
      const remainder = (billBreakdown.finalBillPaise / 100) - half;
      setGpayInput(half.toString());
      setCashInput(remainder.toString());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate employee discount authority
    if (!isAdmin && discountPaise > pricingConfig.maxEmployeeDiscountPaise) {
      setError(
        `Discount of ${formatRupees(discountPaise)} exceeds employee limit of ${formatRupees(
          pricingConfig.maxEmployeeDiscountPaise
        )}. Admin authorization required.`
      );
      return;
    }

    const validation = validatePaymentAmounts({
      method: paymentMethod,
      finalBillPaise: billBreakdown.finalBillPaise,
      gpayAmountPaise: gpayPaise,
      cashAmountPaise: cashPaise,
      allowPartial: pricingConfig.allowPartialPayments,
    });

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
      onSessionCompleted();
    } catch (err: any) {
      setError(err.message || 'Error completing checkout.');
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
      title={showReceipt ? 'Transaction Receipt' : `Checkout & End Session: ${session.stationName}`}
      description={
        showReceipt
          ? 'Payment recorded and station released.'
          : `Review bill breakdown, apply adjustments, and record payment for ${session.customerName}.`
      }
      maxWidth="2xl"
    >
      {showReceipt && completedSession ? (
        <div className="space-y-6">
          {/* Printable Thermal Receipt Container */}
          <div
            id="printable-receipt"
            className="p-6 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-slate-300 space-y-4 shadow-inner"
          >
            <div className="text-center pb-3 border-b border-dashed border-slate-700">
              <h2 className="text-sm font-bold text-white tracking-wide">
                {pricingConfig.businessName.toUpperCase()}
              </h2>
              <p className="text-3xs text-slate-400">PS5 Gaming & 8-Ball Pool Lounge</p>
              <p className="text-3xs text-slate-500 mt-1">
                Receipt #{completedSession.payment?.id || completedSession.id}
              </p>
              <p className="text-3xs text-slate-500">
                {formatDateTime(completedSession.endTime)}
              </p>
            </div>

            <div className="space-y-1 text-2xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Customer:</span>
                <span className="text-white font-semibold">{completedSession.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Station:</span>
                <span className="text-white">{completedSession.stationName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Duration:</span>
                <span className="text-white">
                  {formatDuration(completedSession.durationMinutes)} (Billed)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Handled By:</span>
                <span className="text-white">{completedSession.completedByName}</span>
              </div>
            </div>

            <div className="border-t border-b border-dashed border-slate-700 py-2 space-y-1.5">
              <div className="flex justify-between font-semibold text-slate-200">
                <span>Gaming Charge:</span>
                <span>{formatRupees(completedSession.gamingChargePaise)}</span>
              </div>
              <p className="text-3xs text-slate-500 italic">
                {completedSession.rateSnapshot.description}
              </p>

              {completedSession.items.map((item) => (
                <div key={item.id} className="flex justify-between text-2xs text-slate-300">
                  <span>
                    {item.quantity}x {item.name}
                  </span>
                  <span>{formatRupees(item.lineTotalPaise)}</span>
                </div>
              ))}

              {completedSession.discountPaise > 0 && (
                <div className="flex justify-between text-emerald-400 text-2xs font-semibold">
                  <span>Discount ({completedSession.discountReason || 'Promo'}):</span>
                  <span>-{formatRupees(completedSession.discountPaise)}</span>
                </div>
              )}
            </div>

            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-sm font-bold text-white">
                <span>TOTAL FINAL BILL:</span>
                <span className="text-emerald-400">
                  {formatRupees(completedSession.finalBillPaise)}
                </span>
              </div>

              <div className="border-t border-slate-800 pt-2 text-2xs space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Payment Mode:</span>
                  <span className="uppercase font-semibold">
                    {completedSession.payment?.method}
                  </span>
                </div>
                {completedSession.payment?.gpayAmountPaise! > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>GPay / UPI Received:</span>
                    <span>{formatRupees(completedSession.payment?.gpayAmountPaise)}</span>
                  </div>
                )}
                {completedSession.payment?.cashAmountPaise! > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Cash Received:</span>
                    <span>{formatRupees(completedSession.payment?.cashAmountPaise)}</span>
                  </div>
                )}
                {completedSession.payment?.outstandingBalancePaise! > 0 && (
                  <div className="flex justify-between text-amber-400 font-bold">
                    <span>Outstanding Due:</span>
                    <span>{formatRupees(completedSession.payment?.outstandingBalancePaise)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="text-center pt-3 border-t border-dashed border-slate-700 text-3xs text-slate-500">
              <p>Thank you for gaming with us!</p>
              <p>No refund without verified bill</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              size="md"
              onClick={handlePrint}
              leftIcon={<Printer className="w-4 h-4" />}
            >
              Print Thermal Receipt
            </Button>
            <Button variant="primary" size="md" onClick={onClose}>
              Done & Return to POS
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Session Overview Card */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-slate-100">{session.customerName}</h4>
                <p className="text-xs text-slate-400">
                  {session.stationName} • {session.gamingType.toUpperCase()}
                </p>
              </div>
              <Badge variant="warning" size="md">
                IN CHECKOUT
              </Badge>
            </div>

            {/* Timestamps & Duration Calculation */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs font-mono">
              <div>
                <span className="text-3xs text-slate-500 uppercase block">Start Time</span>
                <span className="text-slate-200 font-medium">
                  {formatDateTime(session.startTime)}
                </span>
              </div>
              <div>
                <span className="text-3xs text-slate-500 uppercase block">End Time</span>
                <span className="text-slate-200 font-medium">{formatDateTime(currentEndISO)}</span>
              </div>
              <div>
                <span className="text-3xs text-slate-500 uppercase block">Billed Time</span>
                <span className="text-amber-400 font-bold">
                  {formatDuration(chargeCalc.billedMinutes)} ({chargeCalc.actualMinutes}m actual)
                </span>
              </div>
            </div>

            <p className="text-2xs text-slate-400 italic">
              Rate rule: {chargeCalc.explanation}
            </p>
          </div>

          {/* Bill Breakdown Line Items */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
            <h5 className="font-semibold text-slate-300 uppercase tracking-wider text-2xs mb-2">
              Itemized Charges
            </h5>

            <div className="flex justify-between items-center py-1">
              <span className="text-slate-300">Gaming Session Charge:</span>
              <span className="font-mono font-semibold text-slate-100">
                {formatRupees(chargeCalc.gamingChargePaise)}
              </span>
            </div>

            {/* Snacks List */}
            {session.items.length > 0 && (
              <div className="border-t border-slate-800/80 pt-1.5 space-y-1">
                <span className="text-3xs text-slate-500 uppercase">Snacks & Drinks</span>
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
                <div className="flex justify-between font-semibold text-slate-200 pt-1 border-t border-slate-800/40">
                  <span>Snack Subtotal:</span>
                  <span className="font-mono text-amber-400">
                    {formatRupees(session.snackSubtotalPaise)}
                  </span>
                </div>
              </div>
            )}

            {/* Discount Section */}
            <div className="border-t border-slate-800/80 pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-2xs font-semibold text-slate-400 mb-1">
                  Discount Amount (₹)
                  {!isAdmin && (
                    <span className="text-slate-500 ml-1">
                      (Max ₹{(pricingConfig.maxEmployeeDiscountPaise / 100).toFixed(0)})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-slate-100 focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-2xs font-semibold text-slate-400 mb-1">
                  Discount Reason / Promo Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. Regular gamer / Student"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 focus:border-brand-500"
                />
              </div>
            </div>

            {/* Final Bill Total Hero */}
            <div className="mt-3 p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-2xs font-semibold uppercase text-slate-400 block">
                  Final Amount Due
                </span>
                <span className="text-xs text-slate-500">
                  Gross: {formatRupees(billBreakdown.grossTotalPaise)} | Disc: -{formatRupees(billBreakdown.discountPaise)}
                </span>
              </div>
              <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
                {formatRupees(billBreakdown.finalBillPaise)}
              </span>
            </div>
          </div>

          {/* Payment Method & Split Handling */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleSetMethod('gpay')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-semibold transition-all ${
                    paymentMethod === 'gpay'
                      ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>GPay / UPI</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetMethod('cash')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-semibold transition-all ${
                    paymentMethod === 'cash'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Cash</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetMethod('split')}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-semibold transition-all ${
                    paymentMethod === 'split'
                      ? 'bg-purple-600 text-white border-purple-500 shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Split Payment</span>
                </button>
              </div>
            </div>

            {/* Split / Separate Amounts Input */}
            <div className="space-y-2 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-2xs font-semibold text-slate-400">
                      GPay / UPI Received (₹)
                    </label>
                    {paymentMethod === 'split' && (
                      <button
                        type="button"
                        onClick={() => {
                          const remPaise = Math.max(0, billBreakdown.finalBillPaise - cashPaise);
                          setGpayInput((remPaise / 100).toFixed(0));
                        }}
                        className="text-3xs text-brand-400 hover:text-brand-300 underline font-mono"
                      >
                        Fill Balance
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={gpayInput}
                    disabled={paymentMethod === 'cash'}
                    onChange={(e) => setGpayInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-mono text-slate-100 disabled:opacity-40 focus:border-brand-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-2xs font-semibold text-slate-400">
                      Cash Received (₹)
                    </label>
                    {paymentMethod === 'split' && (
                      <button
                        type="button"
                        onClick={() => {
                          const remPaise = Math.max(0, billBreakdown.finalBillPaise - gpayPaise);
                          setCashInput((remPaise / 100).toFixed(0));
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
                    step="1"
                    value={cashInput}
                    disabled={paymentMethod === 'gpay'}
                    onChange={(e) => setCashInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-mono text-slate-100 disabled:opacity-40 focus:border-brand-500"
                  />
                </div>
              </div>

              {paymentMethod === 'split' && (
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60 text-3xs font-mono">
                  <span className="text-slate-500">Quick Split:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const half = Math.floor(billBreakdown.finalBillPaise / 200);
                      const rem = (billBreakdown.finalBillPaise / 100) - half;
                      setGpayInput(half.toString());
                      setCashInput(rem.toString());
                    }}
                    className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                  >
                    50% / 50%
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGpayInput('200');
                      const rem = Math.max(0, (billBreakdown.finalBillPaise / 100) - 200);
                      setCashInput(rem.toString());
                    }}
                    className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                  >
                    ₹200 GPay + Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCashInput('100');
                      const rem = Math.max(0, (billBreakdown.finalBillPaise / 100) - 100);
                      setGpayInput(rem.toString());
                    }}
                    className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
                  >
                    ₹100 Cash + GPay
                  </button>
                </div>
              )}
            </div>

            {/* Real-time Math Summary */}
            <div className="flex items-center justify-between text-xs px-1 font-mono">
              <span className="text-slate-400">
                Total Collected: <strong>{formatRupees(totalReceivedPaise)}</strong>
              </span>
              {balancePaise > 0 ? (
                <span className="text-amber-400 font-semibold">
                  Outstanding Balance: {formatRupees(balancePaise)}
                </span>
              ) : (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Paid in Full</span>
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-2xs text-slate-500 font-mono">
              Operator: {currentUser.displayName}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="md" type="button" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                isLoading={isSubmitting}
                leftIcon={<CheckCircle className="w-4 h-4" />}
                className="bg-emerald-600 hover:bg-emerald-500 border-emerald-500 font-semibold"
              >
                Confirm Payment & End Session
              </Button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};
