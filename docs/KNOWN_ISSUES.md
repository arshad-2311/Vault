# Known Issues & Technical Debt: VAULT 147 POS

This document provides a transparent engineering assessment of current architectural tradeoffs, technical debt, and potential edge cases within VAULT 147 POS.

---

## 1. Confirmed Technical Debt & Performance Considerations

### A. Single-Bundle Chunk Size (~747 kB Minified)
- **Observation**: During `npm run build`, Vite outputs:
  ```text
  dist/assets/index-BbzU8kA0.js   747.75 kB │ gzip: 189.27 kB
  (!) Some chunks are larger than 500 kB after minification.
  ```
- **Architectural Impact**: All 12 pages and modals are compiled into a single main JavaScript bundle.
- **Remediation Plan**: Introduce React `lazy()` and `Suspense` for administrative pages that are rarely loaded during standard cashier counter checkouts (e.g. `AuditLogPage`, `ReportsPage`, `EmployeesPage`, `SettingsPage`).

### B. Client-Side Rate-Limiting Storage Vulnerability
- **Observation**: Progressive rate limiting attempt counts reside in `safeStorage` under `vault_pos_rate_limits`.
- **Architectural Impact**: If an attacker opens Chrome DevTools and runs `localStorage.clear()`, the 60-second lockout timer is wiped.
- **Risk Level**: **Low** in practice, as counter terminals are physical cashier machines and Supabase Auth GoTrue enforces server-side rate limits if authentication is configured through cloud auth.

---

## 2. Synchronization & Cloud Architecture Considerations

### A. Last-Write-Wins (LWW) Conflict Resolution
- **Observation**: When two different browsers edit the same session or pricing config simultaneously, the record with the newer `updated_at` timestamp takes precedence.
- **Architectural Impact**: If an admin changes a price on desktop at 10:00:01 and another cashier updates stock at 10:00:02, the latter state merges.
- **Mitigation**: Critical financial records (payments, closings, audit logs) are append-only, preventing data loss.

### B. Anonymous Key Public Exposure
- **Observation**: `VITE_SUPABASE_ANON_KEY` is bundled into frontend JavaScript by design.
- **Architectural Impact**: Anyone inspecting network requests can view the anon key.
- **Mitigation**: PostgreSQL Row-Level Security (RLS) policies in [`supabase/full_schema_setup.sql`](file:///c:/Users/arsha/Downloads/Vault%20Digital/supabase/full_schema_setup.sql) enforce that destructive operations require authenticated administrator tokens.

---

## 3. Data Masking Architecture

- **Observation**: Phone number masking (`maskPhoneNumber`) occurs in the presentation layer ([`src/utils/formatters.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/utils/formatters.ts)) rather than through a dedicated PostgreSQL view or database mask.
- **Architectural Impact**: Raw phone numbers reside in the browser memory heap of an authenticated employee.
- **Future Enhancement**: If strict regulatory separation is required, create a PostgreSQL view `sessions_public` that masks the `customer_phone` column before emitting to non-admin JWT roles.
