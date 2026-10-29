import { describe, it, expect, beforeEach } from 'vitest';
import { db, DEFAULT_PRICING_CONFIG, INITIAL_USERS } from '../services/storage';
import {
  calculateDurationMinutes,
  applyRoundingPolicy,
  calculateGamingCharge,
  calculateFinalBill,
  validatePaymentAmounts,
} from '../utils/pricing';
import { formatRupees, formatDateTime, formatDateOnly, formatTimeOnly } from '../utils/formatters';

describe('Comprehensive Backend, Storage & Edge Case Test Suite', () => {
  const admin = INITIAL_USERS[0]; // Vikram Admin
  const employee = INITIAL_USERS[1]; // Rahul Counter Staff

  beforeEach(() => {
    db.resetToDemoData();
  });

  describe('Station & Session Lifecycle Guardrails', () => {
    it('prevents starting a session on an already occupied station', () => {
      const stations = db.getStations();
      const occupiedStation = stations.find((s) => s.status === 'occupied');
      expect(occupiedStation).toBeDefined();

      if (occupiedStation) {
        expect(() => {
          db.createSession({
            customerName: 'Double Booking Attempt',
            gamingType: occupiedStation.gamingType,
            stationId: occupiedStation.id,
            billingType: 'hourly',
            startTimeISO: new Date().toISOString(),
            actor: employee,
          });
        }).toThrow(/currently occupied/);
      }
    });

    it('throws error when starting a session with a non-existent station ID', () => {
      expect(() => {
        db.createSession({
          customerName: 'Ghost Station Player',
          gamingType: 'ps5',
          stationId: 'station-does-not-exist',
          billingType: 'hourly',
          startTimeISO: new Date().toISOString(),
          actor: employee,
        });
      }).toThrow(/Station not found/);
    });

    it('correctly creates a session with initial snacks and captures price snapshots', () => {
      const stations = db.getStations();
      const available = stations.find((s) => s.status === 'available');
      expect(available).toBeDefined();

      const snacks = db.getSnacks();
      const snack1 = snacks[0]; // e.g. Red Bull

      const session = db.createSession({
        customerName: 'Snack Gamer',
        gamingType: available!.gamingType,
        stationId: available!.id,
        billingType: 'hourly',
        startTimeISO: new Date().toISOString(),
        initialSnacks: [{ snackId: snack1.id, quantity: 2 }],
        actor: employee,
      });

      expect(session.items.length).toBe(1);
      expect(session.items[0].quantity).toBe(2);
      expect(session.items[0].unitPricePaise).toBe(snack1.pricePaise);
      expect(session.items[0].lineTotalPaise).toBe(snack1.pricePaise * 2);
      expect(session.snackSubtotalPaise).toBe(snack1.pricePaise * 2);

      // Now change the snack price in the catalog
      db.updateSnack(snack1.id, { pricePaise: snack1.pricePaise + 5000 }, admin);

      // Historical session item price snapshot must NOT change
      const reloadedSession = db.getSessionById(session.id);
      expect(reloadedSession?.items[0].unitPricePaise).toBe(snack1.pricePaise);
    });

    it('allows adding mid-session custom off-menu snacks', () => {
      const activeSession = db.getSessions().find((s) => s.status === 'active');
      expect(activeSession).toBeDefined();

      const initialSubtotal = activeSession!.snackSubtotalPaise;
      const customPrice = 8500; // ₹85.00
      const quantity = 3;

      const updated = db.addSnackToSession({
        sessionId: activeSession!.id,
        customName: 'Grilled Club Sandwich',
        unitPricePaise: customPrice,
        quantity,
        actor: employee,
      });

      expect(updated.snackSubtotalPaise).toBe(initialSubtotal + customPrice * quantity);
      const addedItem = updated.items.find((it) => it.name === 'Grilled Club Sandwich');
      expect(addedItem).toBeDefined();
      expect(addedItem?.isCustom).toBe(true);
      expect(addedItem?.lineTotalPaise).toBe(25500);
    });

    it('prevents non-admins from modifying snacks on completed sessions', () => {
      const completedSession = db.getSessions().find((s) => s.status === 'completed');
      expect(completedSession).toBeDefined();

      expect(() => {
        db.addSnackToSession({
          sessionId: completedSession!.id,
          customName: 'Late Snack',
          unitPricePaise: 2000,
          quantity: 1,
          actor: employee, // Employee unauthorized
        });
      }).toThrow(/Only active sessions can be modified/);
    });
  });

  describe('Financial Security & Discount Rule Enforcement', () => {
    it('strictly restricts employee discounts to max allowed limit (₹50)', () => {
      const active = db.getSessions().find((s) => s.status === 'active');
      expect(active).toBeDefined();

      const config = db.getPricingConfig();
      expect(config.maxEmployeeDiscountPaise).toBe(5000); // ₹50

      // Employee attempting discount of ₹60 (6000 paise) must be rejected
      expect(() => {
        db.completeSession({
          sessionId: active!.id,
          endTimeISO: new Date().toISOString(),
          discountPaise: 6000,
          discountReason: 'Friend Discount',
          paymentMethod: 'cash',
          gpayAmountPaise: 0,
          cashAmountPaise: 10000,
          actor: employee,
        });
      }).toThrow(/Employee discount cannot exceed/);
    });

    it('permits administrators to grant discounts above employee limit', () => {
      const stations = db.getStations();
      const available = stations.find((s) => s.status === 'available');

      const session = db.createSession({
        customerName: 'VIP Customer',
        gamingType: available!.gamingType,
        stationId: available!.id,
        billingType: 'hourly',
        startTimeISO: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        actor: admin,
      });

      // Admin grants ₹100 discount (10000 paise)
      const completed = db.completeSession({
        sessionId: session.id,
        endTimeISO: new Date().toISOString(),
        discountPaise: 10000,
        discountReason: 'VIP Tournament Prize',
        paymentMethod: 'cash',
        gpayAmountPaise: 0,
        cashAmountPaise: Math.max(0, session.finalBillPaise - 10000),
        actor: admin,
      });

      expect(completed.discountPaise).toBe(10000);
      expect(completed.status).toBe('completed');
    });

    it('clamps discount so final bill never becomes negative', () => {
      const bill = calculateFinalBill({
        gamingChargePaise: 10000,
        snackSubtotalPaise: 5000,
        discountPaise: 25000, // Discount greater than total bill
      });

      expect(bill.grossTotalPaise).toBe(15000);
      expect(bill.discountPaise).toBe(15000);
      expect(bill.finalBillPaise).toBe(0); // Zero, never negative
    });
  });

  describe('Payment Validation Invariants', () => {
    it('rejects negative payment amounts for cash, gpay, or split', () => {
      const valGpay = validatePaymentAmounts({
        method: 'gpay',
        finalBillPaise: 10000,
        gpayAmountPaise: -500,
        cashAmountPaise: 0,
        allowPartial: true,
      });
      expect(valGpay.isValid).toBe(false);
      expect(valGpay.error).toContain('cannot be negative');

      const valCash = validatePaymentAmounts({
        method: 'cash',
        finalBillPaise: 10000,
        gpayAmountPaise: 0,
        cashAmountPaise: -1000,
        allowPartial: true,
      });
      expect(valCash.isValid).toBe(false);

      const valSplit = validatePaymentAmounts({
        method: 'split',
        finalBillPaise: 10000,
        gpayAmountPaise: 5000,
        cashAmountPaise: 0, // Split requires both > 0
        allowPartial: true,
      });
      expect(valSplit.isValid).toBe(false);
      expect(valSplit.error).toContain('Split payments require positive amounts');
    });

    it('rejects non-zero cash in pure GPay and non-zero GPay in pure Cash', () => {
      const valGpayWithCash = validatePaymentAmounts({
        method: 'gpay',
        finalBillPaise: 10000,
        gpayAmountPaise: 10000,
        cashAmountPaise: 2000,
        allowPartial: true,
      });
      expect(valGpayWithCash.isValid).toBe(false);
      expect(valGpayWithCash.error).toContain('Cash amount must be ₹0');

      const valCashWithGpay = validatePaymentAmounts({
        method: 'cash',
        finalBillPaise: 10000,
        gpayAmountPaise: 2000,
        cashAmountPaise: 10000,
        allowPartial: true,
      });
      expect(valCashWithGpay.isValid).toBe(false);
      expect(valCashWithGpay.error).toContain('GPay amount must be ₹0');
    });

    it('handles exact cash change calculation for split payment overage from cash note', () => {
      // Bill is ₹250 (25000 paise). Customer sends ₹150 GPay and gives a ₹200 cash note (Total ₹350 tendered)
      const val = validatePaymentAmounts({
        method: 'split',
        finalBillPaise: 25000,
        gpayAmountPaise: 15000,
        cashAmountPaise: 20000,
        allowPartial: true,
      });

      expect(val.isValid).toBe(true);
      expect(val.totalReceivedPaise).toBe(35000);
      expect(val.changeDuePaise).toBe(10000); // ₹100 cash change due
      expect(val.outstandingBalancePaise).toBe(0);
      expect(val.paymentStatus).toBe('OVERPAID_CHANGE_DUE');
    });
  });

  describe('Daily Cash Reconciliation & Drawer Integrity', () => {
    it('calculates expected cash, GPay, and cash variance accurately', () => {
      const today = new Date().toISOString().split('T')[0];

      const closing = db.createDailyClosing({
        closingDate: today,
        countedCashPaise: 30000,
        denominations: {
          note500: 0,
          note200: 1,
          note100: 1,
          note50: 0,
          note20: 0,
          note10: 0,
          coins: 0,
        },
        notes: 'End of shift test closing',
        actor: admin,
      });

      expect(closing.id).toBeDefined();
      expect(closing.closingDate).toBe(today);
      expect(closing.countedCashPaise).toBe(30000);
      expect(closing.cashVariancePaise).toBe(30000 - closing.expectedCashPaise);
      expect(closing.closedByName).toBe(admin.displayName);

      // Verify audit log
      const logs = db.getAuditLogs();
      const closingLog = logs.find((l) => l.action === 'DAILY_CASH_CLOSING');
      expect(closingLog).toBeDefined();
    });
  });

  describe('Auditing & Forensic Logging', () => {
    it('logs every security-sensitive action with actor details', () => {
      const initialLogsCount = db.getAuditLogs().length;

      // Update pricing config
      db.updatePricingConfig(
        { ps5HourlyRatePaise: 16000 },
        admin
      );

      const logsAfter = db.getAuditLogs();
      expect(logsAfter.length).toBeGreaterThan(initialLogsCount);
      const latest = logsAfter[0];
      expect(latest.action).toBe('PRICING_UPDATED');
      expect(latest.actorRole).toBe('admin');
      expect(latest.actorName).toBe(admin.displayName);
      expect(latest.previousState).toBeDefined();
      expect(latest.newState).toBeDefined();
    });

    it('requires void reasons of at least 5 characters', () => {
      expect(() => {
        db.voidSession('sess-comp-2', 'bad', admin);
      }).toThrow(/at least 5 characters/);
    });
  });

  describe('CSV Export Engine', () => {
    it('produces valid CSV format with escaped values and exact column headers', () => {
      const sessions = db.getSessions();
      const csv = db.exportSessionsToCSV(sessions);

      expect(csv).toContain('Session ID,Customer Name,Phone');
      expect(csv).toContain('Gaming Charge (INR),Snacks Subtotal (INR)');
      expect(csv).toContain('Final Bill (INR),Payment Method');

      // Verify lines count corresponds to header + sessions
      const lines = csv.trim().split('\n');
      expect(lines.length).toBe(sessions.length + 1);
    });
  });

  describe('User Administration Safeguards', () => {
    it('prevents an administrator from deactivating their own account', () => {
      expect(() => {
        db.toggleUserStatus(admin.id, admin);
      }).toThrow(/cannot deactivate your own account/);
    });

    it('prevents non-admins from creating or modifying users', () => {
      expect(() => {
        db.createUser(
          {
            displayName: 'Rogue Employee',
            email: 'rogue@vaultgaming.in',
            role: 'employee',
            isActive: true,
          },
          employee
        );
      }).toThrow(/Permission denied/);

      expect(() => {
        db.updateUserRole(admin.id, 'employee', employee);
      }).toThrow(/Permission denied/);
    });
  });

  describe('Rounding Policies Precision', () => {
    it('evaluates exact, nearest_5, nearest_15, and ceiling_15 rounding rules', () => {
      expect(applyRoundingPolicy(12, 'exact')).toBe(12);
      expect(applyRoundingPolicy(12, 'nearest_5')).toBe(10);
      expect(applyRoundingPolicy(13, 'nearest_5')).toBe(15);
      expect(applyRoundingPolicy(18, 'nearest_15')).toBe(15);
      expect(applyRoundingPolicy(23, 'nearest_15')).toBe(30);
      expect(applyRoundingPolicy(16, 'ceiling_15')).toBe(30);
      expect(applyRoundingPolicy(30, 'ceiling_15')).toBe(30);
      expect(applyRoundingPolicy(31, 'ceiling_15')).toBe(45);
    });

    it('ensures minimum billed minutes for zero or sub-minute durations', () => {
      expect(calculateDurationMinutes('2026-10-25T10:00:00Z', '2026-10-25T10:00:00Z')).toBe(1);
      expect(calculateDurationMinutes('2026-10-25T10:00:00Z', '2026-10-25T09:59:00Z')).toBe(1);
    });
  });
});
