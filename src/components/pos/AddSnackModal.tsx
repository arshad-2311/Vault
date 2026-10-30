import React, { useState, useEffect } from 'react';
import { UtensilsCrossed, Plus, Minus, Search, AlertCircle, Check, Trash2 } from 'lucide-react';
import { Session, SnackItem } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/storage';
import { formatRupees, rupeesToPaise } from '../../utils/formatters';

interface AddSnackModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session | null;
  onSnackAdded: () => void;
}

export const AddSnackModal: React.FC<AddSnackModalProps> = ({
  isOpen,
  onClose,
  session,
  onSnackAdded,
}) => {
  const { currentUser } = useAuth();
  const snacks = db.getSnacks().filter((s) => s.isActive);
  const pricingConfig = db.getPricingConfig();

  const [activeSession, setActiveSession] = useState<Session | null>(session);
  const [selectedSnackId, setSelectedSnackId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customPriceRupees, setCustomPriceRupees] = useState<string>('50');

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setActiveSession(session);
      const activeSnacks = db.getSnacks().filter((s) => s.isActive);
      if (activeSnacks.length > 0) {
        setSelectedSnackId(activeSnacks[0].id);
      }
      setQuantity(1);
      setIsCustom(false);
      setCustomName('');
      setCustomPriceRupees('50');
      setError(null);
      setSearch('');
      setCategory('All');
    }
  }, [isOpen, session]);

  if (!activeSession) return null;

  const handleRemoveItem = (itemId: string) => {
    try {
      const updated = db.removeSnackFromSession({
        sessionId: activeSession.id,
        itemId,
        actor: currentUser,
      });
      setActiveSession(updated);
      onSnackAdded();
    } catch (err: any) {
      setError(err.message || 'Failed to remove snack.');
    }
  };

  const categories = ['All', ...Array.from(new Set(snacks.map((s) => s.category)))];

  const filteredSnacks = snacks.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = category === 'All' || s.category === category;
    return matchesSearch && matchesCat;
  });

  const selectedProduct = snacks.find((s) => s.id === selectedSnackId);

  const totalPaise = isCustom
    ? rupeesToPaise(customPriceRupees) * quantity
    : selectedProduct
    ? selectedProduct.pricePaise * quantity
    : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (quantity <= 0) {
      setError('Quantity must be at least 1.');
      return;
    }

    try {
      if (isCustom) {
        if (!pricingConfig.allowCustomSnacks) {
          setError('Custom snack entries are disabled by administrator.');
          return;
        }
        if (!customName.trim()) {
          setError('Custom item name is required.');
          return;
        }
        const unitPricePaise = rupeesToPaise(customPriceRupees);
        if (unitPricePaise <= 0) {
          setError('Custom price must be greater than ₹0.');
          return;
        }

        db.addSnackToSession({
          sessionId: activeSession.id,
          productId: null,
          customName: customName.trim(),
          unitPricePaise,
          quantity,
          actor: currentUser,
        });
      } else {
        if (!selectedProduct) {
          setError('Please select a snack item.');
          return;
        }

        if (quantity <= 0) {
          setError('Quantity must be at least 1.');
          return;
        }

        if (selectedProduct.stock !== undefined && quantity > selectedProduct.stock) {
          setError(`Cannot add ${quantity} items. Only ${selectedProduct.stock} left in stock.`);
          return;
        }

        db.addSnackToSession({
          sessionId: activeSession.id,
          productId: selectedProduct.id,
          unitPricePaise: selectedProduct.pricePaise,
          quantity,
          actor: currentUser,
        });
      }

      onSnackAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add snack.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Snacks & Drinks"
      description={`Manage concessions for active session: ${activeSession.customerName} (${activeSession.stationName})`}
      maxWidth="lg"
      onSubmit={handleSubmit}
      footer={
        <div className="w-full flex items-center justify-between">
          <div className="text-xs font-mono font-bold text-red-400">
            Total to add: {formatRupees(totalPaise)}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              leftIcon={<UtensilsCrossed className="w-4 h-4" />}
              className="bg-red-600 hover:bg-red-500 text-white font-bold border-red-500 shadow-md shadow-red-950/60"
            >
              Add to Bill
            </Button>
          </div>
        </div>
      }
    >
      {error && (
        <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Current Snacks in Session with delete button */}
      {activeSession.items && activeSession.items.length > 0 && (
        <div className="p-3.5 rounded-xl bg-[#09090e] border border-red-950/60 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xs uppercase tracking-wider font-bold text-red-400 font-mono">
              Current Session Snacks ({activeSession.items.length})
            </span>
            <span className="text-xs font-mono font-bold text-white">
              Subtotal: {formatRupees(activeSession.snackSubtotalPaise)}
            </span>
          </div>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {activeSession.items.map((it) => (
              <div
                key={it.id}
                className="flex items-center justify-between p-2 rounded-lg bg-[#050507] border border-white/[0.06] text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-200">
                    {it.quantity}x {it.name}
                  </span>
                  <span className="text-3xs text-slate-500 font-mono block">
                    @{formatRupees(it.unitPricePaise)} each
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-red-400">
                    {formatRupees(it.lineTotalPaise)}
                  </span>
                  <button
                    type="button"
                    title="Delete snack item"
                    onClick={() => handleRemoveItem(it.id)}
                    className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900 border border-red-800/40 text-red-400 hover:text-white transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Switch: Standard Catalogue vs Custom Item */}
      <div className="flex items-center justify-between p-1 rounded-lg bg-[#060608] border border-white/[0.08] text-xs font-medium">
        <button
          type="button"
          onClick={() => setIsCustom(false)}
          className={`flex-1 py-1.5 rounded-md transition-colors ${
            !isCustom ? 'bg-red-600 text-white font-bold shadow-sm shadow-red-950/50' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Snack Catalogue ({snacks.length})
        </button>
        {pricingConfig.allowCustomSnacks && (
          <button
            type="button"
            onClick={() => setIsCustom(true)}
            className={`flex-1 py-1.5 rounded-md transition-colors ${
              isCustom ? 'bg-red-600 text-white font-bold shadow-sm shadow-red-950/50' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Custom Off-Menu Item
          </button>
        )}
      </div>

      {isCustom ? (
        /* Custom Item Form */
        <div className="space-y-3 p-4 rounded-xl bg-[#08080c] border border-white/[0.08]">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Custom Item Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              autoFocus
              required
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Special Sandwich / Juice"
              className="w-full px-3 py-2 rounded-lg bg-[#050507] border border-white/[0.1] text-slate-100 text-xs focus:border-red-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Unit Price (₹) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min="1"
              step="1"
              required
              value={customPriceRupees}
              onChange={(e) => setCustomPriceRupees(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#050507] border border-white/[0.1] text-slate-100 text-xs font-mono focus:border-red-500 outline-none"
            />
          </div>
        </div>
      ) : (
        /* Catalogue Browser */
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search snack or beverage..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#050507] border border-white/[0.08] text-slate-100 text-xs placeholder:text-slate-600 focus:border-red-500 outline-none"
              />
            </div>
          </div>

          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-2xs">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-colors ${
                  category === cat
                    ? 'bg-red-600 text-white font-bold shadow-sm shadow-red-950/50'
                    : 'bg-[#0e0e14] text-slate-400 hover:text-slate-200 border border-white/[0.06]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Snacks Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
            {filteredSnacks.map((snk) => {
              const isSelected = selectedSnackId === snk.id;
              const isOutOfStock = snk.stock !== undefined && snk.stock <= 0;
              const isLowStock = snk.stock !== undefined && snk.stock > 0 && snk.stock <= (snk.lowStockThreshold ?? 5);

              return (
                <button
                  key={snk.id}
                  type="button"
                  disabled={isOutOfStock}
                  onClick={() => setSelectedSnackId(snk.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    isOutOfStock
                      ? 'bg-slate-950/40 border-slate-900 opacity-40 cursor-not-allowed'
                      : isSelected
                      ? 'bg-red-950/50 border-red-500 text-white shadow-md shadow-red-950/40'
                      : 'bg-[#08080c] border-white/[0.08] text-slate-300 hover:text-white hover:border-red-500/30'
                  }`}
                >
                  <p className="text-xs font-semibold truncate">{snk.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-2xs font-mono font-bold text-red-400">
                      {formatRupees(snk.pricePaise)}
                    </span>
                    {snk.stock !== undefined && (
                      <span
                        className={`text-3xs font-mono font-semibold px-1 py-0.2 rounded ${
                          isOutOfStock
                            ? 'bg-red-950 text-red-400 border border-red-800/60'
                            : isLowStock
                            ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                            : 'text-slate-500'
                        }`}
                      >
                        {isOutOfStock ? '0 left' : `${snk.stock} left`}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Quantity Selector */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950/80 border border-slate-800">
        <div>
          <span className="text-xs font-medium text-slate-300">Quantity</span>
          <p className="text-2xs text-slate-400 font-mono">
            Line Total: {formatRupees(totalPaise)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 hover:text-white"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold font-mono text-white px-2">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity(quantity + 1)}
            className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200 hover:text-white"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Modal>
  );
};
