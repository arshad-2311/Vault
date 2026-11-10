import { describe, it, expect, beforeEach } from 'vitest';
import { db, DEFAULT_PRICING_CONFIG, INITIAL_USERS } from '../services/storage';
import { calculateGamingCharge, calculateFinalBill, validatePaymentAmounts } from '../utils/pricing';
import { formatRupees, rupeesToPaise, maskPhoneNumber } from '../utils/formatters';
import { User, Session } from '../types';

describe('VAULT 147 POS — MASTER QUALITY ASSURANCE & END-TO-END AUDIT SUITE', () => {
  const adminActor: User = INITIAL_USERS[0]; // Ruwaidh (Admin)
  const employeeActor: User = INITIAL_USERS[1]; // Rahul Sharma (Employee)

  beforeEach(() => {
    // Reset to deterministic baseline before each test
    db.resetToDemoData();
  });

  // =========================================================================
  // SCENARIO 1: Standard PS5 Session with Snacks
  // =========================================================================
  describe('Scenario 1: Standard PS5 Session with Snacks', () => {
    it('executes a complete PS5 single-player session lifecycle with snacks and exact GPay settlement', () => {
      // 1. Check in customer for PS5 (Station 2 is initially available)
      const startTime = '2026-11-08T10:00:00.000Z';
      const ps5Station = db.getStations().find((s) => s.id === 'ps5-2')!;
      expect(ps5Station.status).toBe('available');

      const session = db.createSession({
        customerName: 'Aman Verma',
        customerPhone: '9876543210',
        gamingType: 'ps5',
        stationId: ps5Station.id,
        billingType: 'hourly',
        controllersCount: 1,
        startTimeISO: startTime,
        actor: employeeActor,
      });

      expect(session.id).toBeDefined();
      expect(session.status).toBe('active');
      expect(session.gamingType).toBe('ps5');

      // Verify station status shifted to occupied
      const occupiedStation = db.getStations().find((s) => s.id === ps5Station.id)!;
      expect(occupiedStation.status).toBe('occupied');
      expect(occupiedStation.activeSessionId).toBe(session.id);

      // 2. Add snacks mid-session (1x Miranda @ ₹20 = 2000 paise)
      const miranda = db.getSnacks().find((s) => s.id === 'snk-1')!;
      const initialStock = miranda.stock ?? 20;

      const sessionWithSnack = db.addSnackToSession({
        sessionId: session.id,
        productId: miranda.id,
        unitPricePaise: miranda.pricePaise,
        quantity: 1,
        actor: employeeActor,
      });

      expect(sessionWithSnack.items.length).toBe(1);
      expect(sessionWithSnack.snackSubtotalPaise).toBe(2000);

      // Verify stock was decremented
      const updatedMiranda = db.getSnacks().find((s) => s.id === miranda.id)!;
      expect(updatedMiranda.stock).toBe(initialStock - 1);

      // 3. Complete checkout after exactly 60 minutes
      const endTime = '2026-11-08T11:00:00.000Z'; // 60 mins @ ₹150/hr = ₹150 (15000 paise)
      const expectedGamingPaise = 15000;
      const expectedSnackPaise = 2000;
      const expectedTotalPaise = expectedGamingPaise + expectedSnackPaise; // 17000 paise = ₹170.00

      const finalized = db.completeSession({
        sessionId: session.id,
        endTimeISO: endTime,
        paymentMethod: 'gpay',
        gpayAmountPaise: expectedTotalPaise,
        cashAmountPaise: 0,
        actor: employeeActor,
      });

      expect(finalized.status).toBe('completed');
      expect(finalized.gamingChargePaise).toBe(expectedGamingPaise);
      expect(finalized.snackSubtotalPaise).toBe(expectedSnackPaise);
      expect(finalized.finalBillPaise).toBe(expectedTotalPaise);
      expect(finalized.payment?.method).toBe('gpay');
      expect(finalized.payment?.gpayAmountPaise).toBe(expectedTotalPaise);
      expect(finalized.payment?.cashAmountPaise).toBe(0);
      expect(finalized.payment?.status).toBe('PAID');

      // 4. Verify station returned to available
      const releasedStation = db.getStations().find((s) => s.id === ps5Station.id)!;
      expect(releasedStation.status).toBe('available');
      expect(releasedStation.activeSessionId).toBeNull();
    });
  });

  // =========================================================================
  // SCENARIO 2: 8-Ball Pool Extended Match with Split Payment
  // =========================================================================
  describe('Scenario 2: Extended 8-Ball Pool Match with Split Payment', () => {
    it('accurately calculates a 120-minute snooker session and settles via split GPay + Cash', () => {
      // Table 2 is initially available
      const poolStation = db.getStations().find((s) => s.id === 'pool-2')!;
      const startTime = '2026-11-08T14:00:00.000Z';
      const endTime = '2026-11-08T16:00:00.000Z'; // 120 mins @ ₹250/hr = ₹500 (50000 paise)

      const session = db.createSession({
        customerName: 'Karthik & Rohit',
        customerPhone: '9888877777',
        gamingType: 'pool',
        stationId: poolStation.id,
        billingType: 'hourly',
        startTimeISO: startTime,
        actor: employeeActor,
      });

      // Add 2x Mountain Dew (@ ₹20 = 2000 paise each)
      const mtnDew = db.getSnacks().find((s) => s.name.includes('Mountain Dew'))!;
      db.addSnackToSession({
        sessionId: session.id,
        productId: mtnDew.id,
        unitPricePaise: mtnDew.pricePaise,
        quantity: 2,
        actor: employeeActor,
      });

      const totalBillPaise = 50000 + 4000; // ₹540.00 = 54000 paise
      const gpaySplitPaise = 30000; // ₹300 GPay
      const cashSplitPaise = 24000; // ₹240 Cash

      const finalized = db.completeSession({
        sessionId: session.id,
        endTimeISO: endTime,
        paymentMethod: 'split',
        gpayAmountPaise: gpaySplitPaise,
        cashAmountPaise: cashSplitPaise,
        actor: employeeActor,
      });

      expect(finalized.finalBillPaise).toBe(54000);
      expect(finalized.payment?.status).toBe('PAID');
      expect(finalized.payment?.gpayAmountPaise).toBe(30000);
      expect(finalized.payment?.cashAmountPaise).toBe(24000);
      expect(finalized.payment?.totalReceivedPaise).toBe(54000);
      expect(finalized.payment?.outstandingBalancePaise).toBe(0);
    });
  });

  // =========================================================================
  // SCENARIO 3: Underpayment, Change Due & Invariant Enforcement
  // =========================================================================
  describe('Scenario 3: Underpayment, Change Due & Invariant Enforcement', () => {
    it('correctly calculates cash overpayment change due without silent loss', () => {
      const finalBillPaise = 35000; // ₹350.00
      const tenderedCashPaise = 50000; // ₹500.00 cash note

      const validation = validatePaymentAmounts({
        method: 'cash',
        finalBillPaise,
        gpayAmountPaise: 0,
        cashAmountPaise: tenderedCashPaise,
        allowPartial: false,
      });

      expect(validation.isValid).toBe(true);
      expect(validation.paymentStatus).toBe('OVERPAID_CHANGE_DUE');
      expect(validation.changeDuePaise).toBe(15000); // ₹150 change returned
      expect(validation.outstandingBalancePaise).toBe(0);
    });

    it('rejects underpayment when allowPartialPayments is false', () => {
      const finalBillPaise = 25000; // ₹250.00
      const receivedCashPaise = 20000; // ₹200.00 (underpaid)

      const validation = validatePaymentAmounts({
        method: 'cash',
        finalBillPaise,
        gpayAmountPaise: 0,
        cashAmountPaise: receivedCashPaise,
        allowPartial: false,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('Partial payments are not enabled');
      expect(validation.outstandingBalancePaise).toBe(5000);
    });

    it('blocks digital UPI overpayment from dispensing physical change', () => {
      const finalBillPaise = 15000; // ₹150.00
      const upiReceivedPaise = 20000; // ₹200.00 (overpayment via UPI)

      const validation = validatePaymentAmounts({
        method: 'gpay',
        finalBillPaise,
        gpayAmountPaise: upiReceivedPaise,
        cashAmountPaise: 0,
        allowPartial: false,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.error).toContain('Digital transfers cannot dispense cash change');
    });
  });

  // =========================================================================
  // SCENARIO 4: Pricing Updates & Historical Integrity
  // =========================================================================
  describe('Scenario 4: Pricing Updates & Historical Record Integrity', () => {
    it('preserves historical completed transaction pricing when admin updates business rates', () => {
      // 1. Create and complete a PS5 session under initial ₹150/hr rate
      const ps5Station = db.getStations().find((s) => s.id === 'ps5-2')!;
      const session1 = db.createSession({
        customerName: 'Historical Player',
        gamingType: 'ps5',
        stationId: ps5Station.id,
        billingType: 'hourly',
        startTimeISO: '2026-11-08T09:00:00.000Z',
        actor: adminActor,
      });

      const completedHistorical = db.completeSession({
        sessionId: session1.id,
        endTimeISO: '2026-11-08T10:00:00.000Z', // 60 mins @ ₹150/hr
        paymentMethod: 'cash',
        gpayAmountPaise: 0,
        cashAmountPaise: 15000,
        actor: adminActor,
      });

      expect(completedHistorical.gamingChargePaise).toBe(15000);

      // 2. Admin increases PS5 standard rate to ₹200/hr (20000 paise)
      db.updatePricingConfig(
        {
          ps5HourlyRatePaise: 20000,
          ps5Rate1PlayerPaise: 20000,
        },
        adminActor
      );

      // 3. Verify historical session is UNTOUCHED
      const retrievedOld = db.getSessionById(session1.id)!;
      expect(retrievedOld.gamingChargePaise).toBe(15000);
      expect(retrievedOld.finalBillPaise).toBe(15000);
      expect(retrievedOld.rateSnapshot.hourlyRatePaise).toBe(15000);

      // 4. Create new session under new rate and verify it uses ₹200/hr
      const session2 = db.createSession({
        customerName: 'New Rate Player',
        gamingType: 'ps5',
        stationId: ps5Station.id,
        billingType: 'hourly',
        startTimeISO: '2026-11-08T11:00:00.000Z',
        actor: adminActor,
      });

      const completedNew = db.completeSession({
        sessionId: session2.id,
        endTimeISO: '2026-11-08T12:00:00.000Z', // 60 mins @ ₹200/hr
        paymentMethod: 'cash',
        gpayAmountPaise: 0,
        cashAmountPaise: 20000,
        actor: adminActor,
      });

      expect(completedNew.gamingChargePaise).toBe(20000);
      expect(completedNew.finalBillPaise).toBe(20000);
    });
  });

  // =========================================================================
  // SCENARIO 5: Employee Security & Role Restrictions
  // =========================================================================
  describe('Scenario 5: Employee Security & Role Restrictions', () => {
    it('blocks non-admin employee from modifying pricing, snacks catalogue, staff, and voiding sessions', () => {
      // 1. Employee cannot update pricing
      expect(() => {
        db.updatePricingConfig({ ps5HourlyRatePaise: 99900 }, employeeActor);
      }).toThrow(/Permission denied.*administrators/i);

      // 2. Employee cannot create snack
      expect(() => {
        db.createSnack(
          {
            name: 'Unauthorized Snack',
            category: 'Beverages',
            pricePaise: 5000,
            isActive: true,
          },
          employeeActor
        );
      }).toThrow(/Permission denied.*administrators/i);

      // 3. Employee cannot delete snack
      const snack = db.getSnacks()[0];
      expect(() => {
        db.deleteSnack(snack.id, employeeActor);
      }).toThrow(/Permission denied.*administrators/i);

      // 4. Employee cannot update user roles
      expect(() => {
        db.updateUserRole(employeeActor.id, 'admin', employeeActor);
      }).toThrow(/Permission denied.*administrators/i);

      // 5. Employee cannot deactivate accounts
      expect(() => {
        db.toggleUserStatus(adminActor.id, employeeActor);
      }).toThrow(/Permission denied.*administrators/i);

      // 6. Employee cannot void finalized sessions
      const session = db.getSessions().find((s) => s.status === 'completed')!;
      expect(() => {
        db.voidSession(session.id, 'Employee unauthorized void', employeeActor);
      }).toThrow(/Permission denied.*administrators/i);
    });

    it('enforces maximum employee discount ceiling', () => {
      const ps5Station = db.getStations().find((s) => s.id === 'ps5-3')!;
      const session = db.createSession({
        customerName: 'Discount Customer',
        gamingType: 'ps5',
        stationId: ps5Station.id,
        billingType: 'hourly',
        startTimeISO: '2026-11-08T15:00:00.000Z',
        actor: employeeActor,
      });

      // Employee tries to apply ₹100 discount (limit is ₹50 = 5000 paise)
      expect(() => {
        db.completeSession({
          sessionId: session.id,
          endTimeISO: '2026-11-08T16:00:00.000Z',
          discountPaise: 10000, // ₹100 discount
          discountReason: 'Friend discount',
          paymentMethod: 'cash',
          gpayAmountPaise: 0,
          cashAmountPaise: 5000,
          actor: employeeActor,
        });
      }).toThrow(/Employee discount cannot exceed/i);
    });
  });

  // =========================================================================
  // SCENARIO 6: Concurrent Operations & Session Collision Prevention
  // =========================================================================
  describe('Scenario 6: Concurrent Operations & Session Collision Prevention', () => {
    it('prevents starting two sessions simultaneously on the same station', () => {
      const station = db.getStations().find((s) => s.id === 'ps5-2')!;

      // First check-in succeeds
      db.createSession({
        customerName: 'Customer A',
        gamingType: 'ps5',
        stationId: station.id,
        billingType: 'hourly',
        startTimeISO: '2026-11-08T10:00:00.000Z',
        actor: employeeActor,
      });

      // Second check-in on same station must be blocked
      expect(() => {
        db.createSession({
          customerName: 'Customer B',
          gamingType: 'ps5',
          stationId: station.id,
          billingType: 'hourly',
          startTimeISO: '2026-11-08T10:05:00.000Z',
          actor: employeeActor,
        });
      }).toThrow(/currently occupied/i);
    });

    it('prevents checking out a session that has already been finalized', () => {
      const station = db.getStations().find((s) => s.id === 'ps5-3')!;
      const session = db.createSession({
        customerName: 'Double Checkout Test',
        gamingType: 'ps5',
        stationId: station.id,
        billingType: 'hourly',
        startTimeISO: '2026-11-08T10:00:00.000Z',
        actor: employeeActor,
      });

      // Staff 1 finishes checkout
      db.completeSession({
        sessionId: session.id,
        endTimeISO: '2026-11-08T11:00:00.000Z',
        paymentMethod: 'cash',
        gpayAmountPaise: 0,
        cashAmountPaise: 15000,
        actor: employeeActor,
      });

      // Staff 2 attempts checkout on the same session
      expect(() => {
        db.completeSession({
          sessionId: session.id,
          endTimeISO: '2026-11-08T11:00:00.000Z',
          paymentMethod: 'cash',
          gpayAmountPaise: 0,
          cashAmountPaise: 15000,
          actor: employeeActor,
        });
      }).toThrow(/already been finalized/i);
    });
  });

  // =========================================================================
  // SCENARIO 7: Browser Refresh, Storage Resilience & Timestamp Integrity
  // =========================================================================
  describe('Scenario 7: Browser Refresh, Storage Resilience & Timestamp Integrity', () => {
    it('reliably calculates elapsed duration and bill from ISO timestamps independent of interval counters', () => {
      const fixedStart = new Date(Date.now() - 45 * 60 * 1000).toISOString(); // Exactly 45 mins ago
      const station = db.getStations().find((s) => s.id === 'pool-2')!;

      const session = db.createSession({
        customerName: 'Timestamp Recovery Test',
        gamingType: 'pool',
        stationId: station.id,
        billingType: 'hourly',
        startTimeISO: fixedStart,
        actor: employeeActor,
      });

      // Retrieve session from storage
      const loaded = db.getSessionById(session.id)!;
      expect(loaded.startTime).toBe(fixedStart);

      // Verify gaming charge calculation across simulated refresh
      const charge = calculateGamingCharge({
        gamingType: loaded.gamingType,
        billingType: loaded.billingType,
        startTimeISO: loaded.startTime,
        config: DEFAULT_PRICING_CONFIG,
      });

      // 45 minutes @ ₹250/hr (nearest_5 rounding = 45m) = (45/60)*25000 = 18750 paise = ₹187.50
      expect(charge.billedMinutes).toBe(45);
      expect(charge.gamingChargePaise).toBe(18750);
    });
  });

  // =========================================================================
  // SCENARIO 8: Full Business-Day Financial Reconciliation
  // =========================================================================
  describe('Scenario 8: Full Business-Day Financial Reconciliation', () => {
    it('fully reconciles total sales, net cash, GPay, change due, and daily drawer closing', () => {
      const today = new Date().toISOString().split('T')[0];

      // Session A: PS5 1-Player 1 hr (₹150) paid in cash note ₹200 (Change due ₹50)
      const st1 = db.getStations().find((s) => s.id === 'ps5-2')!;
      const sessA = db.createSession({
        customerName: 'Player A',
        gamingType: 'ps5',
        stationId: st1.id,
        billingType: 'hourly',
        startTimeISO: `${today}T10:00:00.000Z`,
        actor: adminActor,
      });
      db.completeSession({
        sessionId: sessA.id,
        endTimeISO: `${today}T11:00:00.000Z`,
        paymentMethod: 'cash',
        gpayAmountPaise: 0,
        cashAmountPaise: 20000, // Tendered ₹200
        actor: adminActor,
      });

      // Session B: Snooker 1 hr (₹250) + 1 Miranda (₹20) = ₹270 paid in GPay
      const st2 = db.getStations().find((s) => s.id === 'pool-2')!;
      const mirandaItem = db.getSnacks().find((s) => s.id === 'snk-1')!;
      const sessB = db.createSession({
        customerName: 'Player B',
        gamingType: 'pool',
        stationId: st2.id,
        billingType: 'hourly',
        startTimeISO: `${today}T12:00:00.000Z`,
        actor: adminActor,
      });
      db.addSnackToSession({
        sessionId: sessB.id,
        productId: mirandaItem.id,
        unitPricePaise: mirandaItem.pricePaise,
        quantity: 1,
        actor: adminActor,
      });
      db.completeSession({
        sessionId: sessB.id,
        endTimeISO: `${today}T13:00:00.000Z`,
        paymentMethod: 'gpay',
        gpayAmountPaise: 27000, // Exact ₹270 GPay
        cashAmountPaise: 0,
        actor: adminActor,
      });

      // Session C: Walk-in snacks: 2x Mountain Dew (@ ₹40 = ₹80) paid in cash ₹100 (Change due ₹20)
      const mtnDew = db.getSnacks().find((s) => s.name.includes('Mountain Dew'))!;
      db.createWalkInSnackSale({
        customerName: 'Walk-in C',
        items: [{ snackId: mtnDew.id, quantity: 2 }],
        paymentMethod: 'cash',
        gpayAmountPaise: 0,
        cashAmountPaise: 10000, // Tendered ₹100
        actor: adminActor,
      });

      // Calculate Metrics for today
      const metrics = db.calculateDashboardMetrics(today, today);

      // Expected Values:
      // Invariant check: Total GPay + Net Cash + Outstanding MUST equal Total Sales!
      expect(metrics.gpayCollectionsPaise + metrics.cashCollectionsPaise + metrics.outstandingBalancePaise).toBe(
        metrics.totalSalesPaise
      );

      // Verify Daily Cash Closing drawer calculation matches expected cash
      const closing = db.createDailyClosing({
        closingDate: today,
        countedCashPaise: metrics.cashCollectionsPaise, // Counted exact net cash in drawer
        denominations: {
          note500: 0,
          note200: Math.floor((metrics.cashCollectionsPaise / 100) / 200),
          note100: 0,
          note50: 0,
          note20: 0,
          note10: 0,
          coins: 0,
        },
        actor: adminActor,
      });

      expect(closing.expectedCashPaise).toBe(metrics.cashCollectionsPaise);
      expect(closing.countedCashPaise).toBe(metrics.cashCollectionsPaise);
      expect(closing.cashVariancePaise).toBe(0); // Zero cash discrepancy!
    });
  });

  // =========================================================================
  // INVENTORY & VOID AUDITING
  // =========================================================================
  describe('Inventory Auditing & Void Stock Restoration', () => {
    it('restores stock when a session with snacks is voided by administrator', () => {
      const testSnack = db.getSnacks()[1]; // Pepsi
      const initialStock = testSnack.stock ?? 20;

      // Create a walk-in snack sale for 3x Pepsi
      const sale = db.createWalkInSnackSale({
        customerName: 'Void Stock Test',
        items: [{ snackId: testSnack.id, quantity: 3 }],
        paymentMethod: 'cash',
        gpayAmountPaise: 0,
        cashAmountPaise: testSnack.pricePaise * 3,
        actor: adminActor,
      });

      // Stock should have decreased by 3
      const stockAfterSale = db.getSnacks().find((s) => s.id === testSnack.id)!.stock;
      expect(stockAfterSale).toBe(initialStock - 3);

      // Admin voids transaction
      db.voidSession(sale.id, 'Customer cancelled order before takeaway', adminActor);

      // Stock should be restored back to initial level
      const stockAfterVoid = db.getSnacks().find((s) => s.id === testSnack.id)!.stock;
      expect(stockAfterVoid).toBe(initialStock);
    });
  });

  // =========================================================================
  // PRIVACY & AUDIT LOG COMPLIANCE
  // =========================================================================
  describe('Privacy & Audit Log Compliance', () => {
    it('masks phone numbers in CSV export for non-admin staff and shows full phone for admin', () => {
      const sessions = db.getSessions();
      const adminCSV = db.exportSessionsToCSV(sessions, adminActor);
      const employeeCSV = db.exportSessionsToCSV(sessions, employeeActor);

      // Admin CSV contains full phone number
      expect(adminCSV).toContain('9876543210');

      // Employee CSV masks phone number
      expect(employeeCSV).toContain('98••••3210');
      expect(employeeCSV).not.toContain('9876543210');
    });

    it('enforces append-only immutable audit trail preventing deletions', () => {
      expect(() => {
        db.deleteAuditLog('any-id', adminActor);
      }).toThrow(/strictly immutable and cannot be deleted/i);
    });
  });
});
