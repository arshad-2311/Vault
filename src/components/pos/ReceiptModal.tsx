import React from 'react';
import { Printer, CheckCircle, ArrowLeft, Receipt } from 'lucide-react';
import { Session } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import {
  formatRupees,
  formatDateTime,
  formatDuration,
} from '../../utils/formatters';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  autoPrint?: boolean;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  session,
  autoPrint = false,
}) => {
  React.useEffect(() => {
    if (isOpen && autoPrint && session) {
      const timer = setTimeout(() => {
        window.print();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoPrint, session]);

  if (!session) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Customer Receipt"
      description={`Receipt #${session.id} • ${session.customerName}`}
      maxWidth="md"
      footer={
        <div className="w-full flex items-center justify-between">
          <Button
            variant="secondary"
            size="md"
            type="button"
            onClick={onClose}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Close
          </Button>
          <Button
            variant="primary"
            size="md"
            type="button"
            onClick={handlePrint}
            leftIcon={<Printer className="w-4 h-4" />}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border-amber-400"
          >
            Print Thermal Receipt
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Printable 80mm Thermal Receipt */}
        <div
          id="printable-receipt"
          className="p-5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-3 shadow-inner"
        >
          {/* Header */}
          <div className="text-center pb-3 border-b border-dashed border-slate-700">
            <h3 className="font-extrabold text-base tracking-widest text-white">VAULT 147</h3>
            <p className="text-3xs text-slate-400 tracking-wider">PS5 & 8-BALL SNOOKER LOUNGE</p>
            <p className="text-3xs text-slate-500 mt-1">Receipt ID: {session.id}</p>
            <p className="text-3xs text-slate-500">
              {formatDateTime(session.endTime || session.createdAt)}
            </p>
          </div>

          {/* Session Overview */}
          <div className="space-y-1 text-2xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Customer:</span>
              <span className="font-semibold text-white">{session.customerName}</span>
            </div>
            {session.customerPhone && (
              <div className="flex justify-between">
                <span className="text-slate-400">Contact:</span>
                <span>{session.customerPhone}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-400">Station / Table:</span>
              <span className="font-semibold text-slate-200">
                {session.stationName} ({session.gamingType.toUpperCase()})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Billed Duration:</span>
              <span>{formatDuration(session.durationMinutes)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Staff Operator:</span>
              <span>{session.completedByName || session.createdByName}</span>
            </div>
          </div>

          {/* Itemized Table */}
          <div className="border-t border-b border-dashed border-slate-700 py-2.5 space-y-1.5">
            <div className="flex justify-between text-2xs font-bold text-slate-200">
              <span>Description</span>
              <span>Amount</span>
            </div>
            <div className="flex justify-between text-2xs">
              <span className="truncate max-w-[200px]">
                Gaming ({session.rateSnapshot?.description || session.gamingType.toUpperCase()})
              </span>
              <span className="font-semibold">{formatRupees(session.gamingChargePaise)}</span>
            </div>
            {session.items.map((it) => (
              <div key={it.id} className="flex justify-between text-2xs text-slate-400 pl-2">
                <span>
                  {it.quantity}x {it.name}
                </span>
                <span>{formatRupees(it.lineTotalPaise)}</span>
              </div>
            ))}
            {session.discountPaise > 0 && (
              <div className="flex justify-between text-2xs text-rose-400 font-semibold">
                <span>Discount ({session.discountReason || 'Promo'})</span>
                <span>-{formatRupees(session.discountPaise)}</span>
              </div>
            )}
          </div>

          {/* Totals & Payments */}
          <div className="space-y-1 text-2xs">
            <div className="flex justify-between text-base font-extrabold text-white pt-1">
              <span>FINAL BILL:</span>
              <span className="text-amber-400 font-mono">{formatRupees(session.finalBillPaise)}</span>
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Payment Method:</span>
                <span className="uppercase font-semibold text-slate-200">
                  {session.payment?.method || 'N/A'}
                </span>
              </div>
              {session.payment?.gpayAmountPaise! > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>UPI / GPay Received:</span>
                  <span className="text-blue-400 font-mono">
                    {formatRupees(session.payment?.gpayAmountPaise)}
                  </span>
                </div>
              )}
              {session.payment?.cashAmountPaise! > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Cash Tendered:</span>
                  <span className="text-emerald-400 font-mono">
                    {formatRupees(session.payment?.cashAmountPaise)}
                  </span>
                </div>
              )}
              {session.payment?.changeDuePaise! > 0 && (
                <div className="flex justify-between text-emerald-300 font-bold">
                  <span>Cash Change Returned:</span>
                  <span className="font-mono">{formatRupees(session.payment?.changeDuePaise)}</span>
                </div>
              )}
              {session.payment?.outstandingBalancePaise! > 0 && (
                <div className="flex justify-between text-amber-400 font-bold">
                  <span>Outstanding Balance:</span>
                  <span className="font-mono">
                    {formatRupees(session.payment?.outstandingBalancePaise)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-slate-300 font-bold pt-1">
                <span>Settlement Status:</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  <span>{session.payment?.status || 'SETTLED'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="text-center pt-2.5 border-t border-dashed border-slate-700 text-3xs text-slate-500">
            <p className="font-medium text-slate-400">Thank you for gaming at VAULT 147!</p>
            <p className="mt-0.5">Please visit us again soon.</p>
          </div>
        </div>
      </div>
    </Modal>
  );
};
