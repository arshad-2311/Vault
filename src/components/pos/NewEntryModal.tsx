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
  const [isMultiplayer, setIsMultiplayer] = useState(false);
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
      if (preselectedStationId) {
        const found = allStations.find((s) => s.id === preselectedStationId);
        if (found) {
          setStationId(found.id);
          setGamingType(found.gamingType);
        }
      } else {
        const available = allStations.find((s) => s.status === 'available');
        if (available) {
          setStationId(available.id);
          setGamingType(available.gamingType);
        }
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
    (s) => s.gamingType === gamingType && (s.status === 'available' || s.id === stationId)
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
      estimatedInitialBasePaise = isMultiplayer
        ? pricingConfig.ps5MultiplayerHourlyRatePaise
        : pricingConfig.ps5HourlyRatePaise;
    } else {
      estimatedInitialBasePaise = pricingConfig.poolHourlyRatePaise;
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
        isMultiplayer: gamingType === 'ps5' ? isMultiplayer : false,
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
            <span className="text-xs font-mono font-bold text-amber-400">
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
              isLoading={isSubmitting}
              leftIcon={<Sparkles className="w-4 h-4" />}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold border-amber-400"
            >
              Start Session
            </Button>
          </div>
        </div>
      }
    >
      {error && (
        <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <Info className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Customer Details */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Customer Name <span className="text-rose-400">*</span>
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
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-600 text-sm focus:border-amber-500 outline-none"
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
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-600 text-sm focus:border-amber-500 outline-none font-mono"
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
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500/60 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Gamepad2 className="w-4 h-4 text-blue-400" />
              <span>PS5 Lounge</span>
            </button>

            <button
              type="button"
              onClick={() => handleGamingTypeChange('pool')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                gamingType === 'pool'
                  ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/60 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <CircleDot className="w-4 h-4 text-emerald-400" />
              <span>8-Ball Pool</span>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">
            Station / Table <span className="text-rose-400">*</span>
          </label>
          <select
            value={stationId}
            onChange={(e) => setStationId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:border-amber-500 outline-none"
          >
            {availableStationsOfType.length === 0 ? (
              <option value="">No {gamingType.toUpperCase()} stations available</option>
            ) : (
              availableStationsOfType.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} — {st.status === 'occupied' ? 'Occupied' : 'Ready'}
                </option>
              ))
            )}
          </select>
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
                  ? 'bg-amber-500 text-slate-950 font-bold'
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
                  ? 'bg-amber-500 text-slate-950 font-bold'
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-200">
                    {isMultiplayer ? 'PS5 Multiplayer (2-4 Players)' : 'PS5 Single Player'}
                  </p>
                  <p className="text-2xs text-slate-400 font-mono">
                    Rate: {formatRupees(isMultiplayer ? pricingConfig.ps5MultiplayerHourlyRatePaise : pricingConfig.ps5HourlyRatePaise)}/hr
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 select-none">
                  <input
                    type="checkbox"
                    checked={isMultiplayer}
                    onChange={(e) => setIsMultiplayer(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-amber-400"
                  />
                  <span>Multiplayer (+₹70/hr)</span>
                </label>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Standard Pool Table Rate</span>
                <span className="font-semibold text-emerald-400 font-mono">
                  {formatRupees(pricingConfig.poolHourlyRatePaise)} / hour
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
                          ? 'bg-amber-950/40 border-amber-500 text-white'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <p className="text-xs font-semibold">{plan.name}</p>
                      <p className="text-2xs font-mono text-amber-400 font-bold mt-0.5">
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
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs focus:border-amber-500 font-mono outline-none"
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
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-xs placeholder:text-slate-600 focus:border-amber-500 outline-none"
          />
        </div>
      </div>

      {/* 5. Drinks & Snacks Concessions Section */}
      <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsSnacksExpanded(!isSnacksExpanded)}
            className="flex items-center gap-2 text-xs font-medium text-slate-200 hover:text-amber-400 transition-colors"
          >
            <UtensilsCrossed className="w-4 h-4 text-amber-400" />
            <span>Add Drinks & Snacks</span>
            {totalSnackItemsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-3xs font-bold font-mono">
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
            <span className="text-xs font-mono font-bold text-amber-400">
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
                      ? 'bg-slate-700 text-white font-semibold'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Snacks Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
              {filteredSnacks.map((snk) => {
                const qty = selectedSnacks[snk.id] || 0;
                return (
                  <div
                    key={snk.id}
                    className={`p-2 rounded-lg border text-left flex flex-col justify-between ${
                      qty > 0
                        ? 'bg-amber-950/30 border-amber-600/50'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div>
                      <p className="text-2xs font-medium text-slate-200 truncate">{snk.name}</p>
                      <p className="text-3xs font-mono text-slate-400">
                        {formatRupees(snk.pricePaise)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-slate-800/60">
                      <button
                        type="button"
                        onClick={() => handleSnackQtyChange(snk.id, -1)}
                        disabled={qty === 0}
                        className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold font-mono text-white">{qty}</span>
                      <button
                        type="button"
                        onClick={() => handleSnackQtyChange(snk.id, 1)}
                        className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white"
                      >
                        <Plus className="w-3 h-3" />
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
