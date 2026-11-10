# Directory and File Structure: VAULT 147 POS

This document provides a comprehensive mapping of every file in the codebase, detailing its architectural responsibility, primary exports, dependencies, inter-module connections, and potential blast radius if modified.

---

## 1. Complete Project Directory Tree

```text
Vault Digital/
├── .env.example                                  # Sanitized template for environment variables
├── .gitignore                                    # Git version control exclusions
├── .oxlintrc.json                                # Oxlint static code analysis configuration
├── index.html                                    # HTML5 root shell and favicon linkages
├── package.json                                  # Package manifest, dependencies, scripts
├── package-lock.json                             # Exact dependency lockfile
├── postcss.config.js                             # PostCSS plugins (Tailwind, Autoprefixer)
├── tailwind.config.js                            # Tailwind styling configuration & themes
├── tsconfig.app.json                             # TypeScript compiler options for browser code
├── tsconfig.json                                 # TypeScript project references root
├── tsconfig.node.json                            # TypeScript configuration for Vite/Node tooling
├── vercel.json                                   # SPA rewrite rules for Vercel deployment
├── vite.config.ts                                # Vite bundler configuration
│
├── public/                                       # Static public files served at root
│   ├── _redirects                                # Cloudflare/Netlify SPA fallback rule
│   ├── favicon.svg                               # Application SVG browser favicon
│   ├── icons.svg                                 # Icon sprite definition
│   ├── vault-logo.png                            # Square branding mark
│   ├── vault-logo-full.png                       # Official vertical full logo
│   ├── vault-logo-horizontal.png                 # Official horizontal banner logo
│   ├── vault-logo-symbol.png                     # Official emblem symbol
│   └── vault-text.png                            # Official brand typography
│
├── src/                                          # Core TypeScript Application Source
│   ├── App.css                                   # Component-level CSS overrides
│   ├── App.tsx                                   # Master application shell, tabs, & modals
│   ├── index.css                                 # Global styles, fonts, and Tailwind directives
│   ├── main.tsx                                  # React DOM 19 application mounting entry point
│   │
│   ├── assets/                                   # Bundled images and vectors
│   │   ├── hero.png                              # Gaming hero promotional artwork
│   │   ├── react.svg                             # React SVG asset
│   │   ├── vite.svg                              # Vite SVG asset
│   │   ├── vault-logo.png                        # Official branding mark
│   │   ├── vault-logo-full.png                   # Official vertical branding logo
│   │   ├── vault-logo-horizontal.png             # Official horizontal logo
│   │   ├── vault-logo-symbol.png                 # Official emblem symbol
│   │   └── vault-text.png                        # Official brand typography
│   │
│   ├── components/                               # Modular UI component hierarchy
│   │   ├── common/                               # Reusable presentation atoms
│   │   │   ├── Badge.tsx                         # Status badge with variant colors
│   │   │   ├── Button.tsx                        # Reusable button with variants & icons
│   │   │   └── Modal.tsx                         # Accessible backdrop dialog modal container
│   │   ├── layout/                               # Persistent framing components
│   │   │   ├── Navbar.tsx                        # Top header bar with quick stats & branding
│   │   │   └── Sidebar.tsx                       # Navigation sidebar with tab switching
│   │   └── pos/                                  # Domain-specific Point-of-Sale modals
│   │       ├── AddSnackModal.tsx                 # Concessions addition modal for active sessions
│   │       ├── CheckoutModal.tsx                 # Settlement, billing adjustment & payment modal
│   │       ├── NewEntryModal.tsx                 # Check-in modal to start a new gaming session
│   │       ├── ReceiptModal.tsx                  # Printable thermal receipt preview modal
│   │       └── StationCard.tsx                   # Station status, timer & quick action tile
│   │
│   ├── context/                                  # React context state providers
│   │   └── AuthContext.tsx                       # User authentication, RBAC, & inactivity timer
│   │
│   ├── pages/                                    # Top-level view controllers (Tabs)
│   │   ├── ActiveSessionsPage.tsx                # Grid of currently ongoing active sessions
│   │   ├── AuditLogPage.tsx                      # Immutable audit log inspection table
│   │   ├── CashClosingPage.tsx                   # Daily cash drawer denomination reconciliation
│   │   ├── DailyExpensesPage.tsx                 # Operating expenses logging & category analysis
│   │   ├── DashboardPage.tsx                     # Live KPI metrics, financial summary, & stations
│   │   ├── EmployeesPage.tsx                     # Staff role management & status toggling
│   │   ├── LoginPage.tsx                         # Secure authentication gate & lockout screen
│   │   ├── ReportsPage.tsx                       # Financial reporting & masked CSV data export
│   │   ├── SettingsPage.tsx                      # Pricing rates, controller scaling, & rule config
│   │   ├── SnacksPage.tsx                        # Product catalog & stock inventory manager
│   │   ├── TransactionsPage.tsx                  # Transaction history, payment editing, & sync
│   │   └── WalkInSnackPosPage.tsx                # Fast retail counter checkout for concessions
│   │
│   ├── services/                                 # Data persistence & cloud integration engines
│   │   ├── storage.ts                            # Core PosStorageEngine embedded database
│   │   └── supabase.ts                           # Supabase REST and WebSocket cloud client
│   │
│   ├── types/                                    # Type contracts and domain interfaces
│   │   └── index.ts                              # Canonical domain models and TypeScript types
│   │
│   ├── utils/                                    # Pure calculation and formatting utilities
│   │   ├── formatters.ts                         # Currency (₹), duration, date, & phone masking
│   │   └── pricing.ts                            # Pure billing calculations & rounding rules
│   │
│   └── test/                                     # Automated test suites (Vitest)
│       ├── acceptance.test.ts                    # 24 core domain user story scenarios
│       ├── backend_extended.test.ts              # 19 engine and state transition tests
│       ├── components_render.test.tsx            # 13 React UI component rendering tests
│       ├── expenses_and_payment_edit.test.ts     # 9 tests for expenses & payment modifications
│       ├── master_qa_audit.test.ts               # 15 end-to-end audit & financial invariant tests
│       ├── security.test.tsx                     # 23 tests for PBKDF2 hashing, lockouts, RBAC
│       └── snack_and_pricing_cloud_sync.test.ts  # 6 tests for snack catalogue & cloud sync
│
├── supabase/                                     # Supabase PostgreSQL schema and migration files
│   ├── enable_cloud_sync.sql                     # Cloud sync tables, products seed, permissive RLS
│   ├── full_schema_setup.sql                     # Master idempotent database schema with triggers
│   ├── seed.sql                                  # Baseline database seed records
│   ├── seed_users.sql                            # Production administrator and staff seeds
│   └── migrations/                               # Timestamped migration archives
│       ├── 20261025000000_init_schema.sql        # Initial schema migration
│       └── 20261028000000_security_hardening.sql# Security hardening and immutability triggers
│
└── docs/                                         # Complete developer knowledge base (17 docs)
```

---

## 2. Exhaustive File Registry & Impact Analysis

### Core Services & Data Access Layer (CRITICAL CORE)

| File Path | Responsibility | Main Exports | Dependencies | Connections | Modification Impact |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`src/services/storage.ts`** *(CRITICAL)* | Single source of truth for POS state. Manages storage initialization, session lifecycles, concessions stock, pricing configs, payments, daily closing, expenses, audit trails, and data change events. | `PosStorageEngine`, `db`, `STORAGE_KEYS`, `INITIAL_USERS`, `INITIAL_STATIONS`, `INITIAL_SNACKS`, `DEFAULT_PRICING_CONFIG`, `VAULT_DATA_CHANGED_EVENT` | `types`, `pricing`, `formatters`, `supabase` | Imported by almost every page, modal, context, and test suite. | **EXTREME**. Modifying validation logic or state keys can corrupt local storage, break checkouts, or desynchronize cloud parity. |
| **`src/services/supabase.ts`** *(CRITICAL)* | Handles REST communication with Supabase PostgreSQL tables and WebSocket subscriptions. Provides non-blocking data synchronization. | `supabase`, `isSupabaseConfigured`, `syncSessionToSupabase`, `fetchSessionsFromSupabase`, `subscribeToSupabaseSessions`, `syncSnackToSupabase`, `fetchSnacksFromSupabase`, `syncPricingToSupabase`, `syncExpenseToSupabase`, etc. | `@supabase/supabase-js`, `types` | Used by `storage.ts`, `App.tsx`, `TransactionsPage.tsx`, `SnacksPage.tsx`, `SettingsPage.tsx`. | **HIGH**. Altering payloads will cause Supabase schema mismatches or silent data sync failures. |
| **`src/utils/pricing.ts`** *(CRITICAL)* | Pure business calculation engine. Computes elapsed minutes, applies rounding rules, calculates controller rates, frames, and validates payment totals. | `calculateDurationMinutes`, `applyRoundingPolicy`, `calculateGamingCharge`, `calculateSnackSubtotal`, `calculateFinalBill`, `validatePaymentAmounts` | `types` | Used by `storage.ts`, `CheckoutModal.tsx`, `WalkInSnackPosPage.tsx`, all test suites. | **EXTREME**. Any error in integer paise arithmetic will cause revenue leakage or checkout math rejections. |
| **`src/types/index.ts`** *(CRITICAL)* | Canonical TypeScript definitions for all business entities (Sessions, Items, Payments, Snacks, Expenses, Closings, AuditLogs, Users). | `User`, `Station`, `SnackItem`, `SessionItem`, `PaymentRecord`, `PricingConfig`, `Session`, `DailyExpense`, `DailyClosing`, `AuditLog`, `DashboardMetrics` | None | Imported across the entire codebase. | **EXTREME**. Changing type shapes requires updating components, storage adapters, tests, and database migrations. |
| **`src/utils/formatters.ts`** | String and numerical formatting utilities for currency (₹), durations, timestamps, and phone numbers. | `formatRupees`, `rupeesToPaise`, `paiseToRupees`, `formatDuration`, `formatDateTime`, `maskPhoneNumber` | None | Used by all pages, modals, tables, and receipts. | **MEDIUM**. Ensures consistent ₹ representation and privacy masking across the app. |

---

### Application Shell & State Context

| File Path | Responsibility | Main Exports | Dependencies | Connections | Modification Impact |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`src/App.tsx`** | Top-level application shell. Manages active tab state, global modals (New Entry, Checkout, Add Snack, Receipt), periodic data polling, and keyboard shortcuts. | `AppContent`, `default App` | `React`, `AuthContext`, `Navbar`, `Sidebar`, modals, pages, `storage`, `supabase` | Root application entry point rendered by `main.tsx`. | **HIGH**. Controls viewport routing and modal rendering across the entire application. |
| **`src/context/AuthContext.tsx`** | Manages authentication state, PBKDF2 credential verification, progressive rate limiting, sliding inactivity timers, and RBAC helper flags. | `AuthProvider`, `useAuth`, `AuthContextType` | `React`, `types`, `storage`, `supabase` | Wraps `App.tsx`. Used by all pages to enforce permissions. | **HIGH**. Security boundary. Flaws could allow unauthorized employee access to admin tabs. |

---

### Presentation Pages (View Controllers)

| File Path | Tab Name | Responsibility | Main Exports | Key Features |
| :--- | :--- | :--- | :--- | :--- |
| **`src/pages/DashboardPage.tsx`** | `dashboard` | Executive KPI overview and live station tiles. | `DashboardPage` | Real-time sales stats (Total, GPay, Cash, Outstanding), station grid with live timers, recent activity list. |
| **`src/pages/ActiveSessionsPage.tsx`** | `active-sessions` | Focused view of currently running sessions. | `ActiveSessionsPage` | Station status filters, elapsed timer displays, mid-session snack ordering, and quick checkout triggers. |
| **`src/pages/WalkInSnackPosPage.tsx`** | `walk-in-pos` | Fast over-the-counter concessions POS. | `WalkInSnackPosPage` | Cart building, instant stock availability check, split/cash/GPay checkout, instant receipt printing. |
| **`src/pages/TransactionsPage.tsx`** | `transactions` | Historical ledger of all completed sessions. | `TransactionsPage` | Date filtering, payment method editing (Cash vs GPay vs Split), session voiding, manual cloud sync trigger. |
| **`src/pages/DailyExpensesPage.tsx`** | `expenses` | Operating expense logging and analytics. | `DailyExpensesPage` | Categorized expense entries (Supplies, Restock, Utilities, Salaries), payment mode tracking, category totals. |
| **`src/pages/SnacksPage.tsx`** | `snacks` | Concessions inventory and catalogue management. | `SnacksPage` | 10 client products, one-click `+`/`-` stock buttons, out-of-stock badges, price editing, Supabase active status pill. |
| **`src/pages/ReportsPage.tsx`** | `reports` | Date-range financial reporting & data export. | `ReportsPage` | Revenue charts, employee sales attribution, unmasked/masked customer phone CSV exports. |
| **`src/pages/CashClosingPage.tsx`** | `closing` | Shift-end cash drawer balancing. | `CashClosingPage` | Denomination note counter (₹500 to ₹10 + coins), expected cash calculation, variance calculation. |
| **`src/pages/EmployeesPage.tsx`** | `employees` | Staff account administration. | `EmployeesPage` | Admin-only staff account creation, role updates (`admin` vs `employee`), active/inactive toggles. |
| **`src/pages/SettingsPage.tsx`** | `settings` | Business rates & billing configuration. | `SettingsPage` | PS5 1-4 controller rates, snooker hourly/frame rates, grace minutes, discount limits, rounding rules. |
| **`src/pages/AuditLogPage.tsx`** | `audit-log` | Immutable compliance and security ledger. | `AuditLogPage` | Actor attribution, timestamped event tracking, previous/new state inspection, JSON export. |
| **`src/pages/LoginPage.tsx`** | Auth Gate | Authentication interface with rate-limiting. | `LoginPage` | Email/password input, lockout countdown alert, demo quick-login switcher. |

---

### Modals & Dialogs

| File Path | Responsibility | Triggered From | Key Operations |
| :--- | :--- | :--- | :--- |
| **`src/components/pos/NewEntryModal.tsx`** | Checks in a customer to an available station. | Station card, Navbar, Alt+N shortcut | Selects station, billing type (hourly/fixed), customer name/phone, controller count (1-4). |
| **`src/components/pos/CheckoutModal.tsx`** | Completes and settles an active gaming session. | Station card, ActiveSessionsPage | Computes final bill, duration adjustments (-1m/+1m), handles split/cash/GPay payments, calculates change due. |
| **`src/components/pos/AddSnackModal.tsx`** | Adds snacks or drinks to an active session tab. | Station card, ActiveSessionsPage | Category browsing, real-time stock deduction, quantity selection, tab subtotal update. |
| **`src/components/pos/ReceiptModal.tsx`** | Renders printable thermal receipt for customers. | Checkout completion, Transactions, Walk-in POS | Clean monochrome layout, line item breakdown, payment breakdown, browser window print trigger. |
| **`src/components/pos/StationCard.tsx`** | Individual station card on dashboard and active views. | Dashboard, ActiveSessionsPage | Dynamic color-coding (Green/Red/Amber), real-time live elapsed counter, action buttons. |
