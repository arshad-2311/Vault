# Instructions for the Next AI Coding Agent: VAULT 147 POS

## Role & Mandate

You are an advanced AI coding agent tasked with maintaining, improving, or extending **VAULT 147 POS**.

Before you inspect or modify any file, **read and internalize this document and `AI_CONTEXT.md`**. Treat this documentation library as your primary source of truth.

---

## The 15 Core Handover Commandments

1. **Treat Documentation as the Primary Knowledge Base**: Do not repeatedly re-read the entire codebase from scratch. The files in `/docs` contain verified architectural blueprints, database schemas, and business calculation rules.
2. **Read Relevant Documentation First**: Before modifying a module, consult the specific documentation file (e.g. `BUSINESS_LOGIC.md` for pricing changes, `AUTHENTICATION_SECURITY.md` for auth changes).
3. **Locate Files via the File Map**: Use [`DIRECTORY_STRUCTURE.md`](file:///c:/Users/arsha/Downloads/Vault%20Digital/docs/DIRECTORY_STRUCTURE.md) to locate exact file paths and understand component blast radiuses before editing.
4. **Follow Established Architectural Patterns**: Adhere strictly to the Dual-Engine pattern (instant local write + `emitDataChanged()` + asynchronous Supabase cloud sync).
5. **Understand Dependencies Before Modifying Core Modules**: [`src/services/storage.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/services/storage.ts) and [`src/utils/pricing.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/utils/pricing.ts) are imported by nearly every view and test. Changes to function signatures will break multiple modules.
6. **Preserve Existing Functionality**: Existing features (PS5 controller tiers, snooker frame counts, split payments, cash drawer balancing, 10-item snack catalogue) must continue functioning without regression.
7. **Avoid Unnecessary Rewrites or New Frameworks**: Do not replace Tailwind CSS, Vitest, Lucide React, or the dual-engine storage architecture with alternative libraries.
8. **Do Not Duplicate Utilities or Components**: Check [`src/utils/formatters.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/utils/formatters.ts) and [`src/utils/pricing.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/utils/pricing.ts) before creating new helpers. Reuse `formatRupees`, `rupeesToPaise`, `calculateGamingCharge`, etc.
9. **Maintain Integer Paise Math at All Times**: Never store, pass, or calculate currency in floating-point rupees. All monetary values must remain integer paise (`₹1 = 100 paise`).
10. **Maintain Backward Compatibility**: Do not change enum values or storage keys (`vault_pos_sessions`, `vault_pos_snacks`) unless a comprehensive migration path is implemented in `db.init()`.
11. **Keep Documentation Synchronized**: When modifying database columns, API sync payloads, or billing logic, update the corresponding documentation files in `/docs`.
12. **Run All Tests Before Declaring Completion**: Execute `npm test`. All 109 tests must pass with 0 failures and 0 unhandled warnings. Run `npm run build` to verify production compilation.
13. **Never Assume Undocumented Functionality Exists**: If an endpoint or feature is not in the code or docs, verify before assuming its behavior.
14. **Resolve Code/Doc Conflicts by Verifying Reality**: If a document contradicts the actual source code, verify the code behavior, fix the issue, and update the documentation.
15. **Transparent Communication**: In your final response, explicitly explain which files were modified, architectural decisions made, and any potential side effects.

---

## Critical Codebase Pitfalls to Avoid

### Pitfall 1: Hardcoding Snack Stock Resets
- **DO NOT** add loops that reset `stock <= 0` to a positive default. Out-of-stock items must stay at `0`.

### Pitfall 2: Blocking the UI on Network Calls
- **DO NOT** `await` Supabase calls inside UI click handlers without local state commitment. The UI must update immediately via `safeStorage` and `emitDataChanged()`.

### Pitfall 3: Float Math in Financial Totals
- **DO NOT** write `const total = (bill / 100) + snackPrice;`. Always add paise integers first, then format at the very end: `formatRupees(totalPaise)`.

### Pitfall 4: Bypassing Role Checks
- **DO NOT** permit employees to access settings, audit trails, staff accounts, or to void transactions. Always verify `actor.role === 'admin'`.

### Pitfall 5: Deleting Financial Records
- **DO NOT** implement `DELETE` operations on `sessions`, `payments`, or `audit_logs`. Use `voidSession` with an immutable audit log entry.

