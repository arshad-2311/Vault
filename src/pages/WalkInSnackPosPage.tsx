import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Search,
  Plus,
  Minus,
  Trash2,
  QrCode,
  Banknote,
  CreditCard,
  Printer,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { SnackItem, PaymentMethod, Session } from '../types';
import { db, VAULT_DATA_CHANGED_EVENT } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { formatRupees, formatPaiseToInputRupees, rupeesToPaise } from '../utils/formatters';
import { calculateFinalBill, validatePaymentAmounts } from '../utils/pricing';
import { Button } from '../components/common/Button';

interface WalkInSnackPosPageProps {
  onPrintReceipt?: (session: Session) => void;
}

export const WalkInSnackPosPage: React.FC<WalkInSnackPosPageProps> = ({ onPrintReceipt }) => {
  const { currentUser, isAdmin } = useAuth();
  const pricingConfig = db.getPricingConfig();

  const [snacks, setSnacks] = useState<SnackItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart: Map of snackId -> quantity
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState('');

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [gpayInput, setGpayInput] = useState('0');
  const [cashInput, setCashInput] = useState('0');
  const [discountInput, setDiscountInput] = useState('0');
  const [discountReason, setDiscountReason] = useState('');
  const [notes, setNotes] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [lastCompletedSale, setLastCompletedSale] = useState<Session | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = () => {
    setSnacks(db.getSnacks().filter((s) => s.isActive));
  };

  useEffect(() => {
    loadData();
    const handleDataChanged = () => loadData();
    window.addEventListener(VAULT_DATA_CHANGED_EVENT, handleDataChanged);
    return () => window.removeEventListener(VAULT_DATA_CHANGED_EVENT, handleDataChanged);
  }, []);

  const categories = ['All', ...Array.from(new Set(snacks.map((s) => s.category)))];

  const filteredSnacks = snacks.filter((s) => {
    const matchCat = selectedCategory === 'All' || s.category === selectedCategory;
    const matchSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  // Cart Calculations
  const cartItems = Object.entries(cart)
    .map(([snackId, qty]) => {
      const product = snacks.find((s) => s.id === snackId);
      return product && qty > 0 ? { product, qty, lineTotalPaise: product.pricePaise * qty } : null;
    })
    .filter(Boolean) as Array<{ product: SnackItem; qty: number; lineTotalPaise: number }>;

  const cartSubtotalPaise = cartItems.reduce((sum, item) => sum + item.lineTotalPaise, 0);
  const discountPaise = rupeesToPaise(discountInput);

  const billBreakdown = calculateFinalBill({
    gamingChargePaise: 0,
    snackSubtotalPaise: cartSubtotalPaise,
    discountPaise,
  });

  const gpayPaise = rupeesToPaise(gpayInput);
  const cashPaise = rupeesToPaise(cashInput);

  const validation = validatePaymentAmounts({
    method: paymentMethod,
    finalBillPaise: billBreakdown.finalBillPaise,
    gpayAmountPaise: gpayPaise,
    cashAmountPaise: cashPaise,
    allowPartial: false,
  });

  // Sync payment amounts when cart or discount updates
  const syncPaymentAmount = (method: PaymentMethod, billPaise: number) => {
    const exactStr = formatPaiseToInputRupees(billPaise);
    if (method === 'cash') {
      setCashInput(exactStr);
      setGpayInput('0');
    } else if (method === 'gpay') {
      setGpayInput(exactStr);
      setCashInput('0');
    } else if (method === 'split') {
      const half = Math.floor(billPaise / 200);
      const remainder = billPaise / 100 - half;
      setGpayInput(half.toString());
      setCashInput(remainder % 1 === 0 ? remainder.toFixed(0) : remainder.toFixed(2));
    }
  };

  const handleAddToCart = (snackId: string) => {
    const product = snacks.find((s) => s.id === snackId);
    if (!product) return;
    const currentQty = cart[snackId] || 0;
    if (product.stock !== undefined && currentQty >= product.stock) {
      setError(`Only ${product.stock} units available in stock.`);
      return;
    }

    const nextCart = { ...cart, [snackId]: currentQty + 1 };
    setCart(nextCart);
    setError(null);

    // Auto-update payment input
    const newSubtotal = Object.entries(nextCart).reduce((sum, [id, q]) => {
      const p = snacks.find((item) => item.id === id);
      return sum + (p ? p.pricePaise * q : 0);
    }, 0);
    const newFinal = Math.max(0, newSubtotal - discountPaise);
    syncPaymentAmount(paymentMethod, newFinal);
  };

  const handleUpdateQty = (snackId: string, delta: number) => {
    const currentQty = cart[snackId] || 0;
    const nextQty = Math.max(0, currentQty + delta);
    const product = snacks.find((s) => s.id === snackId);

    if (delta > 0 && product && product.stock !== undefined && nextQty > product.stock) {
      setError(`Only ${product.stock} units available in stock.`);
      return;
    }

    const nextCart = { ...cart };
    if (nextQty === 0) {
      delete nextCart[snackId];
    } else {
      nextCart[snackId] = nextQty;
    }
    setCart(nextCart);
    setError(null);

    const newSubtotal = Object.entries(nextCart).reduce((sum, [id, q]) => {
      const p = snacks.find((item) => item.id === id);
      return sum + (p ? p.pricePaise * q : 0);
    }, 0);
    const newFinal = Math.max(0, newSubtotal - discountPaise);
    syncPaymentAmount(paymentMethod, newFinal);
  };

  const handleSetMethod = (method: PaymentMethod) => {
    setPaymentMethod(method);
    setError(null);
    syncPaymentAmount(method, billBreakdown.finalBillPaise);
  };

  const handleApplyDiscount = (discRupeesStr: string, reason?: string) => {
    setDiscountInput(discRupeesStr);
    if (reason) setDiscountReason(reason);
    const dPaise = rupeesToPaise(discRupeesStr);
    const newFinal = Math.max(0, cartSubtotalPaise - dPaise);
    syncPaymentAmount(paymentMethod, newFinal);
  };

  const handleClearCart = () => {
    setCart({});
    setDiscountInput('0');
    setDiscountReason('');
    setGpayInput('0');
    setCashInput('0');
    setError(null);
  };

  const handleCompleteSale = (triggerPrint: boolean) => {
    setError(null);
    if (cartItems.length === 0) {
      setError('Please add at least one snack to the cart.');
      return;
    }

    if (!isAdmin && discountPaise > pricingConfig.maxEmployeeDiscountPaise) {
      setError(
        `Discount of ${formatRupees(discountPaise)} exceeds employee limit of ${formatRupees(
          pricingConfig.maxEmployeeDiscountPaise
        )}.`
      );
      return;
    }

    if (!validation.isValid) {
      setError(validation.error || 'Payment verification failed.');
      return;
    }

    try {
      setIsSubmitting(true);
      const itemsPayload = Object.entries(cart).map(([snackId, quantity]) => ({
        snackId,
        quantity,
      }));

      const sale = db.createWalkInSnackSale({
        customerName: customerName.trim() || 'Walk-in Customer',
        customerPhone: customerPhone.trim() || undefined,
        items: itemsPayload,
        discountPaise,
        discountReason: discountReason.trim() || undefined,
        paymentMethod,
        gpayAmountPaise: gpayPaise,
        cashAmountPaise: cashPaise,
        notes: notes.trim() || undefined,
        actor: currentUser,
      });

      setLastCompletedSale(sale);
      handleClearCart();

      if (triggerPrint) {
        onPrintReceipt?.(sale);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete snack sale.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Round-off targets
  const grossRupees = Math.round(cartSubtotalPaise / 100);
  const round50 = Math.floor(grossRupees / 50) * 50;
  const diff50 = grossRupees - round50;
  const round10 = Math.floor(grossRupees / 10) * 10;
  const diff10 = grossRupees - round10;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header in Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/40 flex items-center justify-center text-red-500">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white font-microgramma flex items-center gap-2">
              <span>Walk-in Snack Counter</span>
            </h1>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">
              Instant Point of Sale for concession purchases without booking a gaming slot
            </p>
          </div>
        </div>

        {lastCompletedSale && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>Sale recorded: {formatRupees(lastCompletedSale.finalBillPaise)}</span>
            <button
              type="button"
              onClick={() => onPrintReceipt?.(lastCompletedSale)}
              className="ml-1 px-2 py-0.5 rounded bg-emerald-900/80 hover:bg-emerald-800 text-white font-bold text-3xs font-mono"
            >
              Print Receipt
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-950/70 border border-red-800 text-red-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid: Left Catalogue, Right Cart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Catalogue (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Controls in Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search snack or drink..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#0a0a0f] border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-500 focus:border-red-500 outline-none"
              />
            </div>

            {/* Category pills in Row */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium transition-colors ${
                    selectedCategory === cat
                      ? 'bg-red-600 text-white font-bold shadow-sm'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Snack Cards in Responsive Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filteredSnacks.map((snk) => {
              const qtyInCart = cart[snk.id] || 0;
              const isOutOfStock = snk.stock !== undefined && snk.stock <= 0;

              return (
                <div
                  key={snk.id}
                  className={`p-3 rounded-xl border flex flex-col justify-between transition-all select-none ${
                    isOutOfStock
                      ? 'bg-[#09090d] border-zinc-900 opacity-50 cursor-not-allowed'
                      : qtyInCart > 0
                      ? 'border-red-600/70 bg-red-950/20 shadow-sm'
                      : 'bg-[#0e0e14] border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div
                    onClick={() => !isOutOfStock && handleAddToCart(snk.id)}
                    className="cursor-pointer"
                  >
                    <p className="text-xs font-bold text-white line-clamp-2 leading-tight">{snk.name}</p>
                    <p className="text-3xs text-zinc-400 mt-0.5 uppercase font-mono">{snk.category}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-black text-red-400 font-mono">
                        {formatRupees(snk.pricePaise)}
                      </span>
                      {snk.stock !== undefined && (
                        <span
                          className={`text-3xs font-mono font-bold px-1.5 py-0.5 rounded ${
                            isOutOfStock
                              ? 'bg-red-950 text-red-400'
                              : snk.stock <= 5
                              ? 'bg-amber-950/80 text-amber-300'
                              : 'text-zinc-500'
                          }`}
                        >
                          {isOutOfStock ? '0 in stock' : `${snk.stock} left`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quantity Tuner in Row */}
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/[0.06]">
                    {qtyInCart > 0 ? (
                      <div className="flex items-center justify-between w-full">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(snk.id, -1)}
                          className="w-7 h-7 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center font-bold"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-black text-white font-mono px-2">
                          {qtyInCart}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(snk.id, 1)}
                          className="w-7 h-7 rounded bg-red-600 hover:bg-red-500 text-white flex items-center justify-center font-bold"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={isOutOfStock}
                        onClick={() => handleAddToCart(snk.id)}
                        className="w-full py-1.5 px-2 rounded-lg bg-zinc-900 hover:bg-red-600 text-zinc-300 hover:text-white text-2xs font-bold transition-colors flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Cart & Payment Settlement (5 cols) */}
        <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-[#0c0c12] border border-white/[0.08] shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white uppercase font-mono">
                Order Cart ({cartItems.length} items)
              </h2>
              <span className="text-3xs text-zinc-400 font-mono">Quick billing for walk-in buyer</span>
            </div>
            {cartItems.length > 0 && (
              <button
                type="button"
                onClick={handleClearCart}
                className="text-3xs text-zinc-400 hover:text-red-400 font-mono underline"
              >
                Clear Cart
              </button>
            )}
          </div>

          {/* Customer Details in Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-3xs uppercase font-mono text-zinc-400 mb-1">
                Customer Name
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Walk-in Customer"
                className="w-full px-3 py-1.5 rounded-lg bg-[#050507] border border-zinc-800 text-xs text-white focus:border-red-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-3xs uppercase font-mono text-zinc-400 mb-1">
                Phone (Optional)
              </label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full px-3 py-1.5 rounded-lg bg-[#050507] border border-zinc-800 text-xs text-white font-mono focus:border-red-500 outline-none"
              />
            </div>
          </div>

          {/* Cart Itemized Rows */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {cartItems.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 text-xs font-mono">
                Cart is empty. Tap snacks on the left to add items.
              </div>
            ) : (
              cartItems.map(({ product, qty, lineTotalPaise }) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-[#08080c] border border-zinc-800/80 text-xs"
                >
                  <div className="flex-1 pr-2">
                    <p className="text-white font-medium truncate">{product.name}</p>
                    <span className="text-3xs text-zinc-400 font-mono">
                      {qty} × {formatRupees(product.pricePaise)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white">
                      {formatRupees(lineTotalPaise)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateQty(product.id, -qty)}
                      className="text-zinc-500 hover:text-red-400 p-1"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Subtotal & 1-Click Round Off */}
          {cartItems.length > 0 && (
            <div className="pt-2 border-t border-white/[0.06] space-y-2 text-xs">
              <div className="flex justify-between items-center text-zinc-300">
                <span>Items Subtotal:</span>
                <span className="font-mono font-bold text-white">
                  {formatRupees(cartSubtotalPaise)}
                </span>
              </div>

              {/* Round-off Pills in Row */}
              {((diff50 > 0 && round50 > 0) || (diff10 > 0 && round10 > 0 && diff10 !== diff50)) && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-3xs uppercase font-mono text-zinc-400 font-bold">Round Off:</span>
                  {diff50 > 0 && round50 > 0 && (
                    <button
                      type="button"
                      onClick={() => handleApplyDiscount(diff50.toString(), `Round off to ₹${round50}`)}
                      className="px-2.5 py-1 rounded-md bg-red-950/40 hover:bg-red-900/60 text-xs font-mono font-bold text-red-300 border border-red-700/60 transition-colors"
                    >
                      Round to ₹{round50} (-₹{diff50})
                    </button>
                  )}
                  {diff10 > 0 && round10 > 0 && diff10 !== diff50 && (
                    <button
                      type="button"
                      onClick={() => handleApplyDiscount(diff10.toString(), `Round off to ₹${round10}`)}
                      className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-xs font-mono font-bold text-zinc-200 border border-zinc-700 transition-colors"
                    >
                      Round to ₹{round10} (-₹{diff10})
                    </button>
                  )}
                  {Number(discountInput) > 0 && (
                    <button
                      type="button"
                      onClick={() => handleApplyDiscount('0', '')}
                      className="text-3xs text-zinc-400 hover:text-white underline font-mono ml-auto"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}

              {/* Discount Input in Row */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-3xs uppercase font-mono text-zinc-400 mb-1">
                    Discount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={discountInput}
                    onChange={(e) => handleApplyDiscount(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#050507] border border-zinc-800 text-xs font-mono text-white focus:border-red-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-3xs uppercase font-mono text-zinc-400 mb-1">
                    Discount Reason
                  </label>
                  <input
                    type="text"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    placeholder="e.g. Round off"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#050507] border border-zinc-800 text-xs text-white focus:border-red-500 outline-none"
                  />
                </div>
              </div>

              {/* Final Total Banner */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#0e0e14] border border-red-950/60">
                <span className="text-xs font-bold uppercase text-zinc-300">Total Amount Due</span>
                <span className="text-xl font-black font-mono text-white">
                  {formatRupees(billBreakdown.finalBillPaise)}
                </span>
              </div>

              {/* Payment Methods in Row */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-300">Payment Method</span>
                  {/* Quick accidental switch */}
                  {paymentMethod === 'gpay' ? (
                    <button
                      type="button"
                      onClick={() => handleSetMethod('cash')}
                      className="text-3xs font-mono text-red-400 hover:text-red-300 underline"
                    >
                      ⇄ Accidentally GPay? Switch to Cash
                    </button>
                  ) : paymentMethod === 'cash' ? (
                    <button
                      type="button"
                      onClick={() => handleSetMethod('gpay')}
                      className="text-3xs font-mono text-red-400 hover:text-red-300 underline"
                    >
                      ⇄ Accidentally Cash? Switch to GPay
                    </button>
                  ) : null}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSetMethod('cash')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      paymentMethod === 'cash'
                        ? 'bg-red-600 text-white border-red-500 shadow-sm'
                        : 'bg-[#0a0a0f] border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Cash</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetMethod('gpay')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      paymentMethod === 'gpay'
                        ? 'bg-red-600 text-white border-red-500 shadow-sm'
                        : 'bg-[#0a0a0f] border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>UPI / GPay</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSetMethod('split')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      paymentMethod === 'split'
                        ? 'bg-red-600 text-white border-red-500 shadow-sm'
                        : 'bg-[#0a0a0f] border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Split</span>
                  </button>
                </div>

                {/* Tendered Inputs in Row */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-3xs font-mono uppercase text-zinc-400 mb-1">
                      Cash Received (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={cashInput}
                      disabled={paymentMethod === 'gpay'}
                      onChange={(e) => setCashInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#050507] border border-zinc-800 text-xs font-mono text-white disabled:opacity-40 focus:border-red-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-3xs font-mono uppercase text-zinc-400 mb-1">
                      UPI / GPay (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={gpayInput}
                      disabled={paymentMethod === 'cash'}
                      onChange={(e) => setGpayInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#050507] border border-zinc-800 text-xs font-mono text-white disabled:opacity-40 focus:border-red-500 outline-none"
                    />
                  </div>
                </div>

                {/* Change Due Indicator in Row */}
                {validation.changeDuePaise > 0 && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs font-mono">
                    <span>Cash Change Return:</span>
                    <strong className="font-bold text-sm text-white">
                      {formatRupees(validation.changeDuePaise)}
                    </strong>
                  </div>
                )}
              </div>

              {/* Action Buttons in Row */}
              <div className="flex items-center gap-2 pt-3">
                <Button
                  variant="secondary"
                  size="md"
                  type="button"
                  disabled={isSubmitting || cartItems.length === 0}
                  onClick={() => handleCompleteSale(true)}
                  leftIcon={<Printer className="w-4 h-4 text-red-400" />}
                  className="flex-1 text-xs"
                >
                  Sell & Print
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  type="button"
                  isLoading={isSubmitting}
                  disabled={isSubmitting || cartItems.length === 0}
                  onClick={() => handleCompleteSale(false)}
                  leftIcon={<CheckCircle className="w-4 h-4" />}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold border-red-500 shadow-md shadow-red-950/60 text-xs"
                >
                  Complete Sale
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

