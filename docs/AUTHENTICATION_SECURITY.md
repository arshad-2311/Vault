# Authentication & Security Architecture: VAULT 147 POS

## 1. Security Philosophy & Principles

As a point-of-sale and financial accounting system, VAULT 147 POS enforces five fundamental security mandates:

1. **Zero Plaintext Credentials**: Passwords and secrets are never stored in plaintext in local storage, memory heaps, or database columns.
2. **Deterministic Cryptographic Hashing**: Passwords use salted multi-round PBKDF2 with SHA-256 via the browser's standard Web Crypto API.
3. **Progressive Rate Limiting & Lockout**: Brute-force attacks against user accounts are mitigated by progressive lockouts that persist across page reloads.
4. **Strict Role-Based Access Control (RBAC)**: Non-admin staff cannot access administrative views, modify pricing, view audit trails, or delete/void records.
5. **Customer Privacy Protection**: Customer phone numbers are masked (`***-***-1234`) for non-admin operators in all user interfaces and exported CSV files.

---

## 2. Password Hashing & Cryptographic Storage

All user credentials in `storage.ts` use the browser's native `window.crypto.subtle` API.

### Cryptographic Algorithm:
```ts
async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    true,
    ['sign']
  );
  const exported = await crypto.subtle.exportKey('raw', key);
  return Array.from(new Uint8Array(exported))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

---

## 3. Progressive Rate Limiting & Account Lockout

To protect against automated dictionary attacks on the counter terminal:

1. Attempt counts are tracked per normalized email address in `safeStorage` under `vault_pos_rate_limits`.
2. **Threshold**: After 5 failed password attempts, the account is locked for **60 seconds** (`lockedUntil = Date.now() + 60000`).
3. **Persistence**: Because rate limit records reside in persistent storage, reloading the page, opening a new tab, or restarting the browser does not reset the lockout timer.
4. **UI Countdown**: When locked, [`LoginPage.tsx`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/pages/LoginPage.tsx) renders a prominent countdown badge showing the remaining seconds before attempts are permitted.

---

## 4. Session Management & Inactivity Timeouts

- **Session Token**: On successful login, `createAuthSessionForUser` generates a cryptographically random session token (`sec-session-...`) signed with a SHA-256 integrity hash.
- **Expiry Duration**: Standard session lifetime is **4 hours** (`SESSION_DURATION_MS = 4 * 60 * 60 * 1000`).
- **Sliding-Window Activity Extension**: Active cashier interactions (`mousedown`, `keydown`, `touchstart`, `scroll`) trigger `touchSessionActivity()`, extending the expiration timestamp as long as the counter is in active use.
- **Automated Revocation**: A 30-second interval timer monitors session expiration. If expired, `clearAuthSession('Session expired due to inactivity.')` is invoked and the user is redirected to the login gate.

---

## 5. Role-Based Access Control (RBAC) Permissions Matrix

| Feature / Operation | Administrator (`admin`) | Counter Staff (`employee`) | Enforcement Point |
| :--- | :---: | :---: | :--- |
| **Start Gaming Session** | Granted | Granted | `createSession` |
| **Add Snacks to Session** | Granted | Granted | `addSnackToSession` |
| **Walk-In Concessions Sale** | Granted | Granted | `createWalkInSnackSale` |
| **Finalize Bill & Settle** | Granted | Granted | `completeSession` |
| **Cash Overpayment Change** | Granted | Granted | `validatePaymentAmounts` |
| **Apply Discount ($\le$ ₹50)** | Granted | Granted | `completeSession` |
| **Apply Discount ($>$ ₹50)** | Granted | Denied | `maxEmployeeDiscountPaise` check |
| **Switch / Edit Payment Method**| Granted | Denied | `updatePaymentDetails` |
| **Void Gaming Session** | Granted | Denied | `voidSession` |
| **Modify Hourly / Fixed Rates**| Granted | Denied | `updatePricingConfig` |
| **Add / Edit / Delete Snacks** | Granted | Denied | `createSnack` / `updateSnack` |
| **Quick `+` / `-` Stock Buttons** | Granted | Denied | `SnacksPage.tsx` |
| **Record Daily Expense** | Granted | Denied | `addExpense` |
| **Execute Cash Closing Audit** | Granted | Granted | `CashClosingPage.tsx` |
| **Manage Staff Accounts** | Granted | Denied | `EmployeesPage.tsx` |
| **View Immutable Audit Logs** | Granted | Denied | `AuditLogPage.tsx` |
| **View Unmasked Phone Numbers** | Granted | Denied (Masked) | `maskPhoneNumber` |
| **Export Customer CSV Data** | Unmasked | Masked | `exportSessionsToCSV` |

---

## 6. Customer Privacy & Data Masking

Customer phone numbers are protected from unauthorized collection:

- In UI views (Active Sessions, Transactions, Customer Lists), non-admin users see masked strings: `***-***-1234`.
- In CSV exports, [`src/utils/formatters.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/utils/formatters.ts) masks phone numbers:
  ```ts
  export function maskPhoneNumber(phone?: string): string {
    if (!phone) return '—';
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 4) return '***';
    return `***-***-${clean.slice(-4)}`;
  }
  ```

---

## 7. Injection & Cross-Site Scripting (XSS) Defenses

1. **SQL Injection**: All cloud database queries execute through Supabase's prepared-statement PostgREST abstraction. No raw user strings are concatenated into dynamic SQL queries.
2. **Cross-Site Scripting (XSS)**: React 19's virtual DOM automatically escapes all expressions in JSX. No `dangerouslySetInnerHTML` is used in any component.
3. **Input Sanitization**: Numerical inputs are parsed with explicit radices and checked against `isNaN` and negative limits.
