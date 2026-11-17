import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../services/storage';
import {
  getBusinessDateString,
  getTodayDateString,
  getYesterdayDateString,
  getBusinessWeekRange,
  getBusinessMonthRange,
  getBusinessDateRangeUTC,
} from '../utils/formatters';
import { Session, User } from '../types';

describe('Reports & Multi-Device Settlement Sync Test Suite', () => {
  const admin: User = {
    id: 'usr-admin-1',
    email: 'admin@vault147.in',
    displayName: 'Ruwaidh (Admin)',
    role: 'admin',
    isActive: true,
    createdAt: '2026-11-01T00:00:00.000Z',
  };

  beforeEach(() => {
    db.resetToDemoData();
  });

  describe('IST 3:00 AM Business Cutoff Verification', () => {
    it('accurately associates sessions between 00:00:00 and 02:59:59 IST with previous business date', () => {
      // 15 Nov 2026, 8:00 PM IST (14:30 UTC) -> 15 Nov
      expect(getBusinessDateString('2026-11-15T14:30:00.000Z')).toBe('2026-11-15');

      // 16 Nov 2026, 01:30 AM IST (20:00 UTC on 15 Nov) -> 15 Nov night shift
      expect(getBusinessDateString('2026-11-15T20:00:00.000Z')).toBe('2026-11-15');

      // 16 Nov 2026, 02:59 AM IST (21:29 UTC on 15 Nov) -> 15 Nov night shift
      expect(getBusinessDateString('2026-11-15T21:29:00.000Z')).toBe('2026-11-15');

      // 16 Nov 2026, 03:00 AM IST sharp (21:30 UTC on 15 Nov) -> 16 Nov new business day
      expect(getBusinessDateString('2026-11-15T21:30:00.000Z')).toBe('2026-11-16');

      // 16 Nov 2026, 04:00 AM IST (22:30 UTC on 15 Nov) -> 16 Nov
      expect(getBusinessDateString('2026-11-15T22:30:00.000Z')).toBe('2026-11-16');
    });

    it('calculates the exact UTC bounding interval for 15 Nov 2026 business cycle', () => {
      const bounds = getBusinessDateRangeUTC('2026-11-15', '2026-11-15');
      // Starts 15 Nov 03:00 IST = 14 Nov 21:30 UTC
      expect(bounds.startISO).toBe('2026-11-14T21:30:00.000Z');
      // Ends 16 Nov 02:59:59.999 IST = 15 Nov 21:29:59.999 UTC
      expect(bounds.endISO).toBe('2026-11-15T21:29:59.999Z');
    });

    it('computes weekly and monthly ranges correctly', () => {
      const week = getBusinessWeekRange('2026-11-15');
      expect(week.start).toBe('2026-11-09');
      expect(week.end).toBe('2026-11-15');

      const month = getBusinessMonthRange('2026-11-15');
      expect(month.start).toBe('2026-11-01');
      expect(month.end).toBe('2026-11-30');
    });
  });

  describe('Multi-Device Report Consistency (Preventing the 25 vs 8 Session Discrepancy)', () => {
    it('reproduces and resolves the remote device report sync issue', () => {
      // 1. Simulate 25 sessions completed on Nov 15 on the counter PC
      const nov15Sessions: Session[] = Array.from({ length: 25 }, (_, i) => ({
        id: `sess-nov15-${i + 1}`,
        customerName: `Customer ${i + 1}`,
        gamingType: i % 2 === 0 ? 'ps5' : 'pool',
        stationId: `station-${(i % 5) + 1}`,
        stationName: `Station ${(i % 5) + 1}`,
        billingType: 'hourly',
        startTime: '2026-11-15T15:00:00.000Z',
        endTime: '2026-11-15T16:00:00.000Z',
        durationMinutes: 60,
        status: 'completed',
        rateSnapshot: { hourlyRatePaise: 20000, description: 'Standard PS5 Rate', roundingPolicy: 'exact' },
        gamingChargePaise: 40000,
        snackSubtotalPaise: 3040,
        discountPaise: 0,
        finalBillPaise: 43040, // 25 * 430.40 = ₹10,760 total
        createdBy: admin.id,
        createdByName: admin.displayName,
        createdAt: '2026-11-15T16:00:00.000Z',
        updatedAt: '2026-11-15T16:00:00.000Z',
        items: [],
        payment: {
          id: `pay-nov15-${i + 1}`,
          sessionId: `sess-nov15-${i + 1}`,
          method: i < 20 ? 'gpay' : 'cash',
          gpayAmountPaise: i < 20 ? 43040 : 0,
          cashAmountPaise: i >= 20 ? 43040 : 0,
          totalReceivedPaise: 43040,
          finalBillPaise: 43040,
          outstandingBalancePaise: 0,
          recordedBy: admin.id,
          recordedByName: admin.displayName,
          status: 'PAID',
          timestamp: '2026-11-15T16:00:00.000Z',
        },
      }));

      // Store device has all 25 sessions in localStorage
      db.syncWithRemoteSessions(nov15Sessions);
      const storeMetrics = db.calculateDashboardMetrics('2026-11-15', '2026-11-15');
      expect(storeMetrics.completedSessionsCount).toBe(25);
      expect(storeMetrics.totalSalesPaise).toBe(1076000); // ₹10,760

      // 2. Now simulate a mobile device (e.g. owner phone) opening with fresh storage
      db.resetToDemoData();

      // If mobile only received 8 sessions (old limit behavior):
      const partialRemoteSessions = nov15Sessions.slice(0, 8);
      db.syncWithRemoteSessions(partialRemoteSessions);
      const partialMetrics = db.calculateDashboardMetrics('2026-11-15', '2026-11-15');
      expect(partialMetrics.completedSessionsCount).toBe(8); // Matches client screenshot 2!

      // 3. Now with the date range sync, mobile fetches and merges all 25 sessions for 15 Nov:
      db.syncWithRemoteSessions(nov15Sessions);
      const syncedMetrics = db.calculateDashboardMetrics('2026-11-15', '2026-11-15');
      expect(syncedMetrics.completedSessionsCount).toBe(25);
      expect(syncedMetrics.totalSalesPaise).toBe(1076000); // ₹10,760 verified!
    });
  });
});
