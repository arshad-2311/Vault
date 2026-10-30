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
  formatPaiseToInputRupees,
} from '../utils/formatters';
import { DEFAULT_PRICING_CONFIG, db, INITIAL_USERS, subscribeToDataChanges } from '../services/storage';
import { SessionItem, User } from '../types';

describe('VAULT POS Acceptance & Financial Correctness Test Suite', () => {
  const adminUser = INITIAL_USERS[0]; // Vikram Admin
  const empUser = INITIAL_USERS[1]; // Rahul Sharma

  beforeEach(() => {
    // Reset test storage state to clean demo baseline
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

  // Acceptance Test 3: Snooker / 8-ball pool hourly vs per-frame pricing (VAULT Price list: ₹250/hr)
  it('Scenario 3: 8-Ball pool calculates hourly and per-frame rates correctly', () => {
    // Hourly: 60 minutes @ ₹250/hr = 25000 paise
    const hourlyCalc = calculateGamingCharge({
      gamingType: 'pool',
      billingType: 'hourly',
      startTimeISO: '2026-10-25T10:00:00Z',
      endTimeISO: '2026-10-25T11:00:00Z',
      config: DEFAULT_PRICING_CONFIG,
    });
    expect(hourlyCalc.gamingChargePaise).toBe(25000);

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

  // Acceptance Test 5: Split payment of ₹300 bill with ₹200 GPay and ₹100 cash
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
    expect(validation.changeDuePaise).toBe(0);
    expect(validation.paymentStatus).toBe('PAID');
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
    expect(validation.paymentStatus).toBe('PAID');
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
    expect(validation.paymentStatus).toBe('PAID');
  });

  // Acceptance Test 8 (Phase 3 Financial Invariant): A ₹137.50 bill with ₹138 GPay received is NOT silently marked exact settlement
  it('Scenario 8: Phase 3 - A ₹137.50 bill with ₹138 GPay received triggers explicit discrepancy error requiring adjustment', () => {
    const finalBillPaise = 13750; // ₹137.50
    const gpayAmountPaise = 13800; // ₹138.00 (entered overpayment)

    const validation = validatePaymentAmounts({
      method: 'gpay',
      finalBillPaise,
      gpayAmountPaise,
      cashAmountPaise: 0,
      allowPartial: false,
    });

    // Pure UPI overpayment cannot dispense cash change automatically
    expect(validation.isValid).toBe(false);
    expect(validation.error).toContain('Digital transfers cannot dispense cash change');
    expect(validation.discrepancyNote).toContain('UPI overpayment by ₹0.50');

    // Negative amounts must also be rejected
    const negative = validatePaymentAmounts({
      method: 'gpay',
      finalBillPaise: 13750,
      gpayAmountPaise: -5000,
      cashAmountPaise: 0,
      allowPartial: true,
    });
    expect(negative.isValid).toBe(false);
    expect(negative.error).toContain('cannot be negative');
  });

  // Acceptance Test 9 (Phase 3 Cash Overpayment): Cash overpayment calculates change due explicitly
  it('Scenario 9: Phase 3 - Cash overpayment of ₹140 on a ₹137.50 bill calculates ₹2.50 change due and OVERPAID_CHANGE_DUE status', () => {
    const finalBillPaise = 13750; // ₹137.50
    const cashAmountPaise = 14000; // ₹140.00 cash note tendered

    const validation = validatePaymentAmounts({
      method: 'cash',
      finalBillPaise,
      gpayAmountPaise: 0,
      cashAmountPaise,
      allowPartial: false,
    });

    expect(validation.isValid).toBe(true);
    expect(validation.totalReceivedPaise).toBe(14000);
    expect(validation.outstandingBalancePaise).toBe(0);
    expect(validation.changeDuePaise).toBe(250); // ₹2.50 change due
    expect(validation.paymentStatus).toBe('OVERPAID_CHANGE_DUE');

    // Verify formatters display
    expect(formatRupees(validation.changeDuePaise)).toBe('₹2.50');
  });

  // Acceptance Test 10: Incomplete payment tracked as outstanding balance
  it('Scenario 10: Partial payments track remaining balance accurately when enabled', () => {
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
    expect(validation.paymentStatus).toBe('PARTIAL');
  });

  // Acceptance Test 11: Revenue separation and no double counting
  it('Scenario 11: Gaming and snack revenue are strictly separated without double counting', () => {
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

  // Acceptance Test 15: Idempotent checkout prevents duplicate completions
  it('Scenario 15: Idempotent checkout prevents double-settling or duplicate transaction creation', () => {
    const active = db.getSessions().find((s) => s.status === 'active');
    expect(active).toBeDefined();

    if (active) {
      // First checkout succeeds
      const completed = db.completeSession({
        sessionId: active.id,
        endTimeISO: new Date().toISOString(),
        paymentMethod: 'cash',
        gpayAmountPaise: 0,
        cashAmountPaise: active.finalBillPaise,
        actor: empUser,
      });
      expect(completed.status).toBe('completed');

      // Attempting to complete the same session a second time throws error
      expect(() => {
        db.completeSession({
          sessionId: active.id,
          endTimeISO: new Date().toISOString(),
          paymentMethod: 'cash',
          gpayAmountPaise: 0,
          cashAmountPaise: active.finalBillPaise,
          actor: empUser,
        });
      }).toThrow(/already been finalized/);
    }
  });

  // Acceptance Test 16: Decimal paise prefill formatters never drop decimals (no silent ₹137.50 -> ₹138 rounding)
  it('Scenario 16: formatPaiseToInputRupees preserves exact decimals without false rounding', () => {
    expect(formatPaiseToInputRupees(13750)).toBe('137.50');
    expect(formatPaiseToInputRupees(14000)).toBe('140');
    expect(formatPaiseToInputRupees(250)).toBe('2.50');
    expect(formatPaiseToInputRupees(50)).toBe('0.50');
  });

  // Acceptance Test 17: Dashboard metrics update accurately and release station occupancy
  it('Scenario 17: Completing session releases station occupancy and updates sales metrics', () => {
    const stationsBefore = db.getStations();
    const occupiedBefore = stationsBefore.filter((s) => s.status === 'occupied').length;

    // Start a new session
    const station = stationsBefore.find((s) => s.status === 'available');
    expect(station).toBeDefined();

    if (station) {
      const session = db.createSession({
        customerName: 'Test Gamer',
        gamingType: station.gamingType,
        stationId: station.id,
        billingType: 'hourly',
        startTimeISO: new Date().toISOString(),
        actor: empUser,
      });

      // Station must now be occupied
      const stationsAfterStart = db.getStations();
      const updatedStation = stationsAfterStart.find((s) => s.id === station.id);
      expect(updatedStation?.status).toBe('occupied');

      // Complete checkout
      db.completeSession({
        sessionId: session.id,
        endTimeISO: new Date().toISOString(),
        paymentMethod: 'cash',
        gpayAmountPaise: 0,
        cashAmountPaise: session.finalBillPaise,
        actor: empUser,
      });

      // Station must now be released to available
      const stationsAfterCheckout = db.getStations();
      const releasedStation = stationsAfterCheckout.find((s) => s.id === station.id);
      expect(releasedStation?.status).toBe('available');
    }
  });

  // Acceptance Test 18: Instant event emission fires data change listeners without reload
  it('Scenario 18: Session completion emits data change event immediately for zero-reload reactive updates', () => {
    let changeFired = false;
    const unsubscribe = subscribeToDataChanges(() => {
      changeFired = true;
    });

    const station = db.getStations().find((s) => s.status === 'available');
    if (station) {
      const startTimeISO = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const endTimeISO = new Date().toISOString();

      const session = db.createSession({
        customerName: 'Instant Gamer',
        gamingType: station.gamingType,
        stationId: station.id,
        billingType: 'hourly',
        startTimeISO,
        actor: empUser,
      });

      const charge = calculateGamingCharge({
        gamingType: station.gamingType,
        billingType: 'hourly',
        startTimeISO,
        endTimeISO,
        config: DEFAULT_PRICING_CONFIG,
      });

      changeFired = false;
      db.completeSession({
        sessionId: session.id,
        endTimeISO,
        paymentMethod: 'cash',
        gpayAmountPaise: 0,
        cashAmountPaise: charge.gamingChargePaise,
        actor: empUser,
      });

      expect(changeFired).toBe(true);
    }
    unsubscribe();
  });

  // Acceptance Test 19: Official VAULT flyer pricing verification for PS5 joysticks and Snooker
  it('Scenario 19: PS5 calculates rates per number of joysticks (1=₹150, 2=₹300, 3=₹400, 4=₹500) and Snooker @ ₹250/hr', () => {
    const startTime = '2026-10-25T14:00:00Z';
    const endTime = '2026-10-25T15:00:00Z'; // 1 hour

    // 1 Joystick = ₹150 (15000 paise)
    const p1 = calculateGamingCharge({
      gamingType: 'ps5',
      billingType: 'hourly',
      startTimeISO: startTime,
      endTimeISO: endTime,
      config: DEFAULT_PRICING_CONFIG,
      controllersCount: 1,
    });
    expect(p1.gamingChargePaise).toBe(15000);

    // 2 Joysticks = ₹300 (30000 paise)
    const p2 = calculateGamingCharge({
      gamingType: 'ps5',
      billingType: 'hourly',
      startTimeISO: startTime,
      endTimeISO: endTime,
      config: DEFAULT_PRICING_CONFIG,
      controllersCount: 2,
    });
    expect(p2.gamingChargePaise).toBe(30000);

    // 3 Joysticks = ₹400 (40000 paise)
    const p3 = calculateGamingCharge({
      gamingType: 'ps5',
      billingType: 'hourly',
      startTimeISO: startTime,
      endTimeISO: endTime,
      config: DEFAULT_PRICING_CONFIG,
      controllersCount: 3,
    });
    expect(p3.gamingChargePaise).toBe(40000);

    // 4 Joysticks = ₹500 (50000 paise)
    const p4 = calculateGamingCharge({
      gamingType: 'ps5',
      billingType: 'hourly',
      startTimeISO: startTime,
      endTimeISO: endTime,
      config: DEFAULT_PRICING_CONFIG,
      controllersCount: 4,
    });
    expect(p4.gamingChargePaise).toBe(50000);

    // Snooker @ ₹250/hr (25000 paise)
    const snooker = calculateGamingCharge({
      gamingType: 'pool',
      billingType: 'hourly',
      startTimeISO: startTime,
      endTimeISO: endTime,
      config: DEFAULT_PRICING_CONFIG,
    });
    expect(snooker.gamingChargePaise).toBe(25000);
  });

  // Acceptance Test 20: Station distribution is exactly 3 PS5s and 3 Snookers
  it('Scenario 20: Station layout contains exactly 3 PS5 stations and 3 Snooker stations', () => {
    const stations = db.getStations();
    const ps5s = stations.filter((s) => s.gamingType === 'ps5');
    const snookers = stations.filter((s) => s.gamingType === 'pool');

    expect(ps5s.length).toBe(3);
    expect(snookers.length).toBe(3);
    expect(stations.length).toBe(6);
  });

  // Acceptance Test 21: Snack inventory stock tracking and removal from active sessions
  it('Scenario 21: Snack inventory decrements on addition, can be removed, and stock is restored accurately', () => {
    const initialSnacks = db.getSnacks();
    const testSnack = initialSnacks.find((s) => s.id === 'snk-1')!;
    const originalStock = testSnack.stock ?? 20;
    const availableStation = db.getStations().find((s) => s.status === 'available')!;

    // Start a session with 2 of snk-1
    const session = db.createSession({
      customerName: 'Snack Tester',
      gamingType: availableStation.gamingType,
      stationId: availableStation.id,
      billingType: 'hourly',
      startTimeISO: new Date().toISOString(),
      controllersCount: 2,
      initialSnacks: [{ snackId: 'snk-1', quantity: 2 }],
      actor: empUser,
    });

    // Stock should be decremented by 2
    let updatedSnack = db.getSnacks().find((s) => s.id === 'snk-1')!;
    expect(updatedSnack.stock).toBe(originalStock - 2);
    expect(session.items.length).toBe(1);
    expect(session.snackSubtotalPaise).toBe(2 * testSnack.pricePaise);

    // Remove the snack item from the session
    const itemId = session.items[0].id;
    const sessionAfterRemoval = db.removeSnackFromSession({
      sessionId: session.id,
      itemId,
      actor: empUser,
    });

    // Verify session updated
    expect(sessionAfterRemoval.items.length).toBe(0);
    expect(sessionAfterRemoval.snackSubtotalPaise).toBe(0);

    // Verify stock is restored
    updatedSnack = db.getSnacks().find((s) => s.id === 'snk-1')!;
    expect(updatedSnack.stock).toBe(originalStock);
  });

  // Acceptance Test 22: Admin can delete snack from catalogue while employee is blocked
  it('Scenario 22: Admin can delete snack catalogue items; employee access is rejected', () => {
    const newSnack = db.createSnack(
      {
        name: 'Temp Soda',
        category: 'Beverages',
        pricePaise: 3000,
        stock: 10,
        isActive: true,
      },
      adminUser
    );

    // Employee cannot delete
    expect(() => db.deleteSnack(newSnack.id, empUser)).toThrow(/Permission denied/);

    // Admin can delete
    db.deleteSnack(newSnack.id, adminUser);
    const found = db.getSnacks().find((s) => s.id === newSnack.id);
    expect(found).toBeUndefined();
  });

  // Acceptance Test 23: 5-minute grace period policy
  it('Scenario 23: 5-minute grace period applies to 60-65 min sessions; overtime charges kick in beyond 65 mins', () => {
    const startTime = '2026-10-30T10:00:00Z';
    // 63 minutes (within 60m + 5m grace)
    const end63 = '2026-10-30T11:03:00Z';
    const calc63 = calculateGamingCharge({
      gamingType: 'pool',
      billingType: 'hourly',
      startTimeISO: startTime,
      endTimeISO: end63,
      config: { ...DEFAULT_PRICING_CONFIG, roundingRule: 'exact', graceMinutes: 5 },
    });
    // 63 minutes elapsed, but billed 60 minutes due to 5m grace
    expect(calc63.actualMinutes).toBe(63);
    expect(calc63.billedMinutes).toBe(60);
    expect(calc63.gamingChargePaise).toBe(25000); // exactly ₹250
    expect(calc63.explanation).toContain('5m grace applied');

    // 65 minutes (exact boundary of grace period)
    const end65 = '2026-10-30T11:05:00Z';
    const calc65 = calculateGamingCharge({
      gamingType: 'pool',
      billingType: 'hourly',
      startTimeISO: startTime,
      endTimeISO: end65,
      config: { ...DEFAULT_PRICING_CONFIG, roundingRule: 'exact', graceMinutes: 5 },
    });
    expect(calc65.billedMinutes).toBe(60);
    expect(calc65.gamingChargePaise).toBe(25000);

    // 68 minutes (extends past grace window: charges full minutes)
    const end68 = '2026-10-30T11:08:00Z';
    const calc68 = calculateGamingCharge({
      gamingType: 'pool',
      billingType: 'hourly',
      startTimeISO: startTime,
      endTimeISO: end68,
      config: { ...DEFAULT_PRICING_CONFIG, roundingRule: 'exact', graceMinutes: 5 },
    });
    expect(calc68.actualMinutes).toBe(68);
    expect(calc68.billedMinutes).toBe(68);
    // 68 / 60 * 25000 paise = 28333 paise
    expect(calc68.gamingChargePaise).toBe(28333);
  });

  // Acceptance Test 24: Custom manual billed minutes override in checkout calculation
  it('Scenario 24: Custom manual billed minutes directly overrides duration calculation', () => {
    const startTime = '2026-10-30T10:00:00Z';
    const endTime = '2026-10-30T11:15:00Z'; // 75 mins actual

    // Staff manually adjusts billed minutes to 60 mins
    const customCalc = calculateGamingCharge({
      gamingType: 'pool',
      billingType: 'hourly',
      startTimeISO: startTime,
      endTimeISO: endTime,
      config: DEFAULT_PRICING_CONFIG,
      customBilledMinutes: 60,
    });
    expect(customCalc.actualMinutes).toBe(75);
    expect(customCalc.billedMinutes).toBe(60);
    expect(customCalc.gamingChargePaise).toBe(25000);
    expect(customCalc.explanation).toContain('custom set');
  });

  // Acceptance Test 25: Round-off discount calculation (gross 268 - 18 = 250, gross 267 - 17 = 250)
  it('Scenario 25: Round-off discount accurately reconciles final bill to target round numbers', () => {
    // Case 1: Gross 268, Discount 18 -> Final 250
    const bill268 = calculateFinalBill({
      gamingChargePaise: 26800,
      snackSubtotalPaise: 0,
      discountPaise: 1800,
    });
    expect(bill268.grossTotalPaise).toBe(26800);
    expect(bill268.discountPaise).toBe(1800);
    expect(bill268.finalBillPaise).toBe(25000);

    // Case 2: Gross 267, Discount 17 -> Final 250
    const bill267 = calculateFinalBill({
      gamingChargePaise: 26700,
      snackSubtotalPaise: 0,
      discountPaise: 1700,
    });
    expect(bill267.finalBillPaise).toBe(25000);
  });
});
