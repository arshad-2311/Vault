# Coding Standards & Development Rules: VAULT 147 POS

This document codifies the engineering standards, patterns, and architectural rules required when contributing to or maintaining the VAULT 147 POS codebase.

---

## 1. The 10 Commandments of VAULT 147 POS Development

1. **INTEGER PAISE ALWAYS**: All monetary storage and arithmetic **MUST** use integer paise (`₹1 = 100 paise`). Never use floating-point numbers for currency calculations.
2. **ZERO HARDCODED RESETS**: Out-of-stock items (`stock: 0`) must never be programmatically reset to a positive number during initialization or reload.
3. **EVENT-DRIVEN LOCAL REACTIVITY**: Any mutative method in `storage.ts` must call `emitDataChanged()` so the UI reflects the change immediately.
4. **NON-BLOCKING CLOUD SYNCHRONIZATION**: All network calls to Supabase must be executed asynchronously inside `try/catch` blocks so network drops never block local POS operations.
5. **IMMUTABLE FINANCIAL RECORDS**: Completed payments, closed shifts, and audit logs are append-only. Never expose or execute destructive `DELETE` operations on finalized financial transactions.
6. **STRICT ENUM & CONTRACT USAGE**: Always import canonical types from `src/types/index.ts`. Do not define duplicate or loose ad-hoc types in components.
7. **CUSTOMER PRIVACY BY DEFAULT**: Mask phone numbers for non-admin actors using `maskPhoneNumber()`. Only unmask when `actor.role === 'admin'`.
8. **TIME VIA REAL UTC DELTAS**: Compute session durations using millisecond differences between ISO 8601 timestamps. Never use interval ticks (`setInterval`) to calculate billed durations.
9. **PROGRESSIVE RATE LIMITS**: Maintain password hashing via `window.crypto.subtle` (PBKDF2/SHA-256) and enforce progressive account lockouts.
10. **TEST VERIFICATION BEFORE COMMIT**: Every change must pass the entire 109-test Vitest suite with zero regressions.

---

## 2. Naming Conventions

| Entity | Pattern | Examples |
| :--- | :--- | :--- |
| **Component Files** | PascalCase `.tsx` | `StationCard.tsx`, `CheckoutModal.tsx`, `SnacksPage.tsx` |
| **Utility / Service Files** | camelCase `.ts` | `storage.ts`, `supabase.ts`, `pricing.ts`, `formatters.ts` |
| **Interfaces & Types** | PascalCase | `Session`, `SnackItem`, `PaymentRecord`, `PricingConfig` |
| **Enums & Union Types** | lowercase / camelCase | `user_role`, `gaming_type`, `payment_method` |
| **Functions & Methods** | camelCase | `createSession`, `calculateGamingCharge`, `maskPhoneNumber` |
| **Constants & Storage Keys** | UPPER_SNAKE_CASE | `STORAGE_KEYS`, `INITIAL_USERS`, `VAULT_DATA_CHANGED_EVENT` |
| **React Hooks** | camelCase with `use` prefix | `useAuth` |
| **Database Tables & Columns**| snake_case | `session_items`, `price_paise`, `gaming_charge_paise` |

---

## 3. Directory & Component Organization

- **Presentation / Container Split**:
  - `src/components/common/`: Domain-agnostic UI primitives (`Button`, `Badge`, `Modal`).
  - `src/components/pos/`: Domain-specific POS widgets (`CheckoutModal`, `AddSnackModal`, `StationCard`).
  - `src/pages/`: Full-page view controllers that bind to `db` and context.
- **Single Source of Business Logic**:
  - Calculation logic belongs in [`src/utils/pricing.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/utils/pricing.ts), never inside UI component click handlers.
  - State persistence logic belongs in [`src/services/storage.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/services/storage.ts).

---

## 4. Error Handling & Validation Patterns

### Synchronous Domain Validation
Throw standard descriptive errors when domain rules are violated:
```ts
if (actor.role !== 'admin') {
  throw new Error('Permission denied: Administrator credentials required.');
}
if (totalReceived < finalBill) {
  throw new Error(`Total payment (₹${paiseToRupees(totalReceived)}) cannot be less than final bill.`);
}
```

### Safe Storage Fallback
Always read from `safeStorage` to handle environments where `localStorage` is unavailable:
```ts
const raw = safeStorage.getItem(STORAGE_KEYS.SESSIONS);
return raw ? JSON.parse(raw) : [];
```

### Asynchronous Supabase Error Handling
Catch and log warnings without propagating network errors to the user:
```ts
try {
  const { error } = await supabase.from('products').upsert(payload);
  if (error) {
    logWarn('Could not sync snack to Supabase:', error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
} catch (err: any) {
  return { success: false, error: err.message };
}
```

---

## 5. Automated Linting & Verification

The project enforces clean code via **Oxlint**:

```bash
# Run static code analysis
npm run lint

# Run type checker & build test
npm run build
```

