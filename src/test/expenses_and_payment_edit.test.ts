import { describe, it, expect, beforeEach } from 'vitest';
import { db, INITIAL_USERS } from '../services/storage';

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
  });
});
