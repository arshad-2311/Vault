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
} from 'lucide-react';
import { Session, PaymentMethod, GamingType } from '../types';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../../src/context/AuthContext';
import { db } from '../services/storage';
import { formatRupees, formatDateTime, formatDuration } from '../utils/formatters';

export const TransactionsPage: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);

  // Filter States
  const [search, setSearch] = useState('');
  const [gamingTypeFilter, setGamingTypeFilter] = useState<'all' | 'ps5' | 'pool'>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | 'gpay' | 'cash' | 'split'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'active' | 'cancelled'>('all');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Selected Session for Details Modal
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Void Modal
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voidError, setVoidError] = useState<string | null>(null);

  const loadData = () => {
    setSessions(db.getSessions());
  };

  useEffect(() => {
    loadData();
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

    // Date range
    const sDate = s.startTime.split('T')[0];
    const matchStart = !startDate || sDate >= startDate;
    const matchEnd = !endDate || sDate <= endDate;

    return (
      matchSearch &&
      matchGaming &&
      matchPayment &&
      matchStatus &&
      matchEmployee &&
      matchStart &&
      matchEnd
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
    const csvContent = db.exportSessionsToCSV(filtered);
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
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ReceiptText className="w-6 h-6 text-brand-400" />
            <span>All Entries & Transaction History</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Audited financial register of all sessions, collections, line items, and voids.
          </p>
        </div>

        <Button
          variant="secondary"
          size="md"
          onClick={handleExportCSV}
          leftIcon={<Download className="w-4 h-4 text-emerald-400" />}
          className="font-medium"
        >
          Export Filtered CSV ({filtered.length})
        </Button>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search customer, ID, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-600 focus:border-brand-500"
            />
          </div>

          {/* Gaming Type */}
          <select
            value={gamingTypeFilter}
            onChange={(e) => setGamingTypeFilter(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:border-brand-500"
          >
            <option value="all">All Gaming Categories</option>
            <option value="ps5">PlayStation 5</option>
            <option value="pool">8-Ball Pool</option>
          </select>

          {/* Payment Method */}
          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:border-brand-500"
          >
            <option value="all">All Payment Methods</option>
            <option value="gpay">GPay / UPI</option>
            <option value="cash">Cash Only</option>
            <option value="split">Split Payment</option>
          </select>

          {/* Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:border-brand-500"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed & Paid</option>
            <option value="active">Active Sessions</option>
            <option value="cancelled">Voided / Cancelled</option>
          </select>
        </div>

        {/* Date Range & Employee filter row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80">
          <div>
            <label className="block text-3xs font-semibold text-slate-500 uppercase mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:border-brand-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-3xs font-semibold text-slate-500 uppercase mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:border-brand-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-3xs font-semibold text-slate-500 uppercase mb-1">
              Staff Member
            </label>
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:border-brand-500"
            >
              <option value="all">All Staff Members</option>
              {employees.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
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
                      s.isVoided ? 'bg-rose-950/10 opacity-70' : ''
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-200 block text-2xs">{s.id}</span>
                      <span className="text-3xs text-slate-500">{formatDateTime(s.startTime)}</span>
                    </td>

                    <td className="px-4 py-3 font-sans">
                      <span className="font-medium text-slate-200 block">{s.customerName}</span>
                      {s.customerPhone && (
                        <span className="text-3xs text-slate-500 font-mono">{s.customerPhone}</span>
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

                    <td className="px-4 py-3 text-amber-400">
                      {s.snackSubtotalPaise > 0 ? formatRupees(s.snackSubtotalPaise) : '—'}
                    </td>

                    <td className="px-4 py-3 font-bold text-slate-100">
                      {formatRupees(s.finalBillPaise)}
                    </td>

                    <td className="px-4 py-3 font-sans">
                      {s.payment ? (
                        <div>
                          <div className="flex items-center gap-1">
                            <Badge
                              variant={
                                s.payment.method === 'gpay'
                                  ? 'info'
                                  : s.payment.method === 'cash'
                                  ? 'success'
                                  : 'purple'
                              }
                              size="sm"
                            >
                              {s.payment.method.toUpperCase()}
                            </Badge>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedSession(s)}
                        leftIcon={<Eye className="w-3.5 h-3.5" />}
                        className="text-2xs"
                      >
                        Details
                      </Button>
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
              <div className="p-3 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-300">
                <p className="font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>TRANSACTION VOIDED</span>
                </p>
                <p className="mt-1 text-2xs">
                  Reason: <strong>{selectedSession.voidReason}</strong>
                </p>
                <p className="text-3xs text-rose-400 font-mono mt-0.5">
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
                  <span className="text-slate-400 text-3xs block">{selectedSession.customerPhone}</span>
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
                <span className="text-amber-400 font-bold">
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
                <div className="flex justify-between py-1 text-emerald-400 font-mono font-semibold">
                  <span>Discount ({selectedSession.discountReason || 'Promo'}):</span>
                  <span>-{formatRupees(selectedSession.discountPaise)}</span>
                </div>
              )}

              <div className="flex justify-between pt-2 border-t border-slate-800 font-mono text-sm font-bold text-white">
                <span>Final Bill:</span>
                <span className="text-emerald-400">
                  {formatRupees(selectedSession.finalBillPaise)}
                </span>
              </div>
            </div>

            {/* Payment Record */}
            {selectedSession.payment && (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono space-y-1 text-2xs">
                <span className="text-3xs font-semibold uppercase text-slate-400 block font-sans">
                  Payment Settlement
                </span>
                <div className="flex justify-between">
                  <span className="text-slate-400">Method:</span>
                  <span className="text-slate-200 font-semibold uppercase">
                    {selectedSession.payment.method}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">GPay Received:</span>
                  <span className="text-blue-400">
                    {formatRupees(selectedSession.payment.gpayAmountPaise)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Cash Received:</span>
                  <span className="text-emerald-400">
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
                  <div className="flex justify-between text-amber-400 font-bold">
                    <span>Outstanding Due:</span>
                    <span>{formatRupees(selectedSession.payment.outstandingBalancePaise)}</span>
                  </div>
                )}
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

              <Button variant="secondary" size="sm" onClick={() => setSelectedSession(null)}>
                Close
              </Button>
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
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                {voidError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Mandatory Void Reason <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Accidental double entry / power outage mid-session"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-600 focus:border-rose-500"
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
    </div>
  );
};
