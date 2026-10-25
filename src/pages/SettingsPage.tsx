import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Gamepad2,
  CircleDot,
  Clock,
  Shield,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { PricingConfig, FixedPricingPlan } from '../types';
import { Button } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/storage';
import { formatRupees, rupeesToPaise } from '../utils/formatters';

export const SettingsPage: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const [config, setConfig] = useState<PricingConfig>(() => db.getPricingConfig());

  // Form Fields in Rupees
  const [ps5HourlyRupees, setPs5HourlyRupees] = useState('150');
  const [ps5MultiplayerRupees, setPs5MultiplayerRupees] = useState('220');
  const [poolHourlyRupees, setPoolHourlyRupees] = useState('180');
  const [poolPerFrameRupees, setPoolPerFrameRupees] = useState('50');
  const [roundingRule, setRoundingRule] = useState<PricingConfig['roundingRule']>('nearest_5');
  const [allowCustomSnacks, setAllowCustomSnacks] = useState(true);
  const [allowPartialPayments, setAllowPartialPayments] = useState(true);
  const [maxEmployeeDiscountRupees, setMaxEmployeeDiscountRupees] = useState('50');
  const [businessName, setBusinessName] = useState('Vault Gaming Centre & Pool Lounge');
  const [businessTimezone, setBusinessTimezone] = useState('Asia/Kolkata');

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const current = db.getPricingConfig();
    setConfig(current);
    setPs5HourlyRupees((current.ps5HourlyRatePaise / 100).toString());
    setPs5MultiplayerRupees((current.ps5MultiplayerHourlyRatePaise / 100).toString());
    setPoolHourlyRupees((current.poolHourlyRatePaise / 100).toString());
    setPoolPerFrameRupees((current.poolPerFrameRatePaise / 100).toString());
    setRoundingRule(current.roundingRule);
    setAllowCustomSnacks(current.allowCustomSnacks);
    setAllowPartialPayments(current.allowPartialPayments);
    setMaxEmployeeDiscountRupees((current.maxEmployeeDiscountPaise / 100).toString());
    setBusinessName(current.businessName);
    setBusinessTimezone(current.businessTimezone);
  }, []);

  if (!isAdmin) {
    return (
      <div className="p-12 text-center rounded-xl border border-rose-900/40 bg-rose-950/20 max-w-lg mx-auto mt-10">
        <Lock className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-white">Access Denied: Administrator Only</h2>
        <p className="text-xs text-slate-400 mt-2">
          Pricing configurations, session rounding rules, and discount policies can only be adjusted
          by administrators.
        </p>
      </div>
    );
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const ps5RatePaise = rupeesToPaise(ps5HourlyRupees);
    const ps5MultiRatePaise = rupeesToPaise(ps5MultiplayerRupees);
    const poolRatePaise = rupeesToPaise(poolHourlyRupees);
    const poolFrameRatePaise = rupeesToPaise(poolPerFrameRupees);
    const maxDiscountPaise = rupeesToPaise(maxEmployeeDiscountRupees);

    if (ps5RatePaise <= 0 || poolRatePaise <= 0) {
      setError('Hourly rates must be greater than ₹0.');
      return;
    }

    try {
      const updated = db.updatePricingConfig(
        {
          businessName: businessName.trim(),
          businessTimezone: businessTimezone.trim(),
          ps5HourlyRatePaise: ps5RatePaise,
          ps5MultiplayerHourlyRatePaise: ps5MultiRatePaise,
          poolHourlyRatePaise: poolRatePaise,
          poolPerFrameRatePaise: poolFrameRatePaise,
          roundingRule,
          allowCustomSnacks,
          allowPartialPayments,
          maxEmployeeDiscountPaise: maxDiscountPaise,
        },
        currentUser
      );

      setConfig(updated);
      setSuccessMessage('Business pricing and rules successfully updated and audited!');
    } catch (err: any) {
      setError(err.message || 'Failed to update pricing settings.');
    }
  };

  const handleResetDemo = () => {
    if (
      window.confirm(
        'Warning: This will reset all demo sessions, transactions, and seed data to the clean initial demo state. Continue?'
      )
    ) {
      db.resetToDemoData();
      window.location.reload();
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-brand-400" />
            <span>Pricing & Business Rules</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure hourly rates, rounding policies, concession controls, and discounts.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleResetDemo}
          leftIcon={<RotateCcw className="w-3.5 h-3.5 text-amber-400" />}
          className="text-xs"
        >
          Reset Demo Data
        </Button>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 font-medium">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs flex items-center gap-2 font-medium">
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Business Profile */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <h3 className="text-sm font-semibold text-slate-200">Centre Profile</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Business Name
              </label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Business Timezone
              </label>
              <input
                type="text"
                required
                value={businessTimezone}
                onChange={(e) => setBusinessTimezone(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 focus:border-brand-500"
              />
            </div>
          </div>
        </div>

        {/* Section 2: PS5 Rates */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-slate-200">PlayStation 5 Rates</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                PS5 Single Player Rate (₹/hour)
              </label>
              <input
                type="number"
                required
                min="1"
                step="1"
                value={ps5HourlyRupees}
                onChange={(e) => setPs5HourlyRupees(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 focus:border-brand-500"
              />
              <p className="text-3xs text-slate-500 mt-1">Default: ₹150 / hr</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                PS5 Multiplayer (2-4 Players) Rate (₹/hour)
              </label>
              <input
                type="number"
                required
                min="1"
                step="1"
                value={ps5MultiplayerRupees}
                onChange={(e) => setPs5MultiplayerRupees(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 focus:border-brand-500"
              />
              <p className="text-3xs text-slate-500 mt-1">Default: ₹220 / hr</p>
            </div>
          </div>
        </div>

        {/* Section 3: 8-Ball Pool Rates */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <CircleDot className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-200">8-Ball Pool Rates</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Pool Hourly Rate (₹/hour)
              </label>
              <input
                type="number"
                required
                min="1"
                step="1"
                value={poolHourlyRupees}
                onChange={(e) => setPoolHourlyRupees(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 focus:border-brand-500"
              />
              <p className="text-3xs text-slate-500 mt-1">Default: ₹180 / hr</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Pool Per-Frame Rate (₹/frame)
              </label>
              <input
                type="number"
                required
                min="1"
                step="1"
                value={poolPerFrameRupees}
                onChange={(e) => setPoolPerFrameRupees(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 focus:border-brand-500"
              />
              <p className="text-3xs text-slate-500 mt-1">Default: ₹50 / frame</p>
            </div>
          </div>
        </div>

        {/* Section 4: Rounding Policy & Permission Controls */}
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-200">
              Session Rounding & Permission Safeguards
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Time Rounding Policy
              </label>
              <select
                value={roundingRule}
                onChange={(e) => setRoundingRule(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:border-brand-500"
              >
                <option value="nearest_5">Nearest 5 Minutes (Recommended)</option>
                <option value="exact">Exact Minute-by-Minute</option>
                <option value="nearest_15">Nearest 15 Minutes</option>
                <option value="ceiling_15">Round UP to Next 15 Minutes</option>
              </select>
              <p className="text-3xs text-slate-500 mt-1">
                Determines how raw elapsed minutes are rounded when calculating final charges.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Max Employee Discount Limit (₹)
              </label>
              <input
                type="number"
                required
                min="0"
                step="1"
                value={maxEmployeeDiscountRupees}
                onChange={(e) => setMaxEmployeeDiscountRupees(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 focus:border-brand-500"
              />
              <p className="text-3xs text-slate-500 mt-1">
                Discounts greater than this amount require Administrator permission.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={allowCustomSnacks}
                onChange={(e) => setAllowCustomSnacks(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-brand-600 focus:ring-brand-500"
              />
              <span>Allow employees to bill quick Custom Snacks (e.g. sandwiches, drinks not in catalogue)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={allowPartialPayments}
                onChange={(e) => setAllowPartialPayments(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-brand-600 focus:ring-brand-500"
              />
              <span>Allow Partial Payments (Tracks outstanding customer debt explicitly)</span>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end">
          <Button
            variant="primary"
            size="lg"
            type="submit"
            leftIcon={<Save className="w-4 h-4" />}
            className="font-semibold"
          >
            Save All Changes
          </Button>
        </div>
      </form>
    </div>
  );
};
