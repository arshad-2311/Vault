import React, { useState, useEffect } from 'react';
import {
  Banknote,
  CreditCard,
  PlusCircle,
  Edit2,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  History,
  Check,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/storage';
import { Session } from '../../types';
import { formatRupees, formatDateTime, getTodayDateString } from '../../utils/formatters';

interface ManualSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetDate?: string;
  onSalesUpdated?: () => void;
}

export const ManualSalesModal: React.FC<ManualSalesModalProps> = ({
  isOpen,
  onClose,
  targetDate = getTodayDateString(),
  onSalesUpdated,
}) => {
  const { currentUser, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'add_entry' | 'edit_session'>('add_entry');

  // Form State for Adding Manual Sales
  const [saleDate, setSaleDate] = useState(targetDate);
  const [customerName, setCustomerName] = useState('Manual Sales Entry');
  const [amountRupees, setAmountRupees] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gpay' | 'split'>('cash');
  const [cashAmountRupees, setCashAmountRupees] = useState('');
  const [gpayAmountRupees, setGpayAmountRupees] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sessions for the selected date
  const [daySessions, setDaySessions] = useState<Session[]>([]);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionEditBillRupees, setSessionEditBillRupees] = useState('');
  const [sessionEditMethod, setSessionEditMethod] = useState<'cash' | 'gpay' | 'split'>('cash');
  const [sessionEditCashRupees, setSessionEditCashRupees] = useState('');
  const [sessionEditGpayRupees, setSessionEditGpayRupees] = useState('');
  const [sessionEditNotes, setSessionEditNotes] = useState('');

  // Load day sessions
  const loadSessions = () => {
    const all = db.getSessions();
    const filtered = all.filter((s) => {
      if (s.isVoided) return false;
      const sDate = s.startTime.split('T')[0];
      return sDate === saleDate && s.status === 'completed';
    });
    setDaySessions(filtered);
  };

  useEffect(() => {
    if (isOpen) {
      setSaleDate(targetDate);
      setErrorMsg(null);
      setSuccessMsg(null);
      setEditingSessionId(null);
    }
  }, [isOpen, targetDate]);

  useEffect(() => {
    if (isOpen) {
      loadSessions();
    }
  }, [isOpen, saleDate]);

  const handleAmountChange = (val: string) => {
    setAmountRupees(val);
    const num = Math.max(0, parseFloat(val) || 0);
    if (paymentMethod === 'cash') {
      setCashAmountRupees(num.toString());
      setGpayAmountRupees('0');
    } else if (paymentMethod === 'gpay') {
      setGpayAmountRupees(num.toString());
      setCashAmountRupees('0');
    } else {
      const half = (num / 2).toFixed(2);
      const otherHalf = (num - parseFloat(half)).toFixed(2);
      setGpayAmountRupees(half);
      setCashAmountRupees(otherHalf);
    }
  };

  const handleMethodChange = (method: 'cash' | 'gpay' | 'split') => {
    setPaymentMethod(method);
    const num = Math.max(0, parseFloat(amountRupees) || 0);
    if (method === 'cash') {
      setCashAmountRupees(num.toString());
      setGpayAmountRupees('0');
    } else if (method === 'gpay') {
      setGpayAmountRupees(num.toString());
      setCashAmountRupees('0');
    } else {
      const half = (num / 2).toFixed(2);
      const otherHalf = (num - parseFloat(half)).toFixed(2);
      setGpayAmountRupees(half);
      setCashAmountRupees(otherHalf);
    }
  };

  const handleAddManualSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isAdmin) {
      setErrorMsg('Access Restricted: Only Administrators can adjust finalized sales.');
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);

    const amount = parseFloat(amountRupees);
    if (isNaN(amount) || amount <= 0) {
      setErrorMsg('Please enter a valid sales amount greater than ₹0.');
      return;
    }

    const amountPaise = Math.round(amount * 100);
    let cashPaise = 0;
    let gpayPaise = 0;

    if (paymentMethod === 'cash') {
      cashPaise = amountPaise;
      gpayPaise = 0;
    } else if (paymentMethod === 'gpay') {
      gpayPaise = amountPaise;
      cashPaise = 0;
    } else {
      cashPaise = Math.round((parseFloat(cashAmountRupees) || 0) * 100);
      gpayPaise = Math.round((parseFloat(gpayAmountRupees) || 0) * 100);
      if (cashPaise + gpayPaise < amountPaise) {
        setErrorMsg(
          `Total split payment (₹${((cashPaise + gpayPaise) / 100).toFixed(2)}) must equal or cover the sales amount (₹${amount.toFixed(2)}).`
        );
        return;
      }
    }

    try {
      db.createManualSalesAdjustment({
        date: saleDate,
        amountPaise,
        customerName: customerName.trim() || 'Manual Sales Entry',
        paymentMethod,
        cashAmountPaise: cashPaise,
        gpayAmountPaise: gpayPaise,
        notes: notes.trim() || undefined,
        actor: currentUser,
      });

      setSuccessMsg(`Manual finalized sale of ₹${amount.toFixed(0)} added and synced successfully.`);
      setAmountRupees('');
      setCashAmountRupees('');
      setGpayAmountRupees('');
      setNotes('');
      loadSessions();
      onSalesUpdated?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add manual sales entry.');
    }
  };

  const startEditSession = (session: Session) => {
    setEditingSessionId(session.id);
    const bill = (session.finalBillPaise / 100).toString();
    setSessionEditBillRupees(bill);
    setSessionEditMethod(session.payment?.method || 'cash');
    setSessionEditCashRupees(((session.payment?.cashAmountPaise || session.finalBillPaise) / 100).toString());
    setSessionEditGpayRupees(((session.payment?.gpayAmountPaise || 0) / 100).toString());
    setSessionEditNotes(session.payment?.notes || '');
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSaveSessionEdit = (sessionId: string) => {
    if (!currentUser || !isAdmin) return;
    setErrorMsg(null);

    const billNum = parseFloat(sessionEditBillRupees);
    if (isNaN(billNum) || billNum < 0) {
      setErrorMsg('Please enter a valid bill amount (₹0 or greater).');
      return;
    }

    const finalBillPaise = Math.round(billNum * 100);
    let cashPaise = 0;
    let gpayPaise = 0;

    if (sessionEditMethod === 'cash') {
      cashPaise = finalBillPaise;
      gpayPaise = 0;
    } else if (sessionEditMethod === 'gpay') {
      gpayPaise = finalBillPaise;
      cashPaise = 0;
    } else {
      cashPaise = Math.round((parseFloat(sessionEditCashRupees) || 0) * 100);
      gpayPaise = Math.round((parseFloat(sessionEditGpayRupees) || 0) * 100);
      if (cashPaise + gpayPaise < finalBillPaise) {
        setErrorMsg(
          `Total split payment (₹${((cashPaise + gpayPaise) / 100).toFixed(2)}) must equal or exceed bill total (₹${billNum.toFixed(2)}).`
        );
        return;
      }
    }

    try {
      db.updatePaymentDetails({
        sessionId,
        method: sessionEditMethod,
        cashAmountPaise: cashPaise,
        gpayAmountPaise: gpayPaise,
        finalBillPaise,
        notes: sessionEditNotes.trim() || undefined,
        actor: currentUser,
      });

      setSuccessMsg(`Session finalized bill updated to ₹${billNum.toFixed(0)} successfully!`);
      setEditingSessionId(null);
      loadSessions();
      onSalesUpdated?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update session bill.');
    }
  };

  const totalSalesPaise = daySessions.reduce((sum, s) => sum + s.finalBillPaise, 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manual Finalized Sales Management"
      description="Edit or add to total finalized sales for the business ledger (Admin Only)"
      maxWidth="lg"
    >
      <div className="space-y-4 text-zinc-100">
        {/* Date Selector & Total Header */}
        <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-3xs uppercase tracking-wider text-zinc-400 font-mono block">
              Audited Sales for Selected Date
            </span>
            <div className="text-xl font-black font-mono text-white mt-0.5">
              {formatRupees(totalSalesPaise)}
            </div>
            <span className="text-3xs text-zinc-500 font-mono">
              From {daySessions.length} settled transaction(s)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-2xs font-mono text-zinc-400">Date:</label>
            <input
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-zinc-700 text-xs font-mono text-white outline-none focus:border-red-500"
            />
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex rounded-xl bg-zinc-900 p-1 border border-zinc-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setActiveTab('add_entry');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 rounded-lg font-bold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'add_entry'
                ? 'bg-red-600 text-white shadow-md shadow-red-950/60'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Add Manual Finalized Sale</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('edit_session');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`flex-1 py-2 rounded-lg font-bold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'edit_session'
                ? 'bg-red-600 text-white shadow-md shadow-red-950/60'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Edit Settled Bills ({daySessions.length})</span>
          </button>
        </div>

        {/* Feedback alerts */}
        {errorMsg && (
          <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB 1: Add Manual Finalized Sale Entry */}
        {activeTab === 'add_entry' && (
          <form onSubmit={handleAddManualSale} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-2xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
                  Customer / Event / Description
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Tournament Fee / Manual Sale"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 outline-none focus:border-red-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-2xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
                  Sale Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400 font-mono font-bold">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={amountRupees}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="e.g. 500"
                    required
                    className="w-full pl-8 pr-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm text-white font-mono font-black outline-none focus:border-red-500"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-1.5">
              <label className="block text-2xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
                Received Via Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleMethodChange('cash')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'cash'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/60'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  Full Cash
                </button>
                <button
                  type="button"
                  onClick={() => handleMethodChange('gpay')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'gpay'
                      ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-950/60'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Full GPay
                </button>
                <button
                  type="button"
                  onClick={() => handleMethodChange('split')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    paymentMethod === 'split'
                      ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-950/60'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                  }`}
                >
                  Split
                </button>
              </div>
            </div>

            {/* Split breakdown */}
            {paymentMethod === 'split' && (
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-3xs font-mono font-bold text-sky-400 uppercase">
                    GPay (₹)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={gpayAmountRupees}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGpayAmountRupees(val);
                      const gNum = parseFloat(val) || 0;
                      const tot = parseFloat(amountRupees) || 0;
                      setCashAmountRupees(Math.max(0, tot - gNum).toString());
                    }}
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-white font-mono font-bold outline-none focus:border-sky-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-3xs font-mono font-bold text-emerald-400 uppercase">
                    Cash (₹)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={cashAmountRupees}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCashAmountRupees(val);
                      const cNum = parseFloat(val) || 0;
                      const tot = parseFloat(amountRupees) || 0;
                      setGpayAmountRupees(Math.max(0, tot - cNum).toString());
                    }}
                    className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs text-white font-mono font-bold outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1">
              <label className="block text-2xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
                Admin Notes / Reason (Audited)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Offline customer payment adjustment, verified by admin"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" type="button" onClick={onClose}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                className="bg-red-600 hover:bg-red-500 text-white font-bold px-4"
              >
                Add to Finalized Sales & Sync
              </Button>
            </div>
          </form>
        )}

        {/* TAB 2: Edit Settled Bills from this Day */}
        {activeTab === 'edit_session' && (
          <div className="space-y-3">
            {daySessions.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 font-mono">
                No settled transactions found for {saleDate}.
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
                {daySessions.map((s) => {
                  const isEditing = editingSessionId === s.id;
                  return (
                    <div
                      key={s.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isEditing
                          ? 'bg-zinc-900 border-red-500/80 shadow-md shadow-red-950/40 space-y-3'
                          : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{s.customerName}</span>
                            <Badge variant={s.gamingType === 'ps5' ? 'info' : 'purple'} size="sm">
                              {s.stationName}
                            </Badge>
                          </div>
                          <p className="text-3xs text-zinc-500 font-mono mt-0.5">
                            {formatDateTime(s.startTime)} • Method: {s.payment?.method.toUpperCase()}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono font-black text-white">
                            {formatRupees(s.finalBillPaise)}
                          </span>
                          {!isEditing ? (
                            <button
                              type="button"
                              onClick={() => startEditSession(s)}
                              className="px-2 py-1 rounded-lg text-3xs font-mono font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition-colors flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3 text-red-400" />
                              <span>Edit Bill</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingSessionId(null)}
                              className="px-2 py-1 rounded-lg text-3xs font-mono text-zinc-400 hover:text-white"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Inline Session Bill Editor */}
                      {isEditing && (
                        <div className="pt-2 border-t border-zinc-800 space-y-2.5 animate-in fade-in">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-3xs font-mono uppercase text-zinc-400 font-bold mb-1">
                                New Bill Amount (₹)
                              </label>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                value={sessionEditBillRupees}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSessionEditBillRupees(val);
                                  const num = Math.max(0, parseFloat(val) || 0);
                                  if (sessionEditMethod === 'cash') {
                                    setSessionEditCashRupees(num.toString());
                                    setSessionEditGpayRupees('0');
                                  } else if (sessionEditMethod === 'gpay') {
                                    setSessionEditGpayRupees(num.toString());
                                    setSessionEditCashRupees('0');
                                  } else {
                                    const half = (num / 2).toFixed(2);
                                    const otherHalf = (num - parseFloat(half)).toFixed(2);
                                    setSessionEditGpayRupees(half);
                                    setSessionEditCashRupees(otherHalf);
                                  }
                                }}
                                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs font-mono font-bold text-white outline-none focus:border-red-500"
                              />
                            </div>

                            <div>
                              <label className="block text-3xs font-mono uppercase text-zinc-400 font-bold mb-1">
                                Payment Method
                              </label>
                              <select
                                value={sessionEditMethod}
                                onChange={(e) => {
                                  const m = e.target.value as 'cash' | 'gpay' | 'split';
                                  setSessionEditMethod(m);
                                  const tot = parseFloat(sessionEditBillRupees) || 0;
                                  if (m === 'cash') {
                                    setSessionEditCashRupees(tot.toString());
                                    setSessionEditGpayRupees('0');
                                  } else if (m === 'gpay') {
                                    setSessionEditGpayRupees(tot.toString());
                                    setSessionEditCashRupees('0');
                                  } else {
                                    const half = (tot / 2).toFixed(2);
                                    setSessionEditGpayRupees(half);
                                    setSessionEditCashRupees((tot - parseFloat(half)).toFixed(2));
                                  }
                                }}
                                className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-700 rounded-lg text-xs font-mono text-white outline-none focus:border-red-500"
                              >
                                <option value="cash">Full Cash</option>
                                <option value="gpay">Full GPay</option>
                                <option value="split">Split</option>
                              </select>
                            </div>
                          </div>

                          {sessionEditMethod === 'split' && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-3xs font-mono text-sky-400 uppercase">
                                  GPay (₹)
                                </label>
                                <input
                                  type="number"
                                  step="1"
                                  min="0"
                                  value={sessionEditGpayRupees}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSessionEditGpayRupees(val);
                                    const g = parseFloat(val) || 0;
                                    const tot = parseFloat(sessionEditBillRupees) || 0;
                                    setSessionEditCashRupees(Math.max(0, tot - g).toString());
                                  }}
                                  className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs font-mono text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-3xs font-mono text-emerald-400 uppercase">
                                  Cash (₹)
                                </label>
                                <input
                                  type="number"
                                  step="1"
                                  min="0"
                                  value={sessionEditCashRupees}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setSessionEditCashRupees(val);
                                    const c = parseFloat(val) || 0;
                                    const tot = parseFloat(sessionEditBillRupees) || 0;
                                    setSessionEditGpayRupees(Math.max(0, tot - c).toString());
                                  }}
                                  className="w-full px-2 py-1 bg-zinc-950 border border-zinc-700 rounded text-xs font-mono text-white"
                                />
                              </div>
                            </div>
                          )}

                          <div>
                            <input
                              type="text"
                              value={sessionEditNotes}
                              onChange={(e) => setSessionEditNotes(e.target.value)}
                              placeholder="Reason for modifying finalized bill"
                              className="w-full px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded text-xs text-white placeholder-zinc-500"
                            />
                          </div>

                          <div className="flex justify-end gap-2 pt-1">
                            <Button
                              variant="primary"
                              size="sm"
                              type="button"
                              onClick={() => handleSaveSessionEdit(s.id)}
                              className="bg-red-600 hover:bg-red-500 text-white font-bold px-3 py-1 text-xs"
                            >
                              Update Bill & Sync
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
