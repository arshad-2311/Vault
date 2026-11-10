import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Plus,
  Search,
  Filter,
  Download,
  Trash2,
  Edit2,
  Calendar,
  CreditCard,
  Banknote,
  Building,
  Tag,
  FileText,
  AlertCircle,
  Receipt,
  TrendingDown,
} from 'lucide-react';
import { DailyExpense, ExpenseCategory, ExpensePaymentMethod } from '../types';
import { useAuth } from '../context/AuthContext';
import { db, VAULT_DATA_CHANGED_EVENT } from '../services/storage';
import { formatRupees, getTodayDateString, formatDateTime } from '../utils/formatters';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Badge } from '../components/common/Badge';
import { syncExpenseToSupabase, fetchExpensesFromSupabase, isSupabaseConfigured } from '../services/supabase';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Beverages & Snacks Restock',
  'Supplies & Groceries',
  'Equipment & Maintenance',
  'Electricity & Utilities',
  'Staff & Salaries',
  'Rent & Premises',
  'Marketing & Ads',
  'Miscellaneous',
];

export const DailyExpensesPage: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const [expenses, setExpenses] = useState<DailyExpense[]>(() => db.getExpenses());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('today');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<DailyExpense | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [date, setDate] = useState(getTodayDateString());
  const [category, setCategory] = useState<ExpenseCategory>('Beverages & Snacks Restock');
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>('cash');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setExpenses(db.getExpenses());
    if (isSupabaseConfigured) {
      try {
        const res = await fetchExpensesFromSupabase();
        if (res.success && res.expenses && res.expenses.length > 0) {
          // Merge remote expenses with local expenses
          const local = db.getExpenses();
          const localMap = new Map(local.map((e) => [e.id, e]));
          let modified = false;
          res.expenses.forEach((remote) => {
            if (!localMap.has(remote.id)) {
              localMap.set(remote.id, remote);
              modified = true;
            }
          });
          if (modified) {
            const merged = Array.from(localMap.values()).sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            db.setExpenses(merged);
            setExpenses(merged);
          }
        }
      } catch {}
    }
  };

  useEffect(() => {
    loadData();
    const handleDataChanged = () => {
      setExpenses(db.getExpenses());
    };
    window.addEventListener(VAULT_DATA_CHANGED_EVENT, handleDataChanged);
    return () => window.removeEventListener(VAULT_DATA_CHANGED_EVENT, handleDataChanged);
  }, []);

  // Compute Date Boundaries based on preset
  const getDateRange = () => {
    const today = getTodayDateString();
    if (datePreset === 'today') {
      return { start: today, end: today };
    }
    if (datePreset === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const y = d.toISOString().split('T')[0];
      return { start: y, end: y };
    }
    if (datePreset === 'week') {
      const d = new Date();
      const firstDay = new Date(d.setDate(d.getDate() - d.getDay() + 1));
      return { start: firstDay.toISOString().split('T')[0], end: today };
    }
    if (datePreset === 'month') {
      const d = new Date();
      const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
      return { start: firstDay.toISOString().split('T')[0], end: today };
    }
    return { start: undefined, end: undefined };
  };

  const { start, end } = getDateRange();

  // Filtered List
  const filtered = expenses.filter((e) => {
    // Search
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      e.title.toLowerCase().includes(q) ||
      (e.receiptNumber && e.receiptNumber.toLowerCase().includes(q)) ||
      (e.notes && e.notes.toLowerCase().includes(q)) ||
      e.category.toLowerCase().includes(q);

    // Category
    const matchCat = categoryFilter === 'all' || e.category === categoryFilter;

    // Date
    let matchDate = true;
    if (start && e.date < start) matchDate = false;
    if (end && e.date > end) matchDate = false;

    return matchSearch && matchCat && matchDate;
  });

  // Financial Metrics
  const metrics = filtered.reduce(
    (acc, e) => {
      acc.total += e.amountPaise;
      if (e.paymentMethod === 'cash') {
        acc.cash += e.amountPaise;
      } else {
        acc.digital += e.amountPaise;
      }
      return acc;
    },
    { total: 0, cash: 0, digital: 0 }
  );

  const openAddModal = () => {
    setEditingExpense(null);
    setTitle('');
    setAmountRupees('');
    setDate(getTodayDateString());
    setCategory('Beverages & Snacks Restock');
    setPaymentMethod('cash');
    setReceiptNumber('');
    setNotes('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (exp: DailyExpense) => {
    setEditingExpense(exp);
    setTitle(exp.title);
    setAmountRupees((exp.amountPaise / 100).toString());
    setDate(exp.date);
    setCategory(exp.category);
    setPaymentMethod(exp.paymentMethod);
    setReceiptNumber(exp.receiptNumber || '');
    setNotes(exp.notes || '');
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Please enter an expense title / description.');
      return;
    }
    const parsedAmount = parseFloat(amountRupees);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Please enter a valid amount greater than ₹0.');
      return;
    }

    const amountPaise = Math.round(parsedAmount * 100);

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingExpense) {
        const updated = db.updateExpense(
          editingExpense.id,
          {
            title: title.trim(),
            amountPaise,
            date,
            category,
            paymentMethod,
            receiptNumber: receiptNumber.trim() || undefined,
            notes: notes.trim() || undefined,
          },
          currentUser
        );
        try {
          syncExpenseToSupabase(updated).catch(() => {});
        } catch {}
      } else {
        const created = db.addExpense(
          {
            title: title.trim(),
            amountPaise,
            date,
            category,
            paymentMethod,
            receiptNumber: receiptNumber.trim() || undefined,
            notes: notes.trim() || undefined,
          },
          currentUser
        );
        try {
          syncExpenseToSupabase(created).catch(() => {});
        } catch {}
      }

      setModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save expense.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string, expTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete the expense "${expTitle}"? This action is audited.`)) {
      return;
    }
    try {
      db.deleteExpense(id, currentUser);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete expense.');
    }
  };

  const handleExportCSV = () => {
    if (filtered.length === 0) {
      alert('No expense entries to export for the selected filter.');
      return;
    }

    const headers = ['ID', 'Date', 'Title', 'Category', 'Amount (INR)', 'Payment Method', 'Receipt No', 'Notes', 'Recorded By'];
    const rows = filtered.map((e) => [
      e.id,
      e.date,
      `"${e.title.replace(/"/g, '""')}"`,
      e.category,
      (e.amountPaise / 100).toFixed(2),
      e.paymentMethod.toUpperCase(),
      e.receiptNumber || '',
      `"${(e.notes || '').replace(/"/g, '""')}"`,
      `"${e.recordedByName}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `vault_expenses_${getTodayDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide font-display uppercase">
              Daily Expenses
            </h1>
            <span className="text-3xs text-red-500 font-mono font-bold tracking-widest px-2 py-0.5 rounded bg-red-950/60 border border-red-900/60">
              ADMIN ONLY
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Track business operating costs, restock invoices, utility bills & staff payouts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 font-mono text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={openAddModal}
            className="bg-red-600 hover:bg-red-500 text-white font-bold border-red-500 shadow-md shadow-red-950/60 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4.5">
        <div className="p-4 sm:p-5 rounded-xl bg-[#0c0c12] border border-red-950/60 shadow-lg shadow-black/40 space-y-1.5">
          <div className="flex items-center justify-between text-red-400">
            <span className="text-3xs sm:text-2xs font-mono uppercase tracking-wider text-red-400 font-bold">
              Total Expenses
            </span>
            <TrendingDown className="w-4 h-4 text-red-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white tabular-nums">
            {formatRupees(metrics.total)}
          </div>
          <p className="text-3xs text-zinc-500 font-mono">{filtered.length} entry/entries</p>
        </div>

        <div className="p-4 sm:p-5 rounded-xl bg-[#0c0c12] border border-zinc-800/80 shadow-lg shadow-black/40 space-y-1.5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-3xs sm:text-2xs font-mono uppercase tracking-wider text-zinc-400 font-bold">
              Cash Outflow
            </span>
            <Banknote className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white tabular-nums">
            {formatRupees(metrics.cash)}
          </div>
          <p className="text-3xs text-zinc-500 font-mono">Paid from physical register</p>
        </div>

        <div className="p-4 sm:p-5 rounded-xl bg-[#0c0c12] border border-zinc-800/80 shadow-lg shadow-black/40 space-y-1.5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-3xs sm:text-2xs font-mono uppercase tracking-wider text-zinc-400 font-bold">
              GPay / Digital
            </span>
            <CreditCard className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white tabular-nums">
            {formatRupees(metrics.digital)}
          </div>
          <p className="text-3xs text-zinc-500 font-mono">Paid via online accounts</p>
        </div>

        <div className="p-4 sm:p-5 rounded-xl bg-[#0c0c12] border border-zinc-800/80 shadow-lg shadow-black/40 space-y-1.5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-3xs sm:text-2xs font-mono uppercase tracking-wider text-zinc-400 font-bold">
              Active Category
            </span>
            <Tag className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="text-sm font-bold text-zinc-200 truncate font-mono">
            {categoryFilter === 'all' ? 'All Categories' : categoryFilter}
          </div>
          <p className="text-3xs text-zinc-500 font-mono">Showing filtered costs</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-[#0c0c12] border border-zinc-800/80 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search expenses by title, notes, receipt no..."
              className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 outline-none focus:border-red-500 transition-colors"
            />
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-400 shrink-0" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300 py-2 px-3 outline-none focus:border-red-500"
            >
              <option value="all">All Categories</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Presets */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 border-t border-zinc-800/60 font-mono text-xs">
          <span className="text-3xs text-zinc-500 uppercase tracking-wider mr-1">Period:</span>
          {(['today', 'yesterday', 'week', 'month', 'all'] as const).map((preset) => (
            <button
              key={preset}
              onClick={() => setDatePreset(preset)}
              className={`px-3 py-1 rounded-lg text-2xs transition-colors shrink-0 ${
                datePreset === preset
                  ? 'bg-red-600 text-white font-bold shadow-sm shadow-red-950/60'
                  : 'text-zinc-400 hover:text-white bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/60'
              }`}
            >
              {preset === 'today'
                ? 'Today'
                : preset === 'yesterday'
                ? 'Yesterday'
                : preset === 'week'
                ? 'This Week'
                : preset === 'month'
                ? 'This Month'
                : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-[#0c0c12] border border-zinc-800/80 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#12121a] text-zinc-400 font-mono uppercase text-3xs tracking-wider border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Title / Details</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Recorded By</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500 font-sans">
                    <Receipt className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-50" />
                    <p className="font-medium text-sm text-zinc-400">No expenses recorded</p>
                    <p className="text-2xs text-zinc-500 mt-0.5">
                      Click "+ Add Expense" to log operating costs or purchase receipts.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((exp) => (
                  <tr key={exp.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="px-4 py-3.5 whitespace-nowrap text-zinc-300 font-bold">{exp.date}</td>
                    <td className="px-4 py-3.5 font-sans">
                      <div className="font-bold text-white text-xs">{exp.title}</div>
                      {exp.notes && <div className="text-3xs text-zinc-400 mt-0.5">{exp.notes}</div>}
                      {exp.receiptNumber && (
                        <div className="text-3xs text-zinc-500 font-mono mt-0.5">
                          Ref: <span className="text-zinc-300">{exp.receiptNumber}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-sans">
                      <span className="px-2 py-0.5 rounded-full text-3xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge
                        variant={
                          exp.paymentMethod === 'cash'
                            ? 'success'
                            : exp.paymentMethod === 'gpay'
                            ? 'info'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {exp.paymentMethod.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right font-black text-white text-sm tabular-nums">
                      {formatRupees(exp.amountPaise)}
                    </td>
                    <td className="px-4 py-3.5 font-sans text-2xs text-zinc-400">{exp.recordedByName}</td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(exp)}
                          title="Edit Expense"
                          className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(exp.id, exp.title)}
                          title="Delete Expense"
                          className="p-1 rounded hover:bg-red-950/60 text-zinc-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Expense Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingExpense ? 'Edit Expense Record' : 'Record New Expense'}
        description="Expenses are audited and tracked for daily register balancing"
        maxWidth="md"
        onSubmit={handleSubmit}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" size="md" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              isLoading={isSubmitting}
              className="bg-red-600 hover:bg-red-500 text-white font-bold border-red-500 px-5"
            >
              {editingExpense ? 'Update Expense' : 'Save Expense'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-950/70 border border-red-800 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label className="block text-2xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
              Expense Description *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Red Bull 2 cases restock, Cue tips repair, Internet bill"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 outline-none focus:border-red-500 transition-colors"
            />
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-2xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
                Amount (₹) *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-zinc-400 font-mono font-bold">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white font-mono font-bold outline-none focus:border-red-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-2xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
                Expense Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white font-mono outline-none focus:border-red-500 transition-colors"
              />
            </div>
          </div>

          {/* Category & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-2xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white outline-none focus:border-red-500"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-2xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
                Payment Outflow Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as ExpensePaymentMethod)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white outline-none focus:border-red-500 font-mono"
              >
                <option value="cash">CASH (from Drawer)</option>
                <option value="gpay">GPAY / UPI</option>
                <option value="bank_transfer">BANK TRANSFER</option>
              </select>
            </div>
          </div>

          {/* Receipt Number */}
          <div className="space-y-1.5">
            <label className="block text-2xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
              Receipt / Bill Reference No. (Optional)
            </label>
            <input
              type="text"
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              placeholder="e.g. INV-2026-089"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono placeholder-zinc-500 outline-none focus:border-red-500 transition-colors"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-2xs font-semibold text-zinc-300 uppercase tracking-wider font-mono">
              Notes / Vendor Information (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Paid to Metro Cash & Carry, bill kept in register"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 outline-none focus:border-red-500 transition-colors"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
