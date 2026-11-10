import React, { useState, useEffect } from 'react';
import {
  ReceiptText,
  Search,
  Filter,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Printer,
  Clock,
  Cloud,
  Edit2,
  CreditCard,
  Banknote,
  Check,
} from 'lucide-react';
import { Session, PaymentMethod, GamingType } from '../types';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { useAuth } from '../context/AuthContext';
import { db, VAULT_DATA_CHANGED_EVENT } from '../services/storage';
import { formatRupees, formatDateTime, formatDuration, maskPhoneNumber } from '../utils/formatters';
import {
  syncAllSessionsToSupabase,
  syncAllExpensesToSupabase,
  syncAllSnacksToSupabase,
  syncPricingToSupabase,
  isSupabaseConfigured,
} from '../services/supabase';

export const TransactionsPage: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);

  // Filter States
  const [search, setSearch] = useState('');
  const [gamingTypeFilter, setGamingTypeFilter] = useState<'all' | 'ps5' | 'pool'>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | 'gpay' | 'cash' | 'split'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'active' | 'cancelled'>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Selected Session for Details Modal
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [receiptSession, setReceiptSession] = useState<Session | null>(null);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(false);

  // Void Modal
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);

  // Cloud Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Edit Payment Modal State (Admin only)
  const [editingPaymentSession, setEditingPaymentSession] = useState<Session | null>(null);
  const [editPaymentMethod, setEditPaymentMethod] = useState<'cash' | 'gpay' | 'split'>('cash');
  const [editCashAmountRupees, setEditCashAmountRupees] = useState('');
  const [editGpayAmountRupees, setEditGpayAmountRupees] = useState('');
  const [editPaymentNotes, setEditPaymentNotes] = useState('');
  const [editPaymentError, setEditPaymentError] = useState<string | null>(null);

  const handleSyncToCloud = async (silent = false) => {
    if (!isSupabaseConfigured) {
      if (!silent) alert('Supabase is not configured. Please check your Supabase connection.');
      return;
    }
    const currentSessions = db.getSessions();
    if (currentSessions.length === 0) {
      if (!silent) alert('No closed transactions found on this device to sync.');
      return;
    }

    setIsSyncing(true);
    try {
      const res = await syncAllSessionsToSupabase(currentSessions);
      const currentExpenses = db.getExpenses();
      if (currentExpenses.length > 0) {
        await syncAllExpensesToSupabase(currentExpenses);
      }
      const currentSnacks = db.getSnacks();
      if (currentSnacks.length > 0) {
        await syncAllSnacksToSupabase(currentSnacks);
      }
      const currentPricing = db.getPricingConfig();
      await syncPricingToSupabase(currentPricing);
      setLastSyncTime(new Date());
      if (!silent) {
        if (res.synced > 0 && res.failed === 0) {
          alert(`Successfully synced ${res.synced} transaction(s) to Supabase Cloud!`);
        } else if (res.failed > 0) {
          const errorDetail = res.error ? `\n\nSupabase response:\n"${res.error}"` : '';
          alert(`Synced ${res.synced} transaction(s). ${res.failed} failed.${errorDetail}\n\nTo fix: Run the SQL in Supabase SQL Editor.`);
        } else {
          alert('Sync completed with 0 transactions.');
        }
      }
    } catch (err: any) {
      if (!silent) alert(`Sync error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const loadData = () => {
    setSessions(db.getSessions());
  };

  const openEditPaymentModal = (session: Session) => {
    if (!isAdmin) {
      alert('Access Restricted: Only Administrators can edit settled payments.');
      return;
    }
    if (!session.payment) {
      alert('This transaction has no payment record to edit.');
      return;
    }
    setEditingPaymentSession(session);
    setEditPaymentMethod(session.payment.method);
    setEditCashAmountRupees((session.payment.cashAmountPaise / 100).toString());
    setEditGpayAmountRupees((session.payment.gpayAmountPaise / 100).toString());
    setEditPaymentNotes(session.payment.notes || '');
    setEditPaymentError(null);
  };

  const handleMethodSelect = (method: 'cash' | 'gpay' | 'split') => {
    setEditPaymentMethod(method);
    if (!editingPaymentSession || !editingPaymentSession.payment) return;
    const finalRupees = (editingPaymentSession.payment.finalBillPaise / 100).toString();

    if (method === 'cash') {
      setEditCashAmountRupees(finalRupees);
      setEditGpayAmountRupees('0');
    } else if (method === 'gpay') {
      setEditGpayAmountRupees(finalRupees);
      setEditCashAmountRupees('0');
    } else {
      // Default to 50/50 split if previously pure cash/gpay
      const total = editingPaymentSession.payment.finalBillPaise / 100;
      const half = (total / 2).toFixed(2);
      const otherHalf = (total - parseFloat(half)).toFixed(2);
      setEditGpayAmountRupees(half);
      setEditCashAmountRupees(otherHalf);
    }
  };

  const handleSavePaymentEdit = () => {
    if (!editingPaymentSession || !editingPaymentSession.payment) return;
    try {
      const finalBillPaise = editingPaymentSession.payment.finalBillPaise;
      let cashPaise = 0;
      let gpayPaise = 0;

      if (editPaymentMethod === 'cash') {
        cashPaise = finalBillPaise;
        gpayPaise = 0;
      } else if (editPaymentMethod === 'gpay') {
        gpayPaise = finalBillPaise;
        cashPaise = 0;
      } else {
        cashPaise = Math.round((parseFloat(editCashAmountRupees) || 0) * 100);
        gpayPaise = Math.round((parseFloat(editGpayAmountRupees) || 0) * 100);
        if (cashPaise + gpayPaise < finalBillPaise) {
          setEditPaymentError(
            `Total split (₹${((cashPaise + gpayPaise) / 100).toFixed(2)}) must equal or exceed bill total (₹${(finalBillPaise / 100).toFixed(2)}).`
          );
          return;
        }
      }

      const updated = db.updatePaymentDetails({
        sessionId: editingPaymentSession.id,
        method: editPaymentMethod,
        cashAmountPaise: cashPaise,
        gpayAmountPaise: gpayPaise,
        notes: editPaymentNotes.trim() || undefined,
        actor: currentUser,
      });

      loadData();
      if (selectedSession && selectedSession.id === editingPaymentSession.id) {
        setSelectedSession(updated);
      }
      setEditingPaymentSession(null);
      alert('Payment breakdown updated and synced successfully!');
    } catch (err: any) {
      setEditPaymentError(err.message || 'Failed to update payment.');
    }
  };

  const handleSwitchPaymentMethod = (sessionId: string, targetMethod: 'gpay' | 'cash') => {
    const s = sessions.find((item) => item.id === sessionId);
    const targetLabel = targetMethod === 'cash' ? 'Cash' : 'GPay';
    if (!window.confirm(`Switch payment method for ${s ? s.customerName : 'this transaction'} to ${targetLabel}?`)) {
      return;
    }
    try {
      const updated = db.switchPaymentMethod({
        sessionId,
        targetMethod,
        actor: currentUser,
      });
      loadData();
      if (selectedSession && selectedSession.id === sessionId) {
        setSelectedSession(updated);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to switch payment method.');
    }
  };

  useEffect(() => {
    loadData();
    const handleDataChanged = () => {
      loadData();
    };
    window.addEventListener(VAULT_DATA_CHANGED_EVENT, handleDataChanged);

    // Auto-sync every 60 seconds (1 minute)
    const syncTimer = setInterval(() => {
      handleSyncToCloud(true);
    }, 60000);

    // Auto-sync before exit (tab close, reload, or navigating away)
    const handleBeforeUnload = () => {
      handleSyncToCloud(true);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Auto-sync when tab visibility becomes hidden (mobile app switch or screen lock)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleSyncToCloud(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener(VAULT_DATA_CHANGED_EVENT, handleDataChanged);
      clearInterval(syncTimer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Filter Logic
  const filtered = sessions.filter((s) => {
    // Search
    const q = search.toLowerCase();
    const matchSearch =
      s.customerName.toLowerCase().includes(q) ||
      s.stationName.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q) ||
      (s.customerPhone && s.customerPhone.includes(q));

    // Gaming type
    const matchGaming = gamingTypeFilter === 'all' || s.gamingType === gamingTypeFilter;

    // Payment method
    const matchPayment =
      paymentMethodFilter === 'all' || (s.payment && s.payment.method === paymentMethodFilter);

    // Status
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;

    // Employee
    const matchEmployee =
      employeeFilter === 'all' ||
      s.createdBy === employeeFilter ||
      s.completedBy === employeeFilter;

    return (
      matchSearch &&
      matchGaming &&
      matchPayment &&
      matchStatus &&
      matchEmployee
    );
  });

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedSessions = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const employees = db.getUsers();

  const handleExportCSV = () => {
    const csvContent = db.exportSessionsToCSV(filtered, currentUser);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `vault_pos_transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleVoidTransaction = () => {
    if (!selectedSession) return;
    setVoidError(null);

    try {
      db.voidSession(selectedSession.id, voidReason, currentUser);
      loadData();
      setVoidModalOpen(false);
      setSelectedSession(null);
    } catch (err: any) {
      setVoidError(err.message || 'Failed to void transaction.');
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-zinc-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ReceiptText className="w-6 h-6 text-red-500" />
            <span>All Entries & Transaction History</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Audited financial register of all sessions, collections, line items, and voids.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => handleSyncToCloud(false)}
              disabled={isSyncing}
              leftIcon={<Cloud className={`w-4 h-4 text-sky-400 ${isSyncing ? 'animate-spin' : ''}`} />}
              className="font-medium"
              title="Continuous cloud backup: Automatically syncs every 1 min and before tab exits"
            >
              {isSyncing ? 'Syncing...' : 'Sync to Cloud'}
            </Button>
            <span
              className="text-3xs text-emerald-400 font-mono hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-950/40 border border-emerald-900/50"
              title="Continuous background cloud backup: syncs every 1 min and automatically before page exit"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Auto-sync: 1m & on exit
            </span>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={handleExportCSV}
            leftIcon={<Download className="w-4 h-4 text-zinc-300" />}
            className="font-medium"
          >
            Export Filtered CSV ({filtered.length})
          </Button>
        </div>
      </div>

      {/* Filter Toolbar with generous touch targets and spacing */}
      <div className="p-4 sm:p-5 rounded-xl bg-zinc-900/90 border border-zinc-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-3.5">
          {/* Search */}
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search customer, ID, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 sm:py-2.5 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-red-500 outline-none"
            />
          </div>

          {/* Gaming Type */}
          <select
            value={gamingTypeFilter}
            onChange={(e) => setGamingTypeFilter(e.target.value as any)}
            className="px-3 py-2 sm:py-2.5 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-zinc-200 focus:border-red-500 outline-none"
          >
            <option value="all">All Gaming Categories</option>
            <option value="ps5">PlayStation 5</option>
            <option value="pool">8-Ball Pool</option>
          </select>

          {/* Payment Method */}
          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value as any)}
            className="px-3 py-2 sm:py-2.5 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-zinc-200 focus:border-red-500 outline-none"
          >
            <option value="all">All Payment Methods</option>
            <option value="gpay">GPay</option>
            <option value="cash">Cash Only</option>
            <option value="split">Split Payment</option>
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 sm:py-2.5 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-zinc-200 focus:border-red-500 outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed & Paid</option>
            <option value="active">Active Sessions</option>
            <option value="cancelled">Voided / Cancelled</option>
          </select>

          {/* Staff Member (Only show if multiple staff exist) */}
          {employees.length > 1 && (
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="px-3 py-2 sm:py-2.5 rounded-lg bg-zinc-950 border border-zinc-700 text-xs text-zinc-200 focus:border-red-500 outline-none"
            >
              <option value="all">All Staff Members</option>
              {employees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Transaction Table / Mobile Cards */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-sm">
        {/* Mobile Cards (md:hidden) */}
        <div className="md:hidden divide-y divide-zinc-800/80 font-sans">
          {paginatedSessions.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs font-mono">
              No transactions match the selected filters.
            </div>
          ) : (
            paginatedSessions.map((s) => (
              <div
                key={s.id}
                className={`p-4 space-y-3 transition-colors ${
                  s.isVoided ? 'bg-red-950/20 opacity-75' : 'hover:bg-zinc-850/30'
                }`}
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{s.customerName}</span>
                      {s.isVoided ? (
                        <Badge variant="danger" size="sm">VOIDED</Badge>
                      ) : s.status === 'completed' ? (
                        <Badge variant="success" size="sm">PAID</Badge>
                      ) : (
                        <Badge variant="warning" size="sm">ACTIVE</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-2xs text-zinc-400 font-mono mt-1">
                      <span className="font-semibold text-zinc-300">{s.stationName}</span>
                      <span>•</span>
                      <span className="uppercase">{s.gamingType}</span>
                      <span>•</span>
                      <span>{s.durationMinutes ? `${s.durationMinutes}m` : 'In Progress'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-bold font-mono text-white block tabular-nums">
                      {formatRupees(s.finalBillPaise)}
                    </span>
                    {s.payment && (
                      <span className="text-3xs font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 inline-block mt-0.5 font-semibold">
                        {s.payment.method}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-2xs font-mono text-zinc-400">
                  <span className="text-3xs text-zinc-500">{s.id} • {formatDateTime(s.startTime)}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => {
                        setReceiptSession(s);
                        setAutoPrintReceipt(false);
                      }}
                      leftIcon={<Printer className="w-3.5 h-3.5 text-red-400" />}
                      className="text-xs text-red-400 hover:text-red-300 px-2.5 py-1.5 h-8"
                    >
                      Receipt
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => setSelectedSession(s)}
                      leftIcon={<Eye className="w-3.5 h-3.5" />}
                      className="text-xs px-3 py-1.5 h-8"
                    >
                      Details
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table (hidden md:block) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-mono text-3xs">
              <tr>
                <th className="px-4 py-3">ID / Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Station & Type</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Gaming Fee</th>
                <th className="px-4 py-3">Snacks</th>
                <th className="px-4 py-3">Final Bill</th>
                <th className="px-4 py-3">Collections</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {paginatedSessions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500 font-sans">
                    No transactions match the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedSessions.map((s) => (
                  <tr
                    key={s.id}
                    className={`hover:bg-slate-850/50 transition-colors ${
                      s.isVoided ? 'bg-red-950/15 opacity-70' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-200 block text-2xs">{s.id}</span>
                      <span className="text-3xs text-slate-500">{formatDateTime(s.startTime)}</span>
                    </td>

                    <td className="px-4 py-3 font-sans">
                      <span className="font-medium text-slate-200 block">{s.customerName}</span>
                      {s.customerPhone && (
                        <span className="text-3xs text-slate-500 font-mono">
                          {isAdmin ? s.customerPhone : maskPhoneNumber(s.customerPhone)}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-sans">
                      <span className="text-slate-300 block">{s.stationName}</span>
                      <span className="text-3xs text-slate-500 uppercase font-mono">
                        {s.gamingType} • {s.billingType}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-300">
                      {s.durationMinutes ? `${s.durationMinutes}m` : 'In Progress'}
                    </td>

                    <td className="px-4 py-3 text-slate-300">
                      {formatRupees(s.gamingChargePaise)}
                    </td>

                    <td className="px-4 py-3 text-red-400">
                      {s.snackSubtotalPaise > 0 ? formatRupees(s.snackSubtotalPaise) : '—'}
                    </td>

                    <td className="px-4 py-3 font-bold text-slate-100">
                      {formatRupees(s.finalBillPaise)}
                    </td>

                    <td className="px-4 py-3 font-sans">
                      {s.payment ? (
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant={
                                s.payment.method === 'gpay'
                                  ? 'info'
                                  : s.payment.method === 'cash'
                                  ? 'success'
                                  : 'neutral'
                              }
                              size="sm"
                            >
                              {s.payment.method.toUpperCase()}
                            </Badge>
                            {isAdmin && !s.isVoided && s.status === 'completed' && (
                              <button
                                type="button"
                                title="Edit payment method, GPay/Cash split breakdown (Admin)"
                                onClick={() => openEditPaymentModal(s)}
                                className="px-1.5 py-0.5 rounded text-3xs font-mono font-bold border border-red-900/60 bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-white transition-colors flex items-center gap-1"
                              >
                                <Edit2 className="w-2.5 h-2.5" />
                                Edit
                              </button>
                            )}
                            {!s.isVoided && s.status === 'completed' && s.payment && s.payment.method !== 'split' && (
                              <button
                                type="button"
                                title={`Accidentally selected wrong method? Click to switch to ${
                                  s.payment.method === 'gpay' ? 'Cash' : 'GPay'
                                }`}
                                onClick={() => {
                                  if (s.payment) {
                                    handleSwitchPaymentMethod(
                                      s.id,
                                      s.payment.method === 'gpay' ? 'cash' : 'gpay'
                                    );
                                  }
                                }}
                                className="px-1.5 py-0.5 rounded text-3xs font-mono font-bold border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                              >
                                ⇄ {s.payment.method === 'gpay' ? 'Cash' : 'GPay'}
                              </button>
                            )}
                          </div>
                          {s.payment.method === 'split' && (
                            <span className="text-3xs text-slate-400 font-mono block mt-0.5">
                              {formatRupees(s.payment.gpayAmountPaise)} GPay + {formatRupees(s.payment.cashAmountPaise)} Cash
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-2xs italic">Unsettled</span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-sans">
                      {s.isVoided ? (
                        <Badge variant="danger" size="sm">
                          VOIDED
                        </Badge>
                      ) : s.status === 'completed' ? (
                        <Badge variant="success" size="sm">
                          PAID
                        </Badge>
                      ) : (
                        <Badge variant="warning" size="sm">
                          ACTIVE
                        </Badge>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => {
                            setReceiptSession(s);
                            setAutoPrintReceipt(false);
                          }}
                          leftIcon={<Printer className="w-3.5 h-3.5 text-red-400" />}
                          className="text-2xs"
                        >
                          Receipt
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => setSelectedSession(s)}
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                          className="text-2xs"
                        >
                          Details
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/40 text-xs">
          <span className="text-slate-400 font-mono">
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} entries
          </span>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
            >
              Prev
            </Button>
            <span className="text-slate-300 font-mono px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Transaction Details & Audit Modal */}
      {selectedSession && (
        <Modal
          isOpen={Boolean(selectedSession)}
          onClose={() => setSelectedSession(null)}
          title={`Transaction Audit: ${selectedSession.id}`}
          description="Detailed breakdown of session charges, snack line items, payments, and personnel."
          maxWidth="xl"
        >
          <div className="space-y-4 text-xs">
            {selectedSession.isVoided && (
              <div className="p-3 rounded-lg bg-red-950/70 border border-red-800 text-red-300">
                <p className="font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <span>TRANSACTION VOIDED</span>
                </p>
                <p className="mt-1 text-2xs">
                  Reason: <strong>{selectedSession.voidReason}</strong>
                </p>
                <p className="text-3xs text-red-400 font-mono mt-0.5">
                  Voided at {formatDateTime(selectedSession.voidedAt)}
                </p>
              </div>
            )}

            {/* Core Info */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono">
              <div>
                <span className="text-slate-500 text-3xs uppercase block">Customer</span>
                <span className="text-slate-200 font-semibold">{selectedSession.customerName}</span>
                {selectedSession.customerPhone && (
                  <span className="text-slate-400 text-3xs block">
                    {isAdmin ? selectedSession.customerPhone : maskPhoneNumber(selectedSession.customerPhone)}
                  </span>
                )}
              </div>
              <div>
                <span className="text-slate-500 text-3xs uppercase block">Station</span>
                <span className="text-slate-200">{selectedSession.stationName}</span>
              </div>
              <div>
                <span className="text-slate-500 text-3xs uppercase block">Timing</span>
                <span className="text-slate-300">
                  {formatDateTime(selectedSession.startTime)} -{' '}
                  {selectedSession.endTime ? formatDateTime(selectedSession.endTime) : 'Active'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-3xs uppercase block">Duration Billed</span>
                <span className="text-red-400 font-bold">
                  {formatDuration(selectedSession.durationMinutes)}
                </span>
              </div>
            </div>

            {/* Itemized Snacks */}
            <div className="space-y-1.5 p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-3xs font-semibold uppercase text-slate-400">
                Itemized Bill ({selectedSession.items.length + 1} Lines)
              </span>

              <div className="flex justify-between py-1 border-b border-slate-850 font-mono">
                <span className="text-slate-300">
                  Gaming Charge ({selectedSession.rateSnapshot.description})
                </span>
                <span className="text-slate-100 font-semibold">
                  {formatRupees(selectedSession.gamingChargePaise)}
                </span>
              </div>

              {selectedSession.items.map((it) => (
                <div key={it.id} className="flex justify-between py-1 text-slate-400 font-mono">
                  <span>
                    {it.quantity}x {it.name} (@ {formatRupees(it.unitPricePaise)})
                  </span>
                  <span className="text-slate-200">{formatRupees(it.lineTotalPaise)}</span>
                </div>
              ))}

              {selectedSession.discountPaise > 0 && (
                <div className="flex justify-between py-1 text-red-400 font-mono font-semibold">
                  <span>Discount ({selectedSession.discountReason || 'Promo'}):</span>
                  <span>-{formatRupees(selectedSession.discountPaise)}</span>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t border-slate-800 font-mono text-sm font-bold text-white">
                <span>Final Bill:</span>
                <span className="text-white font-black">
                  {formatRupees(selectedSession.finalBillPaise)}
                </span>
              </div>
            </div>

            {/* Payment Record */}
            {selectedSession.payment && (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono space-y-2 text-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-3xs font-semibold uppercase text-slate-400 block font-sans">
                    Payment Settlement
                  </span>
                  {!selectedSession.isVoided && selectedSession.status === 'completed' && (
                    <div className="flex items-center gap-1.5 font-sans">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => openEditPaymentModal(selectedSession)}
                          className="px-2 py-0.5 rounded bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800 text-3xs font-semibold transition-colors flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit Payment
                        </button>
                      )}
                      {selectedSession.payment.method !== 'cash' && (
                        <button
                          type="button"
                          onClick={() => handleSwitchPaymentMethod(selectedSession.id, 'cash')}
                          className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-zinc-700 text-3xs font-semibold transition-colors"
                        >
                          ⇄ Switch to Cash
                        </button>
                      )}
                      {selectedSession.payment.method !== 'gpay' && (
                        <button
                          type="button"
                          onClick={() => handleSwitchPaymentMethod(selectedSession.id, 'gpay')}
                          className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-sky-400 border border-zinc-700 text-3xs font-semibold transition-colors"
                        >
                          ⇄ Switch to GPay
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Method:</span>
                    <span className="text-slate-200 font-semibold uppercase">
                      {selectedSession.payment.method}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">GPay Received:</span>
                    <span className="text-zinc-200 font-semibold">
                      {formatRupees(selectedSession.payment.gpayAmountPaise)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cash Received:</span>
                    <span className="text-zinc-200 font-semibold">
                      {formatRupees(selectedSession.payment.cashAmountPaise)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span className="text-slate-300">Total Received:</span>
                    <span className="text-white">
                      {formatRupees(selectedSession.payment.totalReceivedPaise)}
                    </span>
                  </div>
                  {selectedSession.payment.outstandingBalancePaise > 0 && (
                    <div className="flex justify-between text-red-400 font-bold">
                      <span>Outstanding Due:</span>
                      <span>{formatRupees(selectedSession.payment.outstandingBalancePaise)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Staff Attributions */}
            <div className="flex justify-between text-3xs text-slate-500 font-mono pt-1">
              <span>Opened by: {selectedSession.createdByName}</span>
              {selectedSession.completedByName && (
                <span>Closed by: {selectedSession.completedByName}</span>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              {isAdmin && !selectedSession.isVoided ? (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setVoidReason('');
                    setVoidError(null);
                    setVoidModalOpen(true);
                  }}
                  leftIcon={<AlertTriangle className="w-3.5 h-3.5" />}
                >
                  Void Transaction
                </Button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={() => {
                    setReceiptSession(selectedSession);
                    setAutoPrintReceipt(false);
                  }}
                  leftIcon={<Printer className="w-3.5 h-3.5 text-red-400" />}
                >
                  Print Receipt
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setSelectedSession(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Admin Void Confirmation Modal */}
      {voidModalOpen && selectedSession && (
        <Modal
          isOpen={voidModalOpen}
          onClose={() => setVoidModalOpen(false)}
          title="Void Financial Transaction"
          description={`Permanently void transaction for ${selectedSession.customerName} (${formatRupees(
            selectedSession.finalBillPaise
          )}). This action is audited.`}
          maxWidth="md"
        >
          <div className="space-y-4">
            {voidError && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs">
                {voidError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mandatory Void Reason <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Accidental double entry / power outage mid-session"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-600 focus:border-red-500"
              />
              <p className="text-3xs text-slate-500 mt-1">
                A valid reason of at least 5 characters is required for auditor verification.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setVoidModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleVoidTransaction}
                leftIcon={<AlertTriangle className="w-3.5 h-3.5" />}
              >
                Confirm Void & Audit
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Admin Edit Payment Modal */}
      {editingPaymentSession && editingPaymentSession.payment && (
        <Modal
          isOpen={Boolean(editingPaymentSession)}
          onClose={() => setEditingPaymentSession(null)}
          title="Edit Payment Breakdown"
          description={`Update payment method and cash/GPay split for ${editingPaymentSession.customerName} • Bill Total: ${formatRupees(
            editingPaymentSession.payment.finalBillPaise
          )}`}
          maxWidth="md"
        >
          <div className="space-y-4">
            {editPaymentError && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs">
                {editPaymentError}
              </div>
            )}

            {/* Bill Info Banner */}
            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-3xs font-mono uppercase text-zinc-400 block">Total Final Bill</span>
                <span className="text-lg font-black font-mono text-white">
                  {formatRupees(editingPaymentSession.payment.finalBillPaise)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-3xs font-mono uppercase text-zinc-400 block">Current Method</span>
                <Badge
                  variant={
                    editingPaymentSession.payment.method === 'gpay'
                      ? 'info'
                      : editingPaymentSession.payment.method === 'cash'
                      ? 'success'
                      : 'neutral'
                  }
                  size="sm"
                >
                  {editingPaymentSession.payment.method.toUpperCase()}
                </Badge>
              </div>
            </div>

            {/* Method Selector Tabs */}
            <div>
              <label className="block text-2xs font-semibold text-zinc-300 uppercase tracking-wider font-mono mb-1.5">
                Select New Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleMethodSelect('cash')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    editPaymentMethod === 'cash'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-950/60'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                  }`}
                >
                  <Banknote className="w-3.5 h-3.5" />
                  Full Cash
                </button>
                <button
                  type="button"
                  onClick={() => handleMethodSelect('gpay')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    editPaymentMethod === 'gpay'
                      ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-950/60'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  Full GPay
                </button>
                <button
                  type="button"
                  onClick={() => handleMethodSelect('split')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    editPaymentMethod === 'split'
                      ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-950/60'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                  }`}
                >
                  Split / Custom
                </button>
              </div>
            </div>

            {/* Split Amounts Inputs */}
            {editPaymentMethod === 'split' && (
              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-3xs font-mono font-bold text-sky-400 uppercase">
                      GPay Amount (₹)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={editGpayAmountRupees}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditGpayAmountRupees(val);
                        const gpayNum = parseFloat(val) || 0;
                        const totalRupees = editingPaymentSession.payment!.finalBillPaise / 100;
                        const remainder = Math.max(0, totalRupees - gpayNum);
                        setEditCashAmountRupees(remainder.toString());
                      }}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm text-white font-mono font-bold outline-none focus:border-sky-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-3xs font-mono font-bold text-emerald-400 uppercase">
                      Cash Amount (₹)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={editCashAmountRupees}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditCashAmountRupees(val);
                        const cashNum = parseFloat(val) || 0;
                        const totalRupees = editingPaymentSession.payment!.finalBillPaise / 100;
                        const remainder = Math.max(0, totalRupees - cashNum);
                        setEditGpayAmountRupees(remainder.toString());
                      }}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm text-white font-mono font-bold outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-3xs font-mono text-zinc-400 pt-1 border-t border-zinc-800">
                  <span>
                    Total Entered: ₹
                    {(
                      (parseFloat(editGpayAmountRupees) || 0) +
                      (parseFloat(editCashAmountRupees) || 0)
                    ).toFixed(2)}
                  </span>
                  <span>Required: {formatRupees(editingPaymentSession.payment.finalBillPaise)}</span>
                </div>
              </div>
            )}

            {/* Admin Notes */}
            <div className="space-y-1">
              <label className="block text-2xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
                Admin Reason / Notes (Audited)
              </label>
              <input
                type="text"
                value={editPaymentNotes}
                onChange={(e) => setEditPaymentNotes(e.target.value)}
                placeholder="e.g. Customer paid via GPay, staff mistakenly clicked Cash"
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 outline-none focus:border-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setEditingPaymentSession(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSavePaymentEdit}
                className="bg-red-600 hover:bg-red-500 text-white font-bold border-red-500 px-4"
              >
                Save Payment & Sync
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Dedicated Thermal Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(receiptSession)}
        onClose={() => setReceiptSession(null)}
        session={receiptSession}
        autoPrint={autoPrintReceipt}
      />
    </div>
  );
};
