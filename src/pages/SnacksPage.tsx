import React, { useState, useEffect } from 'react';
import {
  UtensilsCrossed,
  Plus,
  Search,
  Edit2,
  CheckCircle,
  XCircle,
  Tag,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { SnackItem } from '../types';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/storage';
import { formatRupees, rupeesToPaise, paiseToRupees } from '../utils/formatters';

export const SnacksPage: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const [snacks, setSnacks] = useState<SnackItem[]>(() => db.getSnacks());
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Add / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSnack, setEditingSnack] = useState<SnackItem | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('Beverages');
  const [priceInput, setPriceInput] = useState('40');
  const [isActiveInput, setIsActiveInput] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setSnacks(db.getSnacks());
  };

  useEffect(() => {
    loadData();
  }, []);

  const categories = ['All', 'Beverages', 'Chips & Savouries', 'Chocolates', 'Hot Items'];

  const filteredSnacks = snacks.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === 'All' || s.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const handleOpenAdd = () => {
    if (!isAdmin) {
      alert('Restricted: Only administrators can add items to the catalogue.');
      return;
    }
    setEditingSnack(null);
    setNameInput('');
    setCategoryInput('Beverages');
    setPriceInput('40');
    setIsActiveInput(true);
    setError(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (snack: SnackItem) => {
    if (!isAdmin) {
      alert('Restricted: Only administrators can edit catalogue prices.');
      return;
    }
    setEditingSnack(snack);
    setNameInput(snack.name);
    setCategoryInput(snack.category);
    setPriceInput((snack.pricePaise / 100).toString());
    setIsActiveInput(snack.isActive);
    setError(null);
    setModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nameInput.trim()) {
      setError('Item name is required.');
      return;
    }

    const pricePaise = rupeesToPaise(priceInput);
    if (pricePaise <= 0) {
      setError('Price must be greater than ₹0.');
      return;
    }

    try {
      if (editingSnack) {
        db.updateSnack(
          editingSnack.id,
          {
            name: nameInput.trim(),
            category: categoryInput.trim(),
            pricePaise,
            isActive: isActiveInput,
          },
          currentUser
        );
      } else {
        db.createSnack(
          {
            name: nameInput.trim(),
            category: categoryInput.trim(),
            pricePaise,
            isActive: isActiveInput,
          },
          currentUser
        );
      }

      loadData();
      setModalOpen(false);
    } catch (err: any) {
      setError(err.message || 'Failed to save item.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-red-500" />
            <span>Snacks & Concessions Catalogue</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configurable beverages, snacks, and price snapshots applied during check-in and active sessions.
          </p>
        </div>

        {isAdmin ? (
          <Button
            variant="primary"
            size="md"
            onClick={handleOpenAdd}
            leftIcon={<Plus className="w-4 h-4" />}
            className="font-semibold"
          >
            Add New Item
          </Button>
        ) : (
          <Badge variant="neutral" size="md">
            VIEW ONLY (STAFF)
          </Badge>
        )}
      </div>

      {/* Filter and Category Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search catalogue by item name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-600 focus:border-red-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto p-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-medium">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-md whitespace-nowrap transition-colors ${
                categoryFilter === cat
                  ? 'bg-red-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Snacks Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredSnacks.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
              item.isActive
                ? 'bg-slate-900/90 border-slate-800 hover:border-red-900/50 shadow-sm'
                : 'bg-slate-950 border-slate-850 opacity-50'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-3xs uppercase tracking-wider font-semibold text-slate-400 px-2 py-0.5 rounded bg-slate-800/80">
                  {item.category}
                </span>
                <Badge variant={item.isActive ? 'success' : 'neutral'} size="sm">
                  {item.isActive ? 'ACTIVE' : 'INACTIVE'}
                </Badge>
              </div>

              <h3 className="text-sm font-semibold text-slate-100 mt-2 line-clamp-2">
                {item.name}
              </h3>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
              <div>
                <span className="text-3xs text-slate-500 uppercase block font-mono">
                  Selling Price
                </span>
                <span className="text-base font-bold font-mono text-white tabular-nums">
                  {formatRupees(item.pricePaise)}
                </span>
              </div>

              {isAdmin && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleOpenEdit(item)}
                  leftIcon={<Edit2 className="w-3 h-3 text-red-400" />}
                  className="text-xs"
                >
                  Edit
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingSnack ? 'Edit Snack Item' : 'Add New Snack Item'}
          description="Updates to catalog prices will be applied to future entries without altering historical transaction records."
          maxWidth="md"
        >
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Item Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Red Bull Energy Drink (250ml)"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-red-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={categoryInput}
                  onChange={(e) => setCategoryInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 focus:border-red-500 outline-none"
                >
                  <option value="Beverages">Beverages</option>
                  <option value="Chips & Savouries">Chips & Savouries</option>
                  <option value="Chocolates">Chocolates</option>
                  <option value="Hot Items">Hot Items</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Selling Price (₹) <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 focus:border-red-500 outline-none"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={isActiveInput}
                  onChange={(e) => setIsActiveInput(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-red-600 focus:ring-red-500"
                />
                <span>Active item (Available for billing)</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <Button variant="secondary" size="md" type="button" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="md" type="submit">
                {editingSnack ? 'Save Changes' : 'Create Item'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
