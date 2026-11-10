# AI CONTEXT & DEVELOPER HANDOVER GUIDE

> **PRIMARY ENTRY POINT FOR AI CODING AGENTS & DEVELOPERS**  
> Read this document first before inspecting or modifying the codebase. This document outlines the architectural blueprints, critical business rules, project constraints, directory maps, and operational commands for **VAULT 147 POS**.

---

## 1. Quick Project Summary

| Attribute | Specification |
| :--- | :--- |
| **Project Name** | **VAULT 147 POS** (Vault Gaming Centre & Snooker Lounge) |
| **System Classification** | Commercial Point-of-Sale (POS), Station Time-Tracker, Concessions Billing & Financial Management System |
| **Primary Target Domain** | High-throughput console gaming lounges (Sony PlayStation 5) & tournament billiard parlours (Snooker / 8-Ball Pool) |
| **Current Stage** | **Production-Ready & Fully Audited** (109 Vitest unit/integration/security tests passing; 0 errors) |
| **Core Architecture** | **Dual-Engine Architecture**: High-speed offline-first embedded local engine (`PosStorageEngine`) + Asynchronous bidirectional cloud sync with Supabase PostgreSQL |
| **Primary Currency** | Indian Rupee (₹, INR). **CRITICAL MANDATE: All internal calculations, rates, and storage use INTEGER PAISE (₹1 = 100 paise)** |

---

## 2. Technology Stack & Versions

- **Frontend Runtime**: React `19.3.1` (SPA mode)
- **Programming Language**: TypeScript `~6.0.3` (Strict Mode enabled)
- **Build Tool & Bundler**: Vite `^8.3.4` with `@vitejs/plugin-react`
- **Styling & Design System**: Tailwind CSS `^3.4.17` + PostCSS `^8.5.31` + Autoprefixer
- **Iconography**: Lucide React `^1.61.0`
- **Cloud Database & Auth**: Supabase JS SDK `@supabase/supabase-js` `^2.118.0` (PostgreSQL 15+ backend)
- **Testing Engine**: Vitest `^5.0.5` (JSDOM environment, 7 test suites, 109 tests)
- **Linter**: Oxlint `^1.88.0`
- **Hosting Targets**: Vercel / Netlify / Cloudflare Pages (with SPA client rewrite rules in `vercel.json` & `public/_redirects`)

---

## 3. Core Architectural Principles & Golden Rules

When modifying or extending this codebase, **YOU MUST ADHERE TO THESE 7 NON-NEGOTIABLE RULES**:

### 1. Integer Paise Financial Math (Zero Floating-Point)
- **Rule**: All monetary figures (`pricePaise`, `finalBillPaise`, `gpayAmountPaise`, `cashAmountPaise`, `gamingChargePaise`, `snackSubtotalPaise`, `discountPaise`, `amountPaise`) **MUST BE STORED AND CALCULATED IN INTEGER PAISE** (`100 paise = ₹1.00`).
- **Rationale**: Completely eliminates binary floating-point rounding errors (e.g. `0.1 + 0.2 = 0.30000000000000004`).
- **Implementation**: Convert user rupee input using `rupeesToPaise(rupeeString)` from [`src/utils/formatters.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/utils/formatters.ts). Format for display using `formatRupees(paise)`. Never store float rupees in memory or database.

### 2. Dual-Engine Resilience (Offline-First + Cloud Sync)
- The application executes with **zero latency** against the embedded `PosStorageEngine` ([`src/services/storage.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/services/storage.ts)).
- Local changes immediately trigger `emitDataChanged()` to refresh React components, then asynchronously sync to Supabase ([`src/services/supabase.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/services/supabase.ts)).
- If Supabase is offline or unconfigured, the system continues to function with 100% operational fidelity in local mode without throwing fatal crashes.
- When opening on new devices, `db.fetchAndMergeCloudData()` reconciles the remote Supabase PostgreSQL database into local state.

### 3. Progressive Rate-Limiting & Zero Plaintext Passwords
- All local user credentials are encrypted with salted hashes using the browser's Web Crypto API (`PBKDF2`/`SHA-256`).
- Progressive rate limiting locks out any account after 5 failed login attempts for 60 seconds, persisting across reloads in `vault_pos_rate_limits`.
- Inactivity timeouts enforce a 4-hour hard expiry with sliding-window activity touch (`mousedown`, `keydown`, `touchstart`, `scroll`).

### 4. Immutable Financial & Audit Logging
- Completed sessions, settled payments, and audit logs are strictly append-only.
- Direct deletion methods (`deleteSession`, `deletePayment`, `deleteAuditLog`) in [`storage.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/services/storage.ts) explicitly throw `Error: Action prohibited. Records are permanent and immutable.`
- The only compliant cancellation mechanism is `voidSession(sessionId, reason, actor)` which marks the record voided, restores consumed inventory stock, and logs the void event in the audit trail.

### 5. Multi-Player & Controller Tiered Billing
- PS5 stations support 1 to 4 joysticks/controllers:
  - 1 Controller: ₹150/hr (`15000 paise`)
  - 2 Controllers: ₹300/hr (`30000 paise`)
  - 3 Controllers: ₹400/hr (`40000 paise`)
  - 4 Controllers: ₹500/hr (`50000 paise`)
- Snooker / Pool tables support hourly billing (₹250/hr = `25000 paise`) or per-frame billing (₹50/frame = `5000 paise`).
- Time calculations use real UTC millisecond deltas, safely handling midnight crossings.

### 6. Role-Based Access Control (RBAC) & Phone Masking
- Two roles: `'admin'` (Ruwaidh) and `'employee'` (Staff).
- Non-admin staff cannot access Settings, Audit Logs, Staff Management, or Daily Expenses, and cannot void transactions or apply discounts above `maxEmployeeDiscountPaise` (₹50).
- Customer phone numbers are masked (`***-***-1234`) for non-admin staff in both UI tables and CSV exports, but visible to Administrators.

### 7. Never Revert Client Custom Snacks or Rates
- In [`src/services/storage.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/services/storage.ts), out-of-stock items (`stock: 0`) must never be forcibly overwritten to `50` on reload.
- The active client catalogue consists of 10 individual items (Miranda, Pepsi, Seven Up, Mountain Dew, 4 Milkshake flavors, Snooker Gloves, and Water Bottles). Any new items added must maintain individual stock counters.

---

## 4. Key Directory Map

```text
c:\Users\arsha\Downloads\Vault Digital\
├── AI_CONTEXT.md               # Primary AI context & developer handover entry point (this file)
├── package.json                # Project dependencies, scripts, and runtime configuration
├── vite.config.ts              # Vite configuration (React plugin, env prefixes VITE_ & NEXT_PUBLIC_)
├── tailwind.config.js          # Tailwind CSS styling, dark palette, Microgramma/Inter fonts
├── tsconfig.json               # TypeScript project reference root
├── vercel.json                 # Vercel deployment rewrite rules for SPA client routing
├── .env.example                # Sanitized template for Supabase environment keys
├── docs/                       # Complete Engineering Knowledge Base
│   ├── PROJECT_OVERVIEW.md     # Business background, target domain, and feature inventory
│   ├── ARCHITECTURE.md         # Full system architecture, dual-engine lifecycle, and Mermaid flows
│   ├── DIRECTORY_STRUCTURE.md  # Exhaustive file-by-file registry, responsibilities, and blast radius
│   ├── FRONTEND_DOCUMENTATION.md # React 19 pages, component hierarchy, modaling, state lifecycle
│   ├── BACKEND_DOCUMENTATION.md  # Storage engine services, validation pipelines, data access layer
│   ├── API_REFERENCE.md        # Supabase PostgREST & client SDK method specifications
│   ├── DATABASE_SCHEMA.md      # PostgreSQL schemas, tables, columns, indexes, RLS, and ER diagrams
│   ├── BUSINESS_LOGIC.md       # Pricing algorithms, timer math, checkout validation, closing logic
│   ├── AUTHENTICATION_SECURITY.md # Salted hashing, PBKDF2, progressive lockouts, RBAC, masking
│   ├── ENVIRONMENT_SETUP.md    # Local setup, dev scripts, Supabase connectivity, and env config
│   ├── DESIGN_SYSTEM.md        # Dark gaming aesthetic, color tokens, typography, UI components
│   ├── CODING_STANDARDS.md     # Code style, integer paise rules, naming conventions, patterns
│   ├── TESTING_QA.md           # Vitest test suite breakdown, coverage areas, regression checklist
│   ├── DEPLOYMENT_GUIDE.md     # Production deployment steps (Vercel/Netlify), DB migration runs
│   ├── KNOWN_ISSUES.md         # Technical debt, edge cases, bundle size observations, limitations
│   ├── FUTURE_DEVELOPMENT.md   # Practical guide: adding stations, adding billing rules, adding pages
│   └── AI_DEVELOPER_HANDOVER.md# 15 golden rules for subsequent AI coding agents
├── public/                     # Public static assets (Logos, favicons, _redirects)
├── src/
│   ├── App.tsx                 # Root application controller, tab switching, and global modals
│   ├── main.tsx                # React DOM entry point
│   ├── context/
│   │   └── AuthContext.tsx     # Authentication context provider, activity timers, RBAC state
│   ├── components/
│   │   ├── common/             # Reusable UI primitives (Button, Badge, Modal)
│   │   ├── layout/             # Navigation bars (Navbar, Sidebar)
│   │   └── pos/                # POS modals (NewEntryModal, CheckoutModal, AddSnackModal, etc.)
│   ├── pages/                  # Top-level view controllers (Dashboard, ActiveSessions, Snacks, etc.)
│   ├── services/
│   │   ├── storage.ts          # Core POS embedded database engine (PosStorageEngine)
│   │   └── supabase.ts         # Supabase cloud REST and realtime integration layer
│   ├── types/
│   │   └── index.ts            # Canonical TypeScript data contracts and interfaces
│   ├── utils/
│   │   ├── formatters.ts       # Currency (₹), duration, timestamp, and phone masking utilities
│   │   └── pricing.ts          # Pure business calculation engines (duration, rates, billing)
│   └── test/                   # Vitest automated test suites (109 passing tests)
└── supabase/                   # Supabase PostgreSQL SQL setup scripts and migrations
    ├── full_schema_setup.sql   # Complete idempotent database schema with triggers & RLS
    ├── enable_cloud_sync.sql   # Cloud sync tables, products seeding, and permissive POS policies
    └── migrations/             # Timestamped SQL migration archives
```

---

## 5. Development & Testing Commands

Execute commands in powershell from the project root:

```powershell
# 1. Start development server (runs at http://localhost:5173)
npm run dev

# 2. Run all 109 automated unit, integration, and security tests
npm test

# 3. Perform production TypeScript check & Vite minified bundle build
npm run build

# 4. Run Oxlint code analysis
npm run lint

# 5. Preview production build locally
npm run preview
```

---

## 6. Documentation Library Quick Links

For comprehensive engineering details on specific subsystems, consult the corresponding document in [`docs/`](file:///c:/Users/arsha/Downloads/Vault%20Digital/docs):

1. [**Project Overview**](file:///c:/Users/arsha/Downloads/Vault%20Digital/docs/PROJECT_OVERVIEW.md) — Business context, feature inventory, user profiles, and operational parameters.
2. [**System Architecture**](file:///c:/Users/arsha/Downloads/Vault%20Digital/docs/ARCHITECTURE.md) — Dual-engine lifecycle, data flow diagrams, and offline-cloud synchronization.
3. [**Directory & File Structure**](file:///c:/Users/arsha/Downloads/Vault%20Digital/docs/DIRECTORY_STRUCTURE.md) — Exhaustive file registry, imports, dependencies, and blast radius.
4. [**Frontend Documentation**](file:///c:/Users/arsha/Downloads/Vault%20Digital/docs/FRONTEND_DOCUMENTATION.md) — React 19 pages, routing, modal management, and responsive layouts.
5. [**Backend Documentation**](file:///c:/Users/arsha/Downloads/Vault%20Digital/docs/BACKEND_DOCUMENTATION.md) — In-browser storage engine, data persistence layer, and Supabase integration.
6. [**API Reference**](file:///c:/Users/arsha/Downloads/Vault%20Digital/docs/API_REFERENCE.md) — Supabase PostgreSQL endpoints, query parameters, payloads, and error contracts.
7. [**Database Schema**](file:///c:/Users/arsha/Downloads/Vault%20Digital/docs/DATABASE_SCHEMA.md) — PostgreSQL table definitions, constraints, indexes, RLS, and Mermaid ER diagram.
8. [**Business Logic & Pricing**](file:///c:/Users/arsha/Downloads/Vault%20Digital/docs/BUSINESS_LOGIC.md) — Calculation algorithms, controller rates, split payments, and drawer reconciliation.
9. [**Authentication & Security**](file:///c:/Users/arsha/Downloads/Vault%20Digital/docs/AUTHENTICATION_SECURITY.md) — PBKDF2 hashing, progressive rate-limiting, RBAC, and data privacy.
10. [**Environment Setup**](file:///c:/Users/arsha/Downloads/Vault%20Digital/docs/ENVIRONMENT_SETUP.md) — Installation, environment variables, Supabase credentials, and scripts.
11. [**Design System**](file:///c:/Users/arsha/Downloads/Vault%20Digital/docs/DESIGN_SYSTEM.md) — Dark visual identity, typography (Microgramma/Inter), color tokens, and components.
12. [**Coding Standards**](file:///c:/Users/arsha/Downloads/Vault%20Digital/docs/CODING_STANDARDS.md) — Integer paise math rules, strict typing, naming conventions, and anti-patterns.
13. [**Testing & Quality Assurance**](file:///c:/Users/arsha/Downloads/Vault%20Digital/docs/TESTING_QA.md) — Test suite breakdown, coverage matrix, and regression verification checklist.
14. [**Deployment & Operations**](file:///c:/Users/arsha/Downloads/Vault%20Digital/docs/DEPLOYMENT_GUIDE.md) — Vercel/Netlify hosting, database migration execution, and backup procedures.
15. [**Known Issues & Technical Debt**](file:///c:/Users/arsha/Downloads/Vault%20Digital/docs/KNOWN_ISSUES.md) — Edge cases, architectural tradeoffs, and planned optimizations.
16. [**Future Development Guide**](file:///c:/Users/arsha/Downloads/Vault%20Digital/docs/FUTURE_DEVELOPMENT.md) — Step-by-step blueprints for adding stations, pricing rules, and new views.
17. [**AI Developer Handover Rules**](file:///c:/Users/arsha/Downloads/Vault%20Digital/docs/AI_DEVELOPER_HANDOVER.md) — 15 immutable rules for any subsequent AI coding assistant working on this codebase.
