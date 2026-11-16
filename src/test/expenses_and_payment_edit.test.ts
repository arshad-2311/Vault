import { describe, it, expect, beforeEach } from 'vitest';
import { db, INITIAL_USERS } from '../services/storage';
import { getBusinessDateString } from '../utils/formatters';

describe('Admin Payment Modification & Daily Expenses Test Suite', () => {
  const admin = INITIAL_USERS[0]; // Ruwaidh Admin
  const employee = INITIAL_USERS[1]; // Staff

  beforeEach(() => {
    db.resetToDemoData();
  });

  describe('Admin Payment Editing (Transactions Page)', () => {
    it('allows an administrator to update a completed session payment to GPay', () => {
      const completedSession = db.getSessions().find((s) => s.status === 'completed' && s.payment);
      expect(completedSession).toBeDefined();

      const finalBill = completedSession!.finalBillPaise;
      const updated = db.updatePaymentDetails({
        sessionId: completedSession!.id,
        method: 'gpay',
        cashAmountPaise: 0,
        gpayAmountPaise: finalBill,
        notes: 'Customer transferred via GPay after leaving cash register',
        actor: admin,
      });

      expect(updated.payment?.method).toBe('gpay');
      expect(updated.payment?.gpayAmountPaise).toBe(finalBill);
      expect(updated.payment?.cashAmountPaise).toBe(0);
      expect(updated.payment?.notes).toContain('transferred via GPay');
    });

    it('allows an administrator to update payment to a Split breakdown', () => {
      const completedSession = db.getSessions().find((s) => s.status === 'completed' && s.payment);
      expect(completedSession).toBeDefined();

      const finalBill = completedSession!.finalBillPaise;
      const gpayPart = Math.floor(finalBill / 2);
      const cashPart = finalBill - gpayPart;

      const updated = db.updatePaymentDetails({
        sessionId: completedSession!.id,
        method: 'split',
        cashAmountPaise: cashPart,
        gpayAmountPaise: gpayPart,
        notes: 'Split payment verified by Admin',
        actor: admin,
      });

      expect(updated.payment?.method).toBe('split');
      expect(updated.payment?.cashAmountPaise).toBe(cashPart);
      expect(updated.payment?.gpayAmountPaise).toBe(gpayPart);
      expect(updated.payment?.totalReceivedPaise).toBe(finalBill);
    });

    it('rejects payment editing by non-admin employees with permission denied', () => {
      const completedSession = db.getSessions().find((s) => s.status === 'completed' && s.payment);
      expect(completedSession).toBeDefined();

      expect(() => {
        db.updatePaymentDetails({
          sessionId: completedSession!.id,
          method: 'cash',
          cashAmountPaise: completedSession!.finalBillPaise,
          gpayAmountPaise: 0,
          actor: employee,
        });
      }).toThrow(/Permission denied/);
    });

    it('rejects split amounts where total is less than final bill', () => {
      const completedSession = db.getSessions().find((s) => s.status === 'completed' && s.payment);
      expect(completedSession).toBeDefined();

      const finalBill = completedSession!.finalBillPaise;
      expect(() => {
        db.updatePaymentDetails({
          sessionId: completedSession!.id,
          method: 'split',
          cashAmountPaise: finalBill / 4,
          gpayAmountPaise: finalBill / 4, // Only half of the bill
          actor: admin,
        });
      }).toThrow(/cannot be less than/);
    });

    it('creates an audit log when payment breakdown is modified by admin', () => {
      const completedSession = db.getSessions().find((s) => s.status === 'completed' && s.payment);
      expect(completedSession).toBeDefined();

      db.updatePaymentDetails({
        sessionId: completedSession!.id,
        method: 'cash',
        cashAmountPaise: completedSession!.finalBillPaise,
        gpayAmountPaise: 0,
        notes: 'Switched to Cash with receipt check',
        actor: admin,
      });

      const logs = db.getAuditLogs();
      const paymentLog = logs.find((l) => l.action === 'PAYMENT_UPDATED' && l.actorId === admin.id);
      expect(paymentLog).toBeDefined();
      expect(paymentLog?.details).toContain('CASH');
    });

    it('allows an administrator to edit the total finalized bill amount of a completed session', () => {
      const completedSession = db.getSessions().find((s) => s.status === 'completed' && s.payment);
      expect(completedSession).toBeDefined();

      const newBillPaise = 75000; // ₹750
      const updated = db.updatePaymentDetails({
        sessionId: completedSession!.id,
        method: 'cash',
        cashAmountPaise: newBillPaise,
        gpayAmountPaise: 0,
        finalBillPaise: newBillPaise,
        notes: 'Adjusted bill amount manually as requested by customer',
        actor: admin,
      });

      expect(updated.finalBillPaise).toBe(newBillPaise);
      expect(updated.payment?.finalBillPaise).toBe(newBillPaise);
      expect(updated.payment?.cashAmountPaise).toBe(newBillPaise);
      expect(updated.payment?.totalReceivedPaise).toBe(newBillPaise);

      // Verify audit log has the new bill amount
      const logs = db.getAuditLogs();
      const billLog = logs.find((l) => l.action === 'PAYMENT_UPDATED' && l.details.includes('750'));
      expect(billLog).toBeDefined();
    });

    it('allows an administrator to add a manual finalized sales adjustment entry', () => {
      const initialMetrics = db.calculateDashboardMetrics('2026-11-10', '2026-11-10');
      const initialSales = initialMetrics.totalSalesPaise;

      const adjustment = db.createManualSalesAdjustment({
        date: '2026-11-10',
        amountPaise: 50000, // ₹500
        customerName: 'Private Tournament Fee',
        paymentMethod: 'gpay',
        notes: 'Offline tournament fee collected',
        actor: admin,
      });

      expect(adjustment.status).toBe('completed');
      expect(adjustment.finalBillPaise).toBe(50000);
      expect(adjustment.payment?.method).toBe('gpay');
      expect(adjustment.payment?.gpayAmountPaise).toBe(50000);

      // Verify dashboard / reports metrics reflect the adjusted sales
      const newMetrics = db.calculateDashboardMetrics('2026-11-10', '2026-11-10');
      expect(newMetrics.totalSalesPaise).toBe(initialSales + 50000);
      expect(newMetrics.gpayCollectionsPaise).toBe(initialMetrics.gpayCollectionsPaise + 50000);
    });
  });

  describe('Daily Expenses Management (Admin Only)', () => {
    it('allows an administrator to record a daily expense', () => {
      const expense = db.addExpense(
        {
          date: '2026-11-10',
          title: 'Red Bull 2 Cases Restock',
          category: 'Beverages & Snacks Restock',
          amountPaise: 600000, // ₹6,000
          paymentMethod: 'gpay',
          receiptNumber: 'INV-9901',
          notes: 'Purchased from Metro Cash & Carry',
        },
        admin
      );

      expect(expense.id).toBeDefined();
      expect(expense.title).toBe('Red Bull 2 Cases Restock');
      expect(expense.amountPaise).toBe(600000);
      expect(expense.paymentMethod).toBe('gpay');

      const all = db.getExpenses();
      expect(all.some((e) => e.id === expense.id)).toBe(true);
    });

    it('prevents non-admins from recording expenses', () => {
      expect(() => {
        db.addExpense(
          {
            date: '2026-11-10',
            title: 'Unauthorized expense',
            category: 'Miscellaneous',
            amountPaise: 50000,
            paymentMethod: 'cash',
          },
          employee
        );
      }).toThrow(/Permission denied/);
    });

    it('allows admin to update and delete an expense', () => {
      const expense = db.addExpense(
        {
          date: '2026-11-10',
          title: 'AC Service & Filter Clean',
          category: 'Equipment & Maintenance',
          amountPaise: 120000, // ₹1,200
          paymentMethod: 'cash',
        },
        admin
      );

      const updated = db.updateExpense(
        expense.id,
        {
          amountPaise: 150000, // ₹1,500 updated
          notes: 'Added extra coil cleaning',
        },
        admin
      );
      expect(updated.amountPaise).toBe(150000);
      expect(updated.notes).toBe('Added extra coil cleaning');

      // Delete
      db.deleteExpense(expense.id, admin);
      const afterDelete = db.getExpenses();
      expect(afterDelete.some((e) => e.id === expense.id)).toBe(false);
    });

    it('calculates expense metrics by date range accurately', () => {
      db.addExpense(
        {
          date: '2026-11-10',
          title: 'Cleaning supplies',
          category: 'Supplies & Groceries',
          amountPaise: 35000, // ₹350
          paymentMethod: 'cash',
        },
        admin
      );

      db.addExpense(
        {
          date: '2026-11-10',
          title: 'Internet Fiber Bill',
          category: 'Electricity & Utilities',
          amountPaise: 150000, // ₹1,500
          paymentMethod: 'gpay',
        },
        admin
      );

      const metrics = db.getExpenseMetrics('2026-11-10', '2026-11-10');
      expect(metrics.totalExpensesPaise).toBe(185000); // ₹1,850
      expect(metrics.cashExpensesPaise).toBe(35000); // ₹350
      expect(metrics.gpayExpensesPaise).toBe(150000); // ₹1,500
      expect(metrics.count).toBe(2);
    });

    it('allows editing an expense description, amount, category and notes', () => {
      const exp = db.addExpense(
        {
          date: '2026-11-12',
          title: 'Snooker Chalk Box',
          category: 'Equipment & Maintenance',
          amountPaise: 40000,
          paymentMethod: 'cash',
        },
        admin
      );

      const updated = db.updateExpense(
        exp.id,
        {
          title: 'Snooker Chalk Box (12 pcs)',
          amountPaise: 45000,
          category: 'Supplies & Groceries',
          notes: 'Price adjusted per receipt',
        },
        admin
      );

      expect(updated.title).toBe('Snooker Chalk Box (12 pcs)');
      expect(updated.amountPaise).toBe(45000);
      expect(updated.category).toBe('Supplies & Groceries');
      expect(updated.notes).toBe('Price adjusted per receipt');
    });

    it('implements 3:00 AM business day cutoff so late-night sales do not reset at 12:00 midnight', () => {
      // 11:30 PM on Nov 16 belongs to Nov 16
      const nightTime = new Date('2026-11-16T23:30:00');
      expect(getBusinessDateString(nightTime)).toBe('2026-11-16');

      // 1:45 AM on Nov 17 belongs to Nov 16's shift
      const pastMidnight = new Date('2026-11-17T01:45:00');
      expect(getBusinessDateString(pastMidnight)).toBe('2026-11-16');

      // 2:59 AM on Nov 17 STILL belongs to Nov 16's shift
      const justBefore3am = new Date('2026-11-17T02:59:59');
      expect(getBusinessDateString(justBefore3am)).toBe('2026-11-16');

      // 3:00 AM sharp on Nov 17 flips to Nov 17!
      const after3am = new Date('2026-11-17T03:00:00');
      expect(getBusinessDateString(after3am)).toBe('2026-11-17');
    });
  });
});

