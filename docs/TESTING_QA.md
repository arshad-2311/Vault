# Testing & Quality Assurance: VAULT 147 POS

## 1. Quality Assurance Philosophy & Testing Framework

VAULT 147 POS maintains an exhaustive automated testing suite powered by **Vitest `^5.0.5`** running in a JSDOM environment. 

The test harness evaluates the application against:
- High-concurrency station check-ins and checkouts.
- Variable controller multi-player billing algorithms.
- Mixed-mode split payment reconciliation.
- Cryptographic PBKDF2 hashing and progressive lockout enforcement.
- Out-of-stock persistence across reboots.
- Customer privacy phone masking.
- Two-way Supabase cloud data merging.

---

## 2. Test Suite Inventory (109 Tests Passing)

```text
Test Files  7 passed (7)
     Tests  109 passed (109)
  Duration  ~3.5 seconds
```

| Suite File | Test Count | Category & Scope |
| :--- | :---: | :--- |
| [`src/test/acceptance.test.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/test/acceptance.test.ts) | 24 | Core acceptance scenarios, timer calculations, controller rates, split payments, inventory deductions. |
| [`src/test/backend_extended.test.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/test/backend_extended.test.ts) | 19 | Storage engine stress tests, state transitions, station occupancy, and daily closing calculations. |
| [`src/test/components_render.test.tsx`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/test/components_render.test.tsx) | 13 | React 19 UI component rendering, modal mounting, button variants, and badge color mappings. |
| [`src/test/expenses_and_payment_edit.test.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/test/expenses_and_payment_edit.test.ts) | 9 | Daily expense creation, updating, deletion, and post-checkout payment method editing with audit logs. |
| [`src/test/master_qa_audit.test.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/test/master_qa_audit.test.ts) | 15 | Master financial invariant audit, drawer reconciliation, cash change due, and session voiding. |
| [`src/test/security.test.tsx`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/test/security.test.tsx) | 23 | PBKDF2 password hashing, progressive rate limiting, 4-hour inactivity timeout, RBAC, and phone masking. |
| [`src/test/snack_and_pricing_cloud_sync.test.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/test/snack_and_pricing_cloud_sync.test.ts) | 6 | Snack catalogue persistence, zero-stock preservation across `init()`, and two-way Supabase cloud sync. |

---

## 3. Deep Dive into Critical Test Scenarios

### A. Zero-Stock Reversion Protection ([`snack_and_pricing_cloud_sync.test.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/test/snack_and_pricing_cloud_sync.test.ts))
Verifies that marking an item out of stock (`stock: 0`) remains permanently at 0 across multiple `db.init()` calls and does not reset to 50:
```ts
it('PERMANENTLY preserves out-of-stock items (stock: 0) without resetting to 50 on restart', () => {
  const snacks = db.getSnacks();
  const firstSnack = snacks[0];
  db.updateSnack(firstSnack.id, { stock: 0 }, admin);
  
  // Simulate system re-initialization (e.g. next morning reload)
  db.init();

  const afterMorningInit = db.getSnacks().find((s) => s.id === firstSnack.id);
  expect(afterMorningInit?.stock).toBe(0);
});
```

### B. Financial Invariant Enforcement ([`master_qa_audit.test.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/test/master_qa_audit.test.ts))
Verifies that at all times:
$$\text{Total GPay} + \text{Net Cash} + \text{Outstanding Balances} = \text{Total Sales}$$
And checks that the daily cash drawer denomination balancing yields zero variance.

### C. Progressive Rate-Limiting & Lockout ([`security.test.tsx`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/test/security.test.tsx))
Simulates 5 consecutive bad password attempts, verifies that the account locks for 60 seconds, and confirms that subsequent attempts are rejected before credential checks execute.

---

## 4. Regression Testing Checklist

Before deploying any changes, verify this 6-point checklist:

- [ ] **Run Full Test Suite**: `npm test` passes with 109 passing tests and 0 unhandled rejections.
- [ ] **Production Build Check**: `npm run build` compiles with 0 TypeScript or bundle errors.
- [ ] **Lint Cleanliness**: `npm run lint` completes with zero lint warnings.
- [ ] **Integer Paise Verification**: Ensure no floating-point arithmetic was introduced into pricing calculations.
- [ ] **RBAC Safeguard**: Confirm non-admin staff cannot view unmasked phone numbers or delete records.
- [ ] **Cloud Sync Parity**: Verify asynchronous Supabase methods handle network failures gracefully.

