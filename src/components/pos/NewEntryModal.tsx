import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  CircleDot,
  Clock,
  User,
  Phone,
  UtensilsCrossed,
  Plus,
  Minus,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Station, SnackItem, PricingConfig } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../services/storage';
import { formatRupees, formatRupeesShort } from '../../utils/formatters';

interface NewEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedStationId?: string | null;
  onSessionCreated: () => void;
}

export const NewEntryModal: React.FC<NewEntryModalProps> = ({
  isOpen,
  onClose,
  preselectedStationId,
  onSessionCreated,
}) => {
  const { currentUser } = useAuth();
  const [stations, setStations] = useState<Station[]>([]);
  const [snacks, setSnacks] = useState<SnackItem[]>([]);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>(() => db.getPricingConfig());

  // Form Fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [gamingType, setGamingType] = useState<'ps5' | 'pool'>('ps5');
  const [stationId, setStationId] = useState('');
  const [billingType, setBillingType] = useState<'hourly' | 'fixed'>('hourly');
  const [controllersCount, setControllersCount] = useState<number>(2);
  const [isMultiplayer, setIsMultiplayer] = useState(true);
  const [fixedPlanId, setFixedPlanId] = useState('');
  const [framesCount, setFramesCount] = useState(1);
  const [notes, setNotes] = useState('');

  // Local start time: format for datetime-local input YYYY-MM-DDTHH:mm
  const [startTimeLocal, setStartTimeLocal] = useState('');

  // Selected snack quantities: map of snackId -> quantity
  const [selectedSnacks, setSelectedSnacks] = useState<Record<string, number>>({});
  const [snackSearch, setSnackSearch] = useState('');
  const [activeSnackCategory, setActiveSnackCategory] = useState<string>('All');
  const [isSnacksExpanded, setIsSnacksExpanded] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const allStations = db.getStations();
      const allSnacks = db.getSnacks().filter((s) => s.isActive);
      const cfg = db.getPricingConfig();
      setStations(allStations);
      setSnacks(allSnacks);
      setPricingConfig(cfg);

      // Default time to current local
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const localStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
        now.getDate()
      )}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      setStartTimeLocal(localStr);

      // Determine initial station
      let initialStation: Station | undefined;

      if (preselectedStationId) {
        const found = allStations.find((s) => s.id === preselectedStationId);
        if (found && found.status === 'available') {
          initialStation = found;
        } else if (found) {
          // If preselected is occupied, select first available station of that same gaming type
          initialStation = allStations.find((s) => s.gamingType === found.gamingType && s.status === 'available')
            || allStations.find((s) => s.status === 'available');
        }
      }

      if (!initialStation) {
        // Pick first available of current gamingType (or any available)
        initialStation = allStations.find((s) => s.gamingType === gamingType && s.status === 'available')
          || allStations.find((s) => s.status === 'available');
      }

      if (initialStation) {
        setStationId(initialStation.id);
        setGamingType(initialStation.gamingType);
      } else {
        setStationId('');
      }

      if (cfg.ps5FixedPlans.length > 0) {
        setFixedPlanId(cfg.ps5FixedPlans[0].id);
      }

      // Reset fields
      setCustomerName('');
      setCustomerPhone('');
      setSelectedSnacks({});
      setNotes('');
      setError(null);
      setIsSnacksExpanded(false);
    }
  }, [isOpen, preselectedStationId]);

  // When gaming type switches, pick first available station of that type
  const handleGamingTypeChange = (type: 'ps5' | 'pool') => {
    setGamingType(type);
    const candidate = stations.find((s) => s.gamingType === type && s.status === 'available');
    if (candidate) {
      setStationId(candidate.id);
    } else {
      setStationId('');
    }
  };

  const handleSnackQtyChange = (snackId: string, delta: number) => {
    setSelectedSnacks((prev) => {
      const current = prev[snackId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[snackId];
        return copy;
      }
      return { ...prev, [snackId]: next };
    });
  };

  // Snack total calculation
  const snackTotalPaise = Object.entries(selectedSnacks).reduce((sum, [sId, qty]) => {
    const item = snacks.find((s) => s.id === sId);
    return sum + (item ? item.pricePaise * qty : 0);
  }, 0);

  const totalSnackItemsCount = Object.values(selectedSnacks).reduce((a, b) => a + b, 0);

  // Available categories
  const categories = ['All', ...Array.from(new Set(snacks.map((s) => s.category)))];

  const filteredSnacks = snacks.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(snackSearch.toLowerCase());
    const matchesCat = activeSnackCategory === 'All' || s.category === activeSnackCategory;
    return matchesSearch && matchesCat;
  });

  const availableStationsOfType = stations.filter(
    (s) => s.gamingType === gamingType && s.status === 'available'
  );

  // Live estimated initial charge preview
  let estimatedInitialBasePaise = 0;
  if (billingType === 'fixed') {
    if (gamingType === 'ps5') {
      const plan = pricingConfig.ps5FixedPlans.find((p) => p.id === fixedPlanId) || pricingConfig.ps5FixedPlans[0];
      estimatedInitialBasePaise = plan ? plan.pricePaise : 14000;
    } else {
      estimatedInitialBasePaise = (framesCount || 1) * pricingConfig.poolPerFrameRatePaise;
    }
  } else {
    // 1 hour standard estimate
    if (gamingType === 'ps5') {
      if (controllersCount === 4) {
        estimatedInitialBasePaise = pricingConfig.ps5Rate4PlayersPaise || 50000;
      } else if (controllersCount === 3) {
        estimatedInitialBasePaise = pricingConfig.ps5Rate3PlayersPaise || 40000;
      } else if (controllersCount === 2) {
        estimatedInitialBasePaise = pricingConfig.ps5Rate2PlayersPaise || pricingConfig.ps5MultiplayerHourlyRatePaise || 30000;
      } else {
        estimatedInitialBasePaise = pricingConfig.ps5Rate1PlayerPaise || pricingConfig.ps5HourlyRatePaise || 15000;
      }
    } else {
      estimatedInitialBasePaise = pricingConfig.snookerHourlyRatePaise || pricingConfig.poolHourlyRatePaise || 25000;
    }
  }

  const previewTotalPaise = estimatedInitialBasePaise + snackTotalPaise;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerName.trim()) {
      setError('Customer name is required.');
      return;
    }

    if (!stationId) {
      setError(`Please select an available ${gamingType.toUpperCase()} station.`);
      return;
    }

    try {
      setIsSubmitting(true);
      const startTimeISO = new Date(startTimeLocal).toISOString();

      const initialSnacks = Object.entries(selectedSnacks).map(([snackId, quantity]) => ({
        snackId,
        quantity,
      }));

      db.createSession({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        gamingType,
        stationId,
        billingType,
        startTimeISO,
        controllersCount: gamingType === 'ps5' ? controllersCount : undefined,
        isMultiplayer: gamingType === 'ps5' ? controllersCount > 1 : false,
        fixedPlanId: billingType === 'fixed' && gamingType === 'ps5' ? fixedPlanId : undefined,
        framesCount: billingType === 'fixed' && gamingType === 'pool' ? framesCount : undefined,
        initialSnacks,
        notes: notes.trim() || undefined,
        actor: currentUser,
      });

      onSessionCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create session.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Digital Entry"
      description="Register customer, assign station, and start gaming session."
      maxWidth="2xl"
      onSubmit={handleSubmit}
      footer={
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xs text-slate-400 font-mono">
              Staff: <strong className="text-slate-200">{currentUser.displayName}</strong>
            </span>
            <span className="hidden sm:inline-block text-slate-700">|</span>
            <span className="text-xs font-mono font-bold text-red-400">
              Est. Total: {formatRupees(previewTotalPaise)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={!stationId || isSubmitting || availableStationsOfType.length === 0}
              isLoading={isSubmitting}
              leftIcon={<Sparkles className="w-4 h-4" />}
              className="bg-red-600 hover:bg-red-500 text-white font-bold border-red-500 shadow-md shadow-red-950/50 disabled:opacity-40"
            >
              Start Session
            </Button>
          </div>
        </div>
      }
    >
      {error && (
        <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Customer Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Customer Name <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              autoFocus
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Aryan Sharma"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-600 text-sm focus:border-red-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Customer Phone <span className="text-slate-500 text-2xs">(Optional)</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-600 text-sm focus:border-red-500 outline-none font-mono"
            />
          </div>
        </div>
      </div>

      {/* 2. Gaming Type & Station Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Game Type
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleGamingTypeChange('ps5')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                gamingType === 'ps5'
                  ? 'bg-red-600/20 text-red-300 border-red-500/60 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Gamepad2 className="w-4 h-4 text-red-400" />
              <span>PS5 Lounge</span>
            </button>

            <button
              type="button"
              onClick={() => handleGamingTypeChange('pool')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                gamingType === 'pool'
                  ? 'bg-red-600/20 text-red-300 border-red-500/60 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <CircleDot className="w-4 h-4 text-red-400" />
              <span>Snooker Table</span>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Station / Table <span className="text-red-400">*</span>
          </label>
          <select
            value={stationId}
            onChange={(e) => setStationId(e.target.value)}
            disabled={availableStationsOfType.length === 0}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:border-red-500 outline-none disabled:opacity-50"
          >
            {availableStationsOfType.length === 0 ? (
              <option value="">
                All {gamingType === 'pool' ? 'Snooker tables' : 'PS5 stations'} currently in use
              </option>
            ) : (
              availableStationsOfType.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} — Ready
                </option>
              ))
            )}
          </select>
          {availableStationsOfType.length === 0 && (
            <p className="text-3xs text-red-400 font-mono mt-1">
              All {gamingType === 'pool' ? 'Snooker tables' : 'PS5 stations'} are occupied. Choose another game or end an active session first.
            </p>
          )}
        </div>
      </div>

      {/* 3. Pricing Rule & Billing Type */}
      <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-300">Billing Policy</span>
          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setBillingType('hourly')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                billingType === 'hourly'
                  ? 'bg-red-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Hourly Rate
            </button>
            <button
              type="button"
              onClick={() => setBillingType('fixed')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                billingType === 'fixed'
                  ? 'bg-red-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Fixed Pass / Frames
            </button>
          </div>
        </div>

        {/* Hourly options */}
        {billingType === 'hourly' && (
          <div className="pt-2 border-t border-slate-800/80">
            {gamingType === 'ps5' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">
                    Number of Players / Joysticks (VAULT Rate):
                  </label>
                  <span className="text-2xs font-mono font-bold text-red-400">
                    {controllersCount === 1 && `1 Player — ${formatRupees(pricingConfig.ps5Rate1PlayerPaise || 15000)}/hr`}
                    {controllersCount === 2 && `2 Players — ${formatRupees(pricingConfig.ps5Rate2PlayersPaise || 30000)}/hr`}
                    {controllersCount === 3 && `3 Players — ${formatRupees(pricingConfig.ps5Rate3PlayersPaise || 40000)}/hr`}
                    {controllersCount === 4 && `4 Players — ${formatRupees(pricingConfig.ps5Rate4PlayersPaise || 50000)}/hr`}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { count: 1, label: '1 Joystick', sub: '1 Player', rate: pricingConfig.ps5Rate1PlayerPaise || 15000 },
                    { count: 2, label: '2 Joysticks', sub: '2 Players', rate: pricingConfig.ps5Rate2PlayersPaise || 30000 },
                    { count: 3, label: '3 Joysticks', sub: '3 Players', rate: pricingConfig.ps5Rate3PlayersPaise || 40000 },
                    { count: 4, label: '4 Joysticks', sub: '4 Players', rate: pricingConfig.ps5Rate4PlayersPaise || 50000 },
                  ].map((opt) => (
                    <button
                      key={opt.count}
                      type="button"
                      onClick={() => {
                        setControllersCount(opt.count);
                        setIsMultiplayer(opt.count > 1);
                      }}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        controllersCount === opt.count
                          ? 'bg-red-600/25 border-red-500 text-white shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-xs font-bold">{opt.label}</div>
                      <div className="text-3xs text-slate-400">{opt.sub}</div>
                      <div className="text-xs font-mono font-bold text-red-400 mt-0.5">
                        {formatRupees(opt.rate)}/h
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs py-1">
                <div>
                  <span className="text-slate-200 font-medium block">Snooker Table Rate</span>
                  <span className="text-3xs text-slate-400 font-mono">Monday - Sunday standard rate</span>
                </div>
                <span className="font-bold text-red-400 font-mono text-sm">
                  {formatRupees(pricingConfig.snookerHourlyRatePaise || pricingConfig.poolHourlyRatePaise || 25000)} / hour
                </span>
              </div>
            )}
          </div>
        )}

        {/* Fixed options */}
        {billingType === 'fixed' && (
          <div className="pt-2 border-t border-slate-800/80">
            {gamingType === 'ps5' ? (
              <div>
                <label className="block text-2xs font-semibold text-slate-400 mb-1.5 uppercase">
                  Select PS5 Fixed Pass
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {pricingConfig.ps5FixedPlans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => setFixedPlanId(plan.id)}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        fixedPlanId === plan.id
                          ? 'bg-red-950/40 border-red-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <p className="text-xs font-semibold">{plan.name}</p>
                      <p className="text-2xs font-mono text-red-400 font-bold mt-0.5">
                        {formatRupees(plan.pricePaise)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-200">Per Frame Billing</p>
                  <p className="text-2xs text-slate-400 font-mono">
                    Rate: {formatRupees(pricingConfig.poolPerFrameRatePaise)} / frame
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFramesCount(Math.max(1, framesCount - 1))}
                    className="w-7 h-7 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-sm font-bold font-mono px-2 text-white">
                    {framesCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFramesCount(framesCount + 1)}
                    className="w-7 h-7 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Start Time & Session Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Start Time
          </label>
          <div className="relative">
            <Clock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="datetime-local"
              value={startTimeLocal}
              onChange={(e) => setStartTimeLocal(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:border-red-500 font-mono outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Session Notes <span className="text-slate-500 text-2xs">(Optional)</span>
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. VIP tournament / Group"
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs placeholder:text-slate-600 focus:border-red-500 outline-none"
          />
        </div>
      </div>

      {/* 5. Drinks & Snacks Concessions Section */}
      <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsSnacksExpanded(!isSnacksExpanded)}
            className="flex items-center gap-2 text-xs font-medium text-slate-200 hover:text-red-400 transition-colors"
          >
            <UtensilsCrossed className="w-4 h-4 text-red-400" />
            <span>Add Drinks & Snacks</span>
            {totalSnackItemsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-3xs font-bold font-mono">
                {totalSnackItemsCount} items
              </span>
            )}
            {isSnacksExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
          {snackTotalPaise > 0 && (
            <span className="text-xs font-mono font-bold text-red-400">
              Snacks: {formatRupees(snackTotalPaise)}
            </span>
          )}
        </div>

        {isSnacksExpanded && (
          <div className="space-y-2.5 pt-2 border-t border-slate-800/60">
            {/* Search and Category Filter */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={snackSearch}
                onChange={(e) => setSnackSearch(e.target.value)}
                placeholder="Search snack or beverage..."
                className="flex-1 px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder:text-slate-500 outline-none"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 text-2xs">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveSnackCategory(cat)}
                  className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
                    activeSnackCategory === cat
                      ? 'bg-red-600 text-white font-semibold'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Snacks Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
              {filteredSnacks.map((snk) => {
                const qty = selectedSnacks[snk.id] || 0;
                const isOutOfStock = snk.stock !== undefined && snk.stock <= 0;
                const isLowStock = snk.stock !== undefined && snk.stock > 0 && snk.stock <= (snk.lowStockThreshold ?? 5);
                const isMaxReached = snk.stock !== undefined && qty >= snk.stock;

                return (
                  <div
                    key={snk.id}
                    className={`p-2 rounded-lg border text-left flex flex-col justify-between ${
                      isOutOfStock
                        ? 'bg-slate-950/60 border-slate-900 opacity-60'
                        : qty > 0
                        ? 'bg-red-950/30 border-red-600/50'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div>
                      <p className="text-2xs font-medium text-slate-200 truncate">{snk.name}</p>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-3xs font-mono text-slate-400">
                          {formatRupees(snk.pricePaise)}
                        </span>
                        {snk.stock !== undefined && (
                          <span
                            className={`text-3xs font-mono font-semibold px-1 rounded ${
                              isOutOfStock
                                ? 'bg-red-950 text-red-400 border border-red-800/60'
                                : isLowStock
                                ? 'bg-amber-950/80 text-amber-300 border border-amber-800/60'
                                : 'text-slate-500'
                            }`}
                          >
                            {isOutOfStock ? 'Out of stock' : `${snk.stock} left`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-800/60">
                      <button
                        type="button"
                        onClick={() => handleSnackQtyChange(snk.id, -1)}
                        disabled={qty === 0}
                        className="w-7 h-7 sm:w-6 sm:h-6 rounded bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-xs font-bold font-mono text-white">{qty}</span>
                      <button
                        type="button"
                        onClick={() => handleSnackQtyChange(snk.id, 1)}
                        disabled={isOutOfStock || isMaxReached}
                        className="w-7 h-7 sm:w-6 sm:h-6 rounded bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
