import React, { useState, useEffect } from 'react';
import { UtensilsCrossed, Plus, Minus, Search, AlertCircle, Check } from 'lucide-react';
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
  }, [isOpen]);

  if (!session) return null;

  const categories = ['All', ...Array.from(new Set(snacks.map((s) => s.category)))];

  const filteredSnacks = snacks.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchesCat = category === 'All' || s.category === category;
    return matchesSearch && matchesCat;
  });

  const selectedProduct = snacks.find((s) => s.id === selectedSnackId);

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
          sessionId: session.id,
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

        db.addSnackToSession({
          sessionId: session.id,
          productId: selectedProduct.id,
          unitPricePaise: selectedProduct.pricePaise, // historical snapshot
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
      title={`Add Snacks: ${session.stationName}`}
      description={`Add drinks or snacks to ${session.customerName}'s bill.`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Toggle between Catalogue and Custom Snack */}
        {pricingConfig.allowCustomSnacks && (
          <div className="flex items-center gap-2 p-1 rounded-lg bg-slate-950 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setIsCustom(false)}
              className={`flex-1 py-1 rounded-md font-medium transition-colors ${
                !isCustom
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Standard Catalogue
            </button>
            <button
              type="button"
              onClick={() => setIsCustom(true)}
              className={`flex-1 py-1 rounded-md font-medium transition-colors ${
                isCustom
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Custom Item
            </button>
          </div>
        )}

        {isCustom ? (
          <div className="space-y-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <label className="block text-2xs font-semibold text-slate-300 mb-1">
                Custom Item Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Special Grilled Sandwich"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-2xs font-semibold text-slate-300 mb-1">
                Selling Price (₹)
              </label>
              <input
                type="number"
                required
                min="1"
                step="1"
                value={customPriceRupees}
                onChange={(e) => setCustomPriceRupees(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs font-mono focus:border-brand-500"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Quick dropdown or compact picker */}
            <div>
              <label className="block text-2xs font-semibold text-slate-300 mb-1">
                Select Concession Item
              </label>
              <select
                value={selectedSnackId}
                onChange={(e) => setSelectedSnackId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-brand-500"
              >
                {snacks.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {formatRupees(s.pricePaise)} ({s.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Compact grid preview */}
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto pt-1 pr-1">
              {filteredSnacks.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedSnackId(s.id)}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    selectedSnackId === s.id
                      ? 'bg-brand-950/70 border-brand-500 text-white shadow-sm'
                      : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <p className="text-2xs font-medium truncate">{s.name}</p>
                  <p className="text-3xs font-mono font-bold text-amber-400 mt-0.5">
                    {formatRupees(s.pricePaise)}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quantity selector */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
          <div>
            <span className="text-xs font-semibold text-slate-300">Quantity</span>
            <p className="text-2xs text-slate-500 font-mono">
              {isCustom
                ? `Total: ${formatRupees(rupeesToPaise(customPriceRupees) * quantity)}`
                : selectedProduct
                ? `Total: ${formatRupees(selectedProduct.pricePaise * quantity)}`
                : ''}
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

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <Button variant="secondary" size="md" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            leftIcon={<UtensilsCrossed className="w-4 h-4" />}
            className="font-semibold"
          >
            Add to Bill
          </Button>
        </div>
      </form>
    </Modal>
  );
};
