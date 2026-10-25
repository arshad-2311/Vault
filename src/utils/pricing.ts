import { PricingConfig, GamingType, BillingType, SessionItem, FixedPricingPlan } from '../types';

export interface CalculationResult {
  actualMinutes: number;
  billedMinutes: number;
  gamingChargePaise: number;
  explanation: string;
}

/**
 * Calculates session duration between start and end timestamps.
 * Accurately handles midnight crossings via standard UTC millisecond delta.
 */
export function calculateDurationMinutes(startTimeISO: string, endTimeISO: string): number {
  const start = new Date(startTimeISO).getTime();
  const end = new Date(endTimeISO).getTime();
  const deltaMs = end - start;
  if (deltaMs <= 0) return 1; // Minimum 1 minute for non-zero time
  return Math.round(deltaMs / (1000 * 60));
}

/**
 * Applies business rounding policy to actual session minutes.
 */
export function applyRoundingPolicy(
  actualMinutes: number,
  rule: PricingConfig['roundingRule']
): number {
  if (actualMinutes <= 0) return 1;

  switch (rule) {
    case 'exact':
      return actualMinutes;
    case 'nearest_5':
      return Math.max(5, Math.round(actualMinutes / 5) * 5);
    case 'nearest_15':
      return Math.max(15, Math.round(actualMinutes / 15) * 15);
    case 'ceiling_15':
      return Math.max(15, Math.ceil(actualMinutes / 15) * 15);
    default:
      return actualMinutes;
  }
}

/**
 * Calculates the gaming charge in integer paise for a session.
 */
export function calculateGamingCharge(params: {
  gamingType: GamingType;
  billingType: BillingType;
  startTimeISO: string;
  endTimeISO?: string | null;
  config: PricingConfig;
  isMultiplayer?: boolean;
  fixedPlanId?: string;
  framesCount?: number;
}): CalculationResult {
  const {
    gamingType,
    billingType,
    startTimeISO,
    endTimeISO,
    config,
    isMultiplayer,
    fixedPlanId,
    framesCount,
  } = params;

  // Handle Fixed Billing Type
  if (billingType === 'fixed') {
    if (gamingType === 'ps5') {
      const plan = config.ps5FixedPlans.find((p) => p.id === fixedPlanId) || config.ps5FixedPlans[0];
      const actualMinutes = endTimeISO
        ? calculateDurationMinutes(startTimeISO, endTimeISO)
        : calculateDurationMinutes(startTimeISO, new Date().toISOString());

      return {
        actualMinutes,
        billedMinutes: plan ? plan.durationMinutes : 60,
        gamingChargePaise: plan ? plan.pricePaise : 14000,
        explanation: `Fixed Plan: ${plan ? plan.name : 'Standard'} (₹${((plan ? plan.pricePaise : 14000) / 100).toFixed(0)})`,
      };
    } else {
      // 8-Ball Pool per-frame billing
      const frames = Math.max(1, framesCount || 1);
      const charge = frames * config.poolPerFrameRatePaise;
      const actualMinutes = endTimeISO
        ? calculateDurationMinutes(startTimeISO, endTimeISO)
        : calculateDurationMinutes(startTimeISO, new Date().toISOString());

      return {
        actualMinutes,
        billedMinutes: actualMinutes,
        gamingChargePaise: charge,
        explanation: `${frames} frame(s) @ ₹${(config.poolPerFrameRatePaise / 100).toFixed(0)}/frame`,
      };
    }
  }

  // Handle Hourly Billing Type
  const endISO = endTimeISO || new Date().toISOString();
  const actualMinutes = calculateDurationMinutes(startTimeISO, endISO);
  const billedMinutes = applyRoundingPolicy(actualMinutes, config.roundingRule);

  let hourlyRatePaise = config.ps5HourlyRatePaise;
  let rateDescription = 'PS5 Standard';

  if (gamingType === 'ps5') {
    if (isMultiplayer) {
      hourlyRatePaise = config.ps5MultiplayerHourlyRatePaise;
      rateDescription = 'PS5 Multiplayer (2-4 Players)';
    } else {
      hourlyRatePaise = config.ps5HourlyRatePaise;
      rateDescription = 'PS5 Single Player';
    }
  } else {
    hourlyRatePaise = config.poolHourlyRatePaise;
    rateDescription = '8-Ball Pool Table';
  }

  // Exact paise calculation: (billedMinutes / 60) * hourlyRatePaise
  const gamingChargePaise = Math.round((billedMinutes / 60) * hourlyRatePaise);

  const rateRupees = (hourlyRatePaise / 100).toFixed(0);
  const explanation = `${rateDescription} (${billedMinutes}m billed @ ₹${rateRupees}/hr, rounded by ${config.roundingRule})`;

  return {
    actualMinutes,
    billedMinutes,
    gamingChargePaise,
    explanation,
  };
}

/**
 * Calculates snack subtotal strictly in integer paise.
 */
export function calculateSnackSubtotal(items: SessionItem[]): number {
  return items.reduce((sum, item) => sum + item.lineTotalPaise, 0);
}

/**
 * Calculates complete bill breakdown in integer paise.
 */
export function calculateFinalBill(params: {
  gamingChargePaise: number;
  snackSubtotalPaise: number;
  discountPaise?: number;
}): {
  grossTotalPaise: number;
  discountPaise: number;
  finalBillPaise: number;
} {
  const grossTotalPaise = params.gamingChargePaise + params.snackSubtotalPaise;
  const discountPaise = Math.max(0, Math.min(params.discountPaise || 0, grossTotalPaise));
  const finalBillPaise = Math.max(0, grossTotalPaise - discountPaise);

  return {
    grossTotalPaise,
    discountPaise,
    finalBillPaise,
  };
}

/**
 * Validates financial payment inputs with strict zero-loss checks and integer paise arithmetic.
 */
export interface PaymentValidationResult {
  isValid: boolean;
  error?: string;
  totalReceivedPaise: number;
  outstandingBalancePaise: number;
  changeDuePaise: number;
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERPAID_CHANGE_DUE';
  discrepancyNote?: string;
}

export function validatePaymentAmounts(params: {
  method: 'gpay' | 'cash' | 'split';
  finalBillPaise: number;
  gpayAmountPaise: number;
  cashAmountPaise: number;
  allowPartial: boolean;
}): PaymentValidationResult {
  const { method, finalBillPaise, gpayAmountPaise, cashAmountPaise, allowPartial } = params;

  if (gpayAmountPaise < 0 || cashAmountPaise < 0) {
    return {
      isValid: false,
      error: 'Payment amounts cannot be negative.',
      totalReceivedPaise: 0,
      outstandingBalancePaise: finalBillPaise,
      changeDuePaise: 0,
      paymentStatus: 'UNPAID',
    };
  }

  let totalReceived = 0;

  if (method === 'gpay') {
    totalReceived = gpayAmountPaise;
    if (cashAmountPaise !== 0) {
      return {
        isValid: false,
        error: 'Cash amount must be ₹0 when method is GPay only.',
        totalReceivedPaise: totalReceived,
        outstandingBalancePaise: Math.max(0, finalBillPaise - totalReceived),
        changeDuePaise: 0,
        paymentStatus: 'UNPAID',
      };
    }
  } else if (method === 'cash') {
    totalReceived = cashAmountPaise;
    if (gpayAmountPaise !== 0) {
      return {
        isValid: false,
        error: 'GPay amount must be ₹0 when method is Cash only.',
        totalReceivedPaise: totalReceived,
        outstandingBalancePaise: Math.max(0, finalBillPaise - totalReceived),
        changeDuePaise: 0,
        paymentStatus: 'UNPAID',
      };
    }
  } else if (method === 'split') {
    totalReceived = gpayAmountPaise + cashAmountPaise;
    if (gpayAmountPaise <= 0 || cashAmountPaise <= 0) {
      return {
        isValid: false,
        error: 'Split payments require positive amounts for both GPay and Cash.',
        totalReceivedPaise: totalReceived,
        outstandingBalancePaise: Math.max(0, finalBillPaise - totalReceived),
        changeDuePaise: 0,
        paymentStatus: 'UNPAID',
      };
    }
  }

  // 1. Zero payment
  if (totalReceived === 0 && finalBillPaise > 0) {
    if (!allowPartial) {
      return {
        isValid: false,
        error: 'Please enter payment amount.',
        totalReceivedPaise: 0,
        outstandingBalancePaise: finalBillPaise,
        changeDuePaise: 0,
        paymentStatus: 'UNPAID',
      };
    }
    return {
      isValid: true,
      totalReceivedPaise: 0,
      outstandingBalancePaise: finalBillPaise,
      changeDuePaise: 0,
      paymentStatus: 'UNPAID',
    };
  }

  // 2. Partial payment (total < bill)
  if (totalReceived < finalBillPaise) {
    const outstanding = finalBillPaise - totalReceived;
    if (!allowPartial) {
      return {
        isValid: false,
        error: `Partial payments are not enabled. Received ₹${(totalReceived / 100).toFixed(2)} does not match bill ₹${(finalBillPaise / 100).toFixed(2)}.`,
        totalReceivedPaise: totalReceived,
        outstandingBalancePaise: outstanding,
        changeDuePaise: 0,
        paymentStatus: 'PARTIAL',
      };
    }
    return {
      isValid: true,
      totalReceivedPaise: totalReceived,
      outstandingBalancePaise: outstanding,
      changeDuePaise: 0,
      paymentStatus: 'PARTIAL',
    };
  }

  // 3. Exact settlement
  if (totalReceived === finalBillPaise) {
    return {
      isValid: true,
      totalReceivedPaise: totalReceived,
      outstandingBalancePaise: 0,
      changeDuePaise: 0,
      paymentStatus: 'PAID',
    };
  }

  // 4. Overpayment (total > bill)
  const excessPaise = totalReceived - finalBillPaise;

  // Case 4A: Pure GPay overpayment (discrepancy that cannot dispense cash change automatically)
  if (method === 'gpay') {
    return {
      isValid: false,
      error: `GPay payment of ₹${(gpayAmountPaise / 100).toFixed(2)} exceeds bill of ₹${(finalBillPaise / 100).toFixed(2)} by ₹${(excessPaise / 100).toFixed(2)}. Digital transfers cannot dispense cash change without explicit manager adjustment.`,
      totalReceivedPaise: totalReceived,
      outstandingBalancePaise: 0,
      changeDuePaise: 0,
      paymentStatus: 'UNPAID',
      discrepancyNote: `UPI overpayment by ₹${(excessPaise / 100).toFixed(2)}`,
    };
  }

  // Case 4B: Split payment where GPay alone exceeds the entire bill
  if (method === 'split' && gpayAmountPaise > finalBillPaise) {
    return {
      isValid: false,
      error: `GPay portion (₹${(gpayAmountPaise / 100).toFixed(2)}) already exceeds final bill (₹${(finalBillPaise / 100).toFixed(2)}). Adjust GPay before splitting.`,
      totalReceivedPaise: totalReceived,
      outstandingBalancePaise: 0,
      changeDuePaise: 0,
      paymentStatus: 'UNPAID',
    };
  }

  // Case 4C: Cash overpayment (or split where excess is from physical cash tendered) -> Return Cash Change
  return {
    isValid: true,
    totalReceivedPaise: totalReceived,
    outstandingBalancePaise: 0,
    changeDuePaise: excessPaise,
    paymentStatus: 'OVERPAID_CHANGE_DUE',
    discrepancyNote: `Cash change due: ₹${(excessPaise / 100).toFixed(2)}`,
  };
}

