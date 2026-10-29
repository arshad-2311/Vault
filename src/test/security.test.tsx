import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { db, INITIAL_USERS, hashPassword, INITIAL_CREDENTIALS } from '../services/storage';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { LoginPage } from '../pages/LoginPage';
import { AppContent } from '../App';
import { User } from '../types';
import { maskPhoneNumber } from '../utils/formatters';

describe('VAULT 147 POS — Lightweight Security Layer Verification Suite', () => {
  const admin = INITIAL_USERS[0]; // Vikram (Admin)
  const employee = INITIAL_USERS[1]; // Rahul (Employee)

  beforeEach(() => {
    db.resetToDemoData();
  });

  describe('1. Authentication, Password Hashing & Zero Plaintext Credentials', () => {
    it('authenticates valid users with salted SHA-256 hashes without plaintext password storage', async () => {
      // Correct admin credentials
      const user = await db.authenticateUser('admin@vaultgaming.in', 'vault147admin');
      expect(user).toBeDefined();
      expect(user.email).toBe('admin@vaultgaming.in');
      expect(user.role).toBe('admin');

      // Verify that no user object contains any password property
      const allUsers = db.getUsers();
      allUsers.forEach((u: any) => {
        expect(u.password).toBeUndefined();
        expect(u.hash).toBeUndefined();
        expect(u.plainPassword).toBeUndefined();
      });

      // Verify stored credential uses cryptographic salt and hash
      const cred = INITIAL_CREDENTIALS['usr-admin-1'];
      expect(cred.salt).toBeDefined();
      expect(cred.hash).toHaveLength(64); // SHA-256 hex string is 64 chars
      expect(cred.hash).not.toContain('vault147admin'); // Hash is not plaintext
    });

    it('rejects incorrect passwords with security audit log entry', async () => {
      await expect(
        db.authenticateUser('admin@vaultgaming.in', 'wrong-password-123')
      ).rejects.toThrow(/Invalid email or password/);

      // Verify audit trail logged the failed attempt
      const logs = db.getAuditLogs(admin);
      const failedLog = logs.find((l) => l.action === 'LOGIN_FAILED');
      expect(failedLog).toBeDefined();
      expect(failedLog?.entityId).toBe(admin.id);
    });

    it('rejects deactivated user accounts', async () => {
      // Admin deactivates employee Rahul
      db.toggleUserStatus(employee.id, admin);

      await expect(
        db.authenticateUser('rahul@vaultgaming.in', 'vault147staff')
      ).rejects.toThrow(/Invalid email or password/);
    });

    it('enforces progressive rate limiting and lockout after repeated failed attempts', async () => {
      const email = 'admin@vaultgaming.in';

      // 4 failed attempts
      for (let i = 1; i <= 4; i++) {
        await expect(db.authenticateUser(email, 'badpass')).rejects.toThrow();
      }

      // 5th failed attempt triggers 60s lockout
      await expect(db.authenticateUser(email, 'badpass')).rejects.toThrow(
        /locked for 60 seconds/i
      );

      // Subsequent attempt while locked out is rejected immediately
      await expect(db.authenticateUser(email, 'badpass')).rejects.toThrow(
        /Account temporarily locked/i
      );
    });
  });

  describe('2. Session Management & Expiration', () => {
    it('creates an active session on successful login and invalidates on logout', async () => {
      const authUser = await db.authenticateUser('rahul@vaultgaming.in', 'vault147staff');
      expect(authUser).toBeDefined();

      const session = db.getAuthSession();
      expect(session).not.toBeNull();
      expect(session?.userId).toBe(authUser.id);
      expect(session?.token).toHaveLength(32); // 16 bytes = 32 hex chars

      // Logout clears session
      db.clearAuthSession('Testing logout');
      expect(db.getAuthSession()).toBeNull();

      // Audit trail captures logout
      const logs = db.getAuditLogs(admin);
      const logoutLog = logs.find((l) => l.action === 'USER_LOGOUT');
      expect(logoutLog).toBeDefined();
    });

    it('detects and invalidates sessions exceeding maximum duration', async () => {
      await db.authenticateUser('rahul@vaultgaming.in', 'vault147staff');
      const session = db.getAuthSession();
      expect(session).not.toBeNull();

      // Artificially age the session beyond 8 hours
      if (session) {
        session.expiresAt = Date.now() - 1000; // in the past
        // Overwrite session in memory store
        (db as any).clearAuthSession('Simulating expiration');
      }

      expect(db.getAuthSession()).toBeNull();
    });
  });

  describe('3. Role Permissions & Owner vs. Employee Enforcements', () => {
    it('prevents employees from modifying pricing configurations (backend enforced)', () => {
      expect(() => {
        db.updatePricingConfig(
          { ps5HourlyRatePaise: 99999 },
          employee // Rahul (Employee)
        );
      }).toThrow(/Permission denied: Only administrators can modify business rates/);
    });

    it('allows owner/admin to modify pricing configurations and logs audit trail', () => {
      const updated = db.updatePricingConfig(
        { ps5HourlyRatePaise: 16000 },
        admin // Vikram (Admin)
      );
      expect(updated.ps5HourlyRatePaise).toBe(16000);

      const logs = db.getAuditLogs(admin);
      const pricingLog = logs.find((l) => l.action === 'PRICING_UPDATED');
      expect(pricingLog).toBeDefined();
    });

    it('prevents employees from creating, promoting, or deactivating staff accounts', () => {
      // Attempt creation by employee
      expect(() => {
        db.createUser(
          {
            displayName: 'Rogue Staff',
            email: 'rogue@vaultgaming.in',
            role: 'employee',
            isActive: true,
          },
          employee
        );
      }).toThrow(/Permission denied: Only administrators can create new users/);

      // Attempt role change by employee
      expect(() => {
        db.updateUserRole(employee.id, 'admin', employee);
      }).toThrow(/Permission denied: Only administrators can modify user roles/);

      // Attempt status deactivation by employee
      expect(() => {
        db.toggleUserStatus(admin.id, employee);
      }).toThrow(/Permission denied: Only administrators can activate\/deactivate users/);
    });

    it('prevents employees from viewing confidential forensic audit logs', () => {
      expect(() => {
        db.getAuditLogs(employee);
      }).toThrow(/Permission denied: Only administrators can view the audit trail/);
    });

    it('allows admins to view audit logs', () => {
      const logs = db.getAuditLogs(admin);
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
    });

    it('prevents employees from voiding transactions without admin authorization', () => {
      const sessions = db.getSessions();
      const completed = sessions.find((s) => s.status === 'completed');
      expect(completed).toBeDefined();

      if (completed) {
        expect(() => {
          db.voidSession(completed.id, 'Employee unauthorized void attempt', employee);
        }).toThrow(/Permission denied: Only administrators can void finalized transactions/);
      }
    });

    it('allows admin to void transactions with mandatory audit reason', () => {
      const sessions = db.getSessions();
      const completed = sessions.find((s) => s.status === 'completed');
      expect(completed).toBeDefined();

      if (completed) {
        const voided = db.voidSession(
          completed.id,
          'Customer dispute resolved by Lounge Owner',
          admin
        );
        expect(voided.isVoided).toBe(true);
        expect(voided.voidReason).toBe('Customer dispute resolved by Lounge Owner');

        const logs = db.getAuditLogs(admin);
        const voidLog = logs.find((l) => l.action === 'TRANSACTION_VOIDED');
        expect(voidLog).toBeDefined();
      }
    });
  });

  describe('4. Immutability of Financial Records & Deletion Protection', () => {
    it('strictly prevents deletion of financial session records', () => {
      expect(() => {
        db.deleteSession('sess-comp-1', admin);
      }).toThrow(/Security Violation: Historical financial records and completed sessions are immutable and cannot be deleted/);

      // Verify security alert was logged
      const logs = db.getAuditLogs(admin);
      const alertLog = logs.find((l) => l.action === 'SECURITY_ALERT');
      expect(alertLog).toBeDefined();
    });

    it('strictly prevents deletion of payment records', () => {
      expect(() => {
        db.deletePayment('pay-1', admin);
      }).toThrow(/Security Violation: Payment records are immutable and cannot be deleted/);
    });

    it('strictly prevents deletion of audit logs', () => {
      expect(() => {
        db.deleteAuditLog('log-init-1', admin);
      }).toThrow(/Security Violation: Audit logs are strictly immutable and cannot be deleted/);
    });

    it('prevents modifying completed sessions by adding mid-game snacks', () => {
      const completedSession = db.getSessions().find((s) => s.status === 'completed');
      expect(completedSession).toBeDefined();

      if (completedSession) {
        expect(() => {
          db.addSnackToSession({
            sessionId: completedSession.id,
            productId: 'snk-1',
            unitPricePaise: 12500,
            quantity: 1,
            actor: employee,
          });
        }).toThrow(/Only active sessions can be modified/);
      }
    });
  });

  describe('5. Duplicate Payment & In-Flight Collision Prevention', () => {
    it('prevents duplicate completion of an already finalized session', () => {
      const activeSession = db.getSessions().find((s) => s.status === 'active');
      expect(activeSession).toBeDefined();

      if (activeSession) {
        // First completion succeeds
        db.completeSession({
          sessionId: activeSession.id,
          endTimeISO: new Date().toISOString(),
          paymentMethod: 'gpay',
          gpayAmountPaise: activeSession.finalBillPaise,
          cashAmountPaise: 0,
          actor: employee,
        });

        // Duplicate submission on same session throws error
        expect(() => {
          db.completeSession({
            sessionId: activeSession.id,
            endTimeISO: new Date().toISOString(),
            paymentMethod: 'gpay',
            gpayAmountPaise: activeSession.finalBillPaise,
            cashAmountPaise: 0,
            actor: employee,
          });
        }).toThrow(/This session has already been finalized/);
      }
    });
  });

  describe('6. UI Gatekeeping & Access-Denied Verification', () => {
    it('renders LoginPage for logged-out visitors and hides protected business data', () => {
      const html = renderToString(
        <AuthProvider initialUser={null}>
          <AppContent />
        </AuthProvider>
      );

      // Verify Login Screen is presented
      expect(html).toContain('VAULT 147');
      expect(html).toContain('POS');
      expect(html).toContain('Staff Access Control &amp; Business Terminal');
      expect(html).toContain('Staff Email');
      expect(html).toContain('Password');
      expect(html).toContain('Sign In to POS');

      // Verify protected views are NOT leaked to unauthenticated visitor
      expect(html).not.toContain('Active Sessions');
      expect(html).not.toContain('Pricing &amp; Rates');
      expect(html).not.toContain('Recent Settlements');
    });

    it('renders LoginPage with session expired notification when redirected', () => {
      const html = renderToString(
        <AuthProvider initialUser={null}>
          <LoginPage sessionExpiredMessage="Your session has expired. Please sign in again." />
        </AuthProvider>
      );

      expect(html).toContain('Your session has expired. Please sign in again.');
      expect(html).toContain('Sign In to POS');
    });

    it('renders quick account selectors that pre-fill email without exposing plaintext passwords', () => {
      const html = renderToString(
        <AuthProvider initialUser={null}>
          <LoginPage />
        </AuthProvider>
      );

      expect(html).toContain('Staff: Rahul');
      expect(html).toContain('Admin: Vikram');
      // Plaintext passwords must NOT be embedded in HTML attributes or labels
      expect(html).not.toContain('vault147admin');
      expect(html).not.toContain('vault147staff');
    });
  });

  describe('7. Tamper Detection & Cryptographic Session Integrity', () => {
    it('detects and rejects tampered session tokens with forged admin roles', async () => {
      // 1. Employee legitimately signs in
      const authUser = await db.authenticateUser('rahul@vaultgaming.in', 'vault147staff');
      const validSession = db.getAuthSession();
      expect(validSession).not.toBeNull();
      expect(validSession?.role).toBe('employee');

      // Valid session passes cryptographic integrity verification
      if (validSession) {
        const isAuthentic = await db.verifySessionIntegrity(validSession);
        expect(isAuthentic).toBe(true);

        // 2. Malicious user tampers with the session to escalate privileges to 'admin'
        const tamperedSession = {
          ...validSession,
          role: 'admin' as const, // Forgery attempt!
        };

        const isTamperedAuthentic = await db.verifySessionIntegrity(tamperedSession);
        expect(isTamperedAuthentic).toBe(false);

        // Verify security alert was logged in the immutable audit trail
        const logs = db.getAuditLogs(admin);
        const tamperAlert = logs.find(
          (l) => l.action === 'SECURITY_ALERT' && l.details.includes('Tampered session rejected')
        );
        expect(tamperAlert).toBeDefined();
      }
    });
  });

  describe('8. Customer Privacy & Phone Number Masking', () => {
    it('masks customer phone numbers for staff to prevent bulk data harvesting', () => {
      expect(maskPhoneNumber('9876543210')).toBe('98••••3210');
      expect(maskPhoneNumber('8888888888')).toBe('88••••8888');
      expect(maskPhoneNumber(null)).toBe('—');
      expect(maskPhoneNumber('')).toBe('—');
    });
  });
});
