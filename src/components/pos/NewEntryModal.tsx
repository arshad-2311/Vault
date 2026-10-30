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
import { formatRupees } from '../../utils/formatters';

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
  const [gamingType, setGamingType] = useState<'ps5' | 'pool'>('pool');
  const [stationId, setStationId] = useState('');
  const [billingType, setBillingType] = useState<'hourly' | 'fixed'>('hourly');
  const [controllersCount, setControllersCount] = useState<number>(1);
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

  const toLocalISOString = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;
  };

  useEffect(() => {
    if (isOpen) {
      const allStations = db.getStations();
      const allSnacks = db.getSnacks().filter((s) => s.isActive);
      const cfg = db.getPricingConfig();
      setStations(allStations);
      setSnacks(allSnacks);
      setPricingConfig(cfg);

      // Default time to current local
      setStartTimeLocal(toLocalISOString(new Date()));

      // Determine initial station
      let initialStation: Station | undefined;

      if (preselectedStationId) {
        const found = allStations.find((s) => s.id === preselectedStationId);
        if (found && found.status === 'available') {
          initialStation = found;
        } else if (found) {
          // If preselected is occupied, select first available station of that same gaming type
          initialStation =
            allStations.find((s) => s.gamingType === found.gamingType && s.status === 'available') ||
            allStations.find((s) => s.status === 'available');
        }
      }

      if (!initialStation) {
        // Pick first available of current gamingType (or any available)
        initialStation =
          allStations.find((s) => s.gamingType === gamingType && s.status === 'available') ||
          allStations.find((s) => s.status === 'available');
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

  // Start Time Presets (e.g. customer arrives at 3:55 for a 4:00 slot)
  const handleSetTimeNow = () => {
    setStartTimeLocal(toLocalISOString(new Date()));
  };

  const handleRoundToNextHour = () => {
    const d = startTimeLocal ? new Date(startTimeLocal) : new Date();
    // If not on exact :00, advance to next top of the hour
    if (d.getMinutes() > 0) {
      d.setHours(d.getHours() + 1);
    }
    d.setMinutes(0, 0, 0);
    setStartTimeLocal(toLocalISOString(d));
  };

  const handleRoundToHalfHour = () => {
    const d = startTimeLocal ? new Date(startTimeLocal) : new Date();
    const mins = d.getMinutes();
    if (mins < 30) {
      d.setMinutes(30, 0, 0);
    } else {
      d.setHours(d.getHours() + 1);
      d.setMinutes(0, 0, 0);
    }
    setStartTimeLocal(toLocalISOString(d));
  };

  const handleAdjustMinutes = (deltaMins: number) => {
    const d = startTimeLocal ? new Date(startTimeLocal) : new Date();
    d.setMinutes(d.getMinutes() + deltaMins);
    setStartTimeLocal(toLocalISOString(d));
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

  const stationsOfType = stations.filter((s) => s.gamingType === gamingType);
  const availableStationsOfType = stationsOfType.filter((s) => s.status === 'available');

  // Rate calculation for the session rate banner
  let currentHourlyRatePaise = 25000;
  if (gamingType === 'ps5') {
    if (controllersCount === 4) {
      currentHourlyRatePaise = pricingConfig.ps5Rate4PlayersPaise || 50000;
    } else if (controllersCount === 3) {
      currentHourlyRatePaise = pricingConfig.ps5Rate3PlayersPaise || 40000;
    } else if (controllersCount === 2) {
      currentHourlyRatePaise =
        pricingConfig.ps5Rate2PlayersPaise || pricingConfig.ps5MultiplayerHourlyRatePaise || 30000;
    } else {
      currentHourlyRatePaise =
        pricingConfig.ps5Rate1PlayerPaise || pricingConfig.ps5HourlyRatePaise || 15000;
    }
  } else {
    currentHourlyRatePaise =
      pricingConfig.snookerHourlyRatePaise || pricingConfig.poolHourlyRatePaise || 25000;
  }

  // Calculate schedule time difference from now
  const scheduledDate = startTimeLocal ? new Date(startTimeLocal) : new Date();
  const diffFromNowMinutes = Math.round((scheduledDate.getTime() - Date.now()) / (1000 * 60));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerName.trim()) {
      setError('Customer name is required.');
      return;
    }

    if (!stationId) {
      setError(`Please select an available ${gamingType === 'pool' ? 'Snooker table' : 'PS5 station'}.`);
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
      title="Start a session"
      description="The timer starts as soon as you confirm."
      maxWidth="lg"
      onSubmit={handleSubmit}
      footer={
        <div className="w-full flex items-center justify-between">
          <div className="text-2xs text-zinc-400 font-mono">
            Staff: <strong className="text-zinc-200">{currentUser.displayName}</strong>
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
              className="bg-red-600 hover:bg-red-500 text-white font-bold border-red-500 shadow-md shadow-red-950/60 px-5"
            >
              Start timer
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-950/70 border border-red-800 text-red-300 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Service Selector (Snooker / PlayStation 5) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-zinc-300">Service</label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleGamingTypeChange('pool')}
              className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all ${
                gamingType === 'pool'
                  ? 'border-red-600 bg-red-950/25 text-white shadow-sm ring-1 ring-red-600/40'
                  : 'bg-[#0e0e14] border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850'
              }`}
            >
              <CircleDot className={`w-4 h-4 ${gamingType === 'pool' ? 'text-red-500' : 'text-zinc-400'}`} />
              <span>Snooker</span>
            </button>

            <button
              type="button"
              onClick={() => handleGamingTypeChange('ps5')}
              className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all ${
                gamingType === 'ps5'
                  ? 'border-red-600 bg-red-950/25 text-white shadow-sm ring-1 ring-red-600/40'
                  : 'bg-[#0e0e14] border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850'
              }`}
            >
              <Gamepad2 className={`w-4 h-4 ${gamingType === 'ps5' ? 'text-red-500' : 'text-zinc-400'}`} />
              <span>PlayStation 5</span>
            </button>
          </div>
        </div>

        {/* 2. Customer Name */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-zinc-300">
            Customer name <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              autoFocus
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Rohit"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0a0a0f] border border-zinc-800 text-zinc-100 placeholder:text-zinc-600 text-sm focus:border-red-500 outline-none transition-colors"
            />
          </div>
        </div>

        {/* 3. Table / Station Cards Grid */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-medium text-zinc-300">
              {gamingType === 'pool' ? 'Table' : 'Station'}
            </label>
            {availableStationsOfType.length === 0 && (
              <span className="text-3xs text-red-400 font-mono">
                All {gamingType === 'pool' ? 'tables' : 'stations'} occupied
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {stationsOfType.map((st) => {
              const isSelected = stationId === st.id;
              const isOccupied = st.status === 'occupied';

              return (
                <button
                  key={st.id}
                  type="button"
                  disabled={isOccupied}
                  onClick={() => setStationId(st.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-red-600 bg-red-950/20 text-white ring-1 ring-red-600/50'
                      : isOccupied
                      ? 'bg-[#09090c] border-zinc-900 opacity-50 cursor-not-allowed'
                      : 'bg-[#0e0e14] border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  <p className="text-xs font-bold truncate">{st.name}</p>
                  <p
                    className={`text-2xs font-mono mt-0.5 ${
                      isOccupied ? 'text-red-400' : 'text-zinc-400'
                    }`}
                  >
                    {isOccupied ? 'Occupied' : 'Available'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. Number of Players (Only for PS5) */}
        {gamingType === 'ps5' && (
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-300">
              Number of players
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { count: 1, rate: pricingConfig.ps5Rate1PlayerPaise || 15000 },
                { count: 2, rate: pricingConfig.ps5Rate2PlayersPaise || 30000 },
                { count: 3, rate: pricingConfig.ps5Rate3PlayersPaise || 40000 },
                { count: 4, rate: pricingConfig.ps5Rate4PlayersPaise || 50000 },
              ].map((opt) => {
                const isSelected = controllersCount === opt.count;
                return (
                  <button
                    key={opt.count}
                    type="button"
                    onClick={() => setControllersCount(opt.count)}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'border-red-600 bg-red-950/25 text-white ring-1 ring-red-600/50'
                        : 'bg-[#0e0e14] border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                    }`}
                  >
                    <p className="text-sm font-black font-mono">{opt.count}</p>
                    <p className="text-3xs font-mono text-zinc-400 mt-0.5">
                      {formatRupees(opt.rate)}/hr
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. Rate for this session Banner */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0e0e14] border border-zinc-800">
          <span className="text-xs text-zinc-400 font-medium">Rate for this session</span>
          <span className="text-base sm:text-lg font-black font-microgramma text-red-500 tracking-wide">
            {formatRupees(currentHourlyRatePaise)}/hour
          </span>
        </div>

        {/* 6. Manual Slot Start Time & Presets */}
        <div className="p-3 rounded-xl bg-[#0a0a0f] border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-red-500" />
              <span>Start Time / Slot</span>
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleSetTimeNow}
                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-3xs font-mono text-zinc-300 transition-colors"
                title="Current exact time"
              >
                Now
              </button>
              <button
                type="button"
                onClick={handleRoundToNextHour}
                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-3xs font-mono font-bold text-red-400 transition-colors"
                title="Round up to top of hour (e.g. 3:55 -> 4:00)"
              >
                :00 Slot
              </button>
              <button
                type="button"
                onClick={handleRoundToHalfHour}
                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-3xs font-mono text-zinc-300 transition-colors"
                title="Round to :30"
              >
                :30 Slot
              </button>
              <button
                type="button"
                onClick={() => handleAdjustMinutes(5)}
                className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-3xs font-mono text-zinc-300"
              >
                +5m
              </button>
              <button
                type="button"
                onClick={() => handleAdjustMinutes(-5)}
                className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-3xs font-mono text-zinc-300"
              >
                -5m
              </button>
            </div>
          </div>

          <input
            type="datetime-local"
            value={startTimeLocal}
            onChange={(e) => setStartTimeLocal(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-black border border-zinc-800 text-xs font-mono text-zinc-200 focus:border-red-500 outline-none"
          />

          {diffFromNowMinutes > 0 && (
            <p className="text-3xs font-mono text-red-400">
              *Scheduled slot starts in {diffFromNowMinutes} minutes (e.g. customer walked in early).
            </p>
          )}
          {diffFromNowMinutes < -5 && (
            <p className="text-3xs font-mono text-amber-400">
              *Started {Math.abs(diffFromNowMinutes)} minutes ago.
            </p>
          )}
        </div>

        {/* 7. Optional Details (Phone & Concessions) */}
        <div className="space-y-2">
          {/* Customer Phone (Optional) */}
          <div>
            <label className="block text-3xs uppercase font-mono text-zinc-400 mb-1">
              Customer Phone (Optional)
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-2 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#0a0a0f] border border-zinc-800 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:border-red-500 outline-none"
              />
            </div>
          </div>

          {/* Snacks & Drinks (Collapsible) */}
          <div className="p-2.5 rounded-xl bg-[#0a0a0f] border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsSnacksExpanded(!isSnacksExpanded)}
                className="flex items-center gap-2 text-xs font-medium text-zinc-300 hover:text-red-400 transition-colors"
              >
                <UtensilsCrossed className="w-3.5 h-3.5 text-red-500" />
                <span>Add Drinks & Snacks (Optional)</span>
                {totalSnackItemsCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-3xs font-bold font-mono">
                    {totalSnackItemsCount} items
                  </span>
                )}
                {isSnacksExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                )}
              </button>
              {snackTotalPaise > 0 && (
                <span className="text-xs font-mono font-bold text-red-400">
                  +{formatRupees(snackTotalPaise)}
                </span>
              )}
            </div>

            {isSnacksExpanded && (
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <input
                  type="text"
                  value={snackSearch}
                  onChange={(e) => setSnackSearch(e.target.value)}
                  placeholder="Search snacks..."
                  className="w-full px-2.5 py-1.5 rounded-lg bg-black border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none"
                />

                <div className="flex items-center gap-1 overflow-x-auto pb-1 text-2xs">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveSnackCategory(cat)}
                      className={`px-2 py-0.5 rounded transition-colors whitespace-nowrap ${
                        activeSnackCategory === cat
                          ? 'bg-red-600 text-white font-semibold'
                          : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
                  {filteredSnacks.map((snk) => {
                    const qty = selectedSnacks[snk.id] || 0;
                    const isOutOfStock = snk.stock !== undefined && snk.stock <= 0;
                    const isMaxReached = snk.stock !== undefined && qty >= snk.stock;

                    return (
                      <div
                        key={snk.id}
                        className={`p-2 rounded-lg border text-left flex flex-col justify-between ${
                          isOutOfStock
                            ? 'bg-black/60 border-zinc-900 opacity-60'
                            : qty > 0
                            ? 'bg-red-950/30 border-red-600/50'
                            : 'bg-black border-zinc-800'
                        }`}
                      >
                        <div>
                          <p className="text-2xs font-medium text-zinc-200 truncate">{snk.name}</p>
                          <span className="text-3xs font-mono text-zinc-400">
                            {formatRupees(snk.pricePaise)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1 pt-1 border-t border-zinc-800/60">
                          <button
                            type="button"
                            onClick={() => handleSnackQtyChange(snk.id, -1)}
                            disabled={qty === 0}
                            className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-30"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold font-mono text-white">{qty}</span>
                          <button
                            type="button"
                            onClick={() => handleSnackQtyChange(snk.id, 1)}
                            disabled={isOutOfStock || isMaxReached}
                            className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-30"
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
        </div>
      </div>
    </Modal>
  );
};
