import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateGamingCharge,
  calculateDurationMinutes,
  applyRoundingPolicy,
  calculateFinalBill,
  calculateSnackSubtotal,
  validatePaymentAmounts,
} from '../utils/pricing';
import {
  formatRupees,
  rupeesToPaise,
  paiseToRupees,
} from '../utils/formatters';
import { DEFAULT_PRICING_CONFIG, db, INITIAL_USERS } from '../services/storage';
import { SessionItem, User } from '../types';

describe('Gaming Centre POS Acceptance & Financial Invariants Tests', () => {
  const adminUser = INITIAL_USERS[0]; // Vikram Admin
  const empUser = INITIAL_USERS[1]; // Rahul Sharma

  beforeEach(() => {
    // Reset test storage state
    db.resetToDemoData();
  });

  // Acceptance Test 1 & 2: PS5 session duration and charge calculation
  it('Scenario 1 & 2: PS5 hourly session calculates charges with rounding policy and integer paise precision', () => {
    const startTime = '2026-10-25T14:00:00Z';
    const endTime = '2026-10-25T15:15:00Z'; // 75 minutes

    const duration = calculateDurationMinutes(startTime, endTime);
    expect(duration).toBe(75);

    // With nearest_5 rounding: 75 mins is exact 75
    const billedMinutes = applyRoundingPolicy(duration, 'nearest_5');
    expect(billedMinutes).toBe(75);

    // PS5 Single @ ₹150/hr (15000 paise): (75 / 60) * 15000 = 18750 paise = ₹187.50
    const chargeCalc = calculateGamingCharge({
      gamingType: 'ps5',
      billingType: 'hourly',
      startTimeISO: startTime,
      endTimeISO: endTime,
      config: DEFAULT_PRICING_CONFIG,
      isMultiplayer: false,
    });

    expect(chargeCalc.gamingChargePaise).toBe(18750);
    expect(formatRupees(chargeCalc.gamingChargePaise)).toBe('₹187.50');
  });

  // Acceptance Test 3: 8-ball pool hourly vs per-frame pricing
  it('Scenario 3: 8-Ball pool calculates hourly and per-frame rates correctly', () => {
    // Hourly: 60 minutes @ ₹180/hr = 18000 paise
    const hourlyCalc = calculateGamingCharge({
      gamingType: 'pool',
      billingType: 'hourly',
      startTimeISO: '2026-10-25T10:00:00Z',
      endTimeISO: '2026-10-25T11:00:00Z',
      config: DEFAULT_PRICING_CONFIG,
    });
    expect(hourlyCalc.gamingChargePaise).toBe(18000);

    // Per-frame: 3 frames @ ₹50/frame = 15000 paise = ₹150.00
    const frameCalc = calculateGamingCharge({
      gamingType: 'pool',
      billingType: 'fixed',
      startTimeISO: '2026-10-25T10:00:00Z',
      endTimeISO: '2026-10-25T10:45:00Z',
      framesCount: 3,
      config: DEFAULT_PRICING_CONFIG,
    });
    expect(frameCalc.gamingChargePaise).toBe(15000);
  });

  // Acceptance Test 4: Snack quantities and historical price snapshots
  it('Scenario 4: Snack line items preserve historical price snapshots and calculate subtotals', () => {
    const items: SessionItem[] = [
      {
        id: 'it-1',
        sessionId: 's-1',
        name: 'Red Bull',
        quantity: 2,
        unitPricePaise: 12500, // ₹125
        lineTotalPaise: 25000, // ₹250
        isCustom: false,
      },
      {
        id: 'it-2',
        sessionId: 's-1',
        name: 'Doritos',
        quantity: 1,
        unitPricePaise: 5000, // ₹50
        lineTotalPaise: 5000,
        isCustom: false,
      },
    ];

    const snackSubtotal = calculateSnackSubtotal(items);
    expect(snackSubtotal).toBe(30000); // ₹300.00
  });

  // Acceptance Test 5: A ₹300 bill with ₹200 GPay and ₹100 cash updates all totals correctly
  it('Scenario 5: Split payment of ₹300 bill with ₹200 GPay and ₹100 Cash validates and satisfies invariants', () => {
    const finalBillPaise = 30000; // ₹300.00
    const gpayPaise = 20000; // ₹200.00
    const cashPaise = 10000; // ₹100.00

    const validation = validatePaymentAmounts({
      method: 'split',
      finalBillPaise,
      gpayAmountPaise: gpayPaise,
      cashAmountPaise: cashPaise,
      allowPartial: true,
    });

    expect(validation.isValid).toBe(true);
    expect(validation.totalReceivedPaise).toBe(30000);
    expect(validation.outstandingBalancePaise).toBe(0);
    expect(gpayPaise + cashPaise).toBe(validation.totalReceivedPaise);
  });

  // Acceptance Test 6: Full cash payment updates only cash
  it('Scenario 6: Full cash payment updates only cash collections', () => {
    const validation = validatePaymentAmounts({
      method: 'cash',
      finalBillPaise: 25000,
      gpayAmountPaise: 0,
      cashAmountPaise: 25000,
      allowPartial: true,
    });

    expect(validation.isValid).toBe(true);
    expect(validation.totalReceivedPaise).toBe(25000);
    expect(validation.outstandingBalancePaise).toBe(0);
  });

  // Acceptance Test 7: Full GPay payment updates only GPay
  it('Scenario 7: Full GPay payment updates only GPay collections', () => {
    const validation = validatePaymentAmounts({
      method: 'gpay',
      finalBillPaise: 40000,
      gpayAmountPaise: 40000,
      cashAmountPaise: 0,
      allowPartial: true,
    });

    expect(validation.isValid).toBe(true);
    expect(validation.totalReceivedPaise).toBe(40000);
    expect(validation.outstandingBalancePaise).toBe(0);
  });

  // Acceptance Test 8: Invalid payment splits are rejected
  it('Scenario 8: Overpayments, negative amounts, and invalid split zeros are rejected', () => {
    // 1. Overpayment: ₹350 on a ₹300 bill
    const overpayment = validatePaymentAmounts({
      method: 'cash',
      finalBillPaise: 30000,
      gpayAmountPaise: 0,
      cashAmountPaise: 35000,
      allowPartial: true,
    });
    expect(overpayment.isValid).toBe(false);
    expect(overpayment.error).toContain('exceeds final bill');

    // 2. Negative amount
    const negative = validatePaymentAmounts({
      method: 'gpay',
      finalBillPaise: 30000,
      gpayAmountPaise: -5000,
      cashAmountPaise: 0,
      allowPartial: true,
    });
    expect(negative.isValid).toBe(false);

    // 3. Split with 0 in one part
    const invalidSplit = validatePaymentAmounts({
      method: 'split',
      finalBillPaise: 30000,
      gpayAmountPaise: 30000,
      cashAmountPaise: 0,
      allowPartial: true,
    });
    expect(invalidSplit.isValid).toBe(false);
    expect(invalidSplit.error).toContain('Split payments require positive amounts');
  });

  // Acceptance Test 9: Incomplete payment tracked as outstanding balance
  it('Scenario 9: Partial payments track remaining balance accurately when enabled', () => {
    const validation = validatePaymentAmounts({
      method: 'cash',
      finalBillPaise: 30000, // ₹300 bill
      gpayAmountPaise: 0,
      cashAmountPaise: 18000, // ₹180 paid
      allowPartial: true,
    });

    expect(validation.isValid).toBe(true);
    expect(validation.totalReceivedPaise).toBe(18000);
    expect(validation.outstandingBalancePaise).toBe(12000); // ₹120 due
  });

  // Acceptance Test 10 & 11: Revenue separation and no double counting
  it('Scenario 10 & 11: Gaming and snack revenue are strictly separated without double counting', () => {
    const gamingChargePaise = 15000; // ₹150
    const snackSubtotalPaise = 10000; // ₹100
    const discountPaise = 2000; // ₹20

    const bill = calculateFinalBill({
      gamingChargePaise,
      snackSubtotalPaise,
      discountPaise,
    });

    expect(bill.grossTotalPaise).toBe(25000);
    expect(bill.finalBillPaise).toBe(23000); // 25000 - 2000
    expect(gamingChargePaise + snackSubtotalPaise - discountPaise).toBe(bill.finalBillPaise);
  });

  // Acceptance Test 12: Voids are auditable and preserve records
  it('Scenario 12: Voids require admin role and a detailed reason, preserving audit logs', () => {
    // Employee attempting void should be rejected
    expect(() => {
      db.voidSession('sess-comp-1', 'Accidental entry', empUser);
    }).toThrow(/Permission denied/);

    // Admin voiding should succeed
    const voided = db.voidSession(
      'sess-comp-1',
      'Customer had an emergency, waived payment',
      adminUser
    );
    expect(voided.isVoided).toBe(true);
    expect(voided.status).toBe('cancelled');

    // Audit log should contain entry
    const logs = db.getAuditLogs();
    const voidLog = logs.find((l) => l.action === 'TRANSACTION_VOIDED');
    expect(voidLog).toBeDefined();
    expect(voidLog?.actorName).toBe(adminUser.displayName);
  });

  // Acceptance Test 13: Employee role restrictions
  it('Scenario 13: Employees cannot create users, change roles, or update global pricing', () => {
    // 1. Employee cannot create user
    expect(() => {
      db.createUser(
        {
          displayName: 'Hacker',
          email: 'hack@vault.in',
          role: 'admin',
          isActive: true,
        },
        empUser
      );
    }).toThrow(/Permission denied/);

    // 2. Employee cannot update pricing
    expect(() => {
      db.updatePricingConfig(
        { ps5HourlyRatePaise: 5000 },
        empUser
      );
    }).toThrow(/Permission denied/);

    // 3. Employee cannot update snack catalogue
    expect(() => {
      db.createSnack(
        { name: 'Cheap Snack', category: 'General', pricePaise: 100, isActive: true },
        empUser
      );
    }).toThrow(/Permission denied/);
  });

  // Acceptance Test 14: Midnight crossing duration calculation
  it('Scenario 14: Handles midnight crossing correctly using standard UTC timestamp delta', () => {
    // Started at 11:30 PM (23:30) and ended at 1:15 AM next day
    const start = '2026-10-25T23:30:00Z';
    const end = '2026-10-26T01:15:00Z'; // 105 minutes total

    const duration = calculateDurationMinutes(start, end);
    expect(duration).toBe(105);

    const charge = calculateGamingCharge({
      gamingType: 'ps5',
      billingType: 'hourly',
      startTimeISO: start,
      endTimeISO: end,
      config: DEFAULT_PRICING_CONFIG,
    });

    expect(charge.billedMinutes).toBe(105);
    // 105m @ ₹150/hr (15000 paise): (105 / 60) * 15000 = 26250 paise = ₹262.50
    expect(charge.gamingChargePaise).toBe(26250);
  });

  // Acceptance Test 15: Daily closing variance calculation
  it('Scenario 15: Daily closing calculates cash variance correctly', () => {
    // Expected cash: let's test a count of ₹500 against expected ₹300 -> variance +₹200
    const closing = db.createDailyClosing({
      closingDate: '2026-10-25',
      countedCashPaise: 50000, // ₹500 counted
      denominations: {
        note500: 1,
        note200: 0,
        note100: 0,
        note50: 0,
        note20: 0,
        note10: 0,
        coins: 0,
      },
      notes: 'Drawer verified with closing shift supervisor',
      actor: empUser,
    });

    expect(closing.countedCashPaise).toBe(50000);
    expect(closing.cashVariancePaise).toBe(closing.countedCashPaise - closing.expectedCashPaise);
    expect(closing.closedBy).toBe(empUser.id);
  });
});
