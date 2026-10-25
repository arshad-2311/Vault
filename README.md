# Vault Gaming Centre & Pool Lounge — POS & Digital Entry System

> **Production-Ready Commercial Gaming Centre Point-of-Sale (POS), Digital Counter Entry, Cash Management & Financial Accounting System** built for PlayStation 5 bays and 8-Ball Pool tournament operations.

---

## 🎮 System Overview

Vault POS is designed for counter speed, zero financial loss, and strict role-based operational security in high-throughput gaming centres. It handles real-time PS5 and pool table session tracking, concession line itemization with historical price snapshots, multi-channel payment reconciliation (GPay/UPI + Cash splits), automated shift cash drawer counting, and immutable forensic audit trails.

### Core Operational Features

1. **Digital Counter Entry (`Alt + N`)**:
   - Fast keyboard-accessible check-in flow with customer name, phone, console/table assignment, and start time.
   - Dual billing engine: **Hourly time-based** vs **Fixed passes** (e.g. 30-min rush pass, 1-hour fixed pass, 8-ball per-frame billing).
   - Configurable rounding policies: `nearest_5` (default), `exact`, `nearest_15`, or `ceiling_15`.
   - Handles midnight crossings seamlessly via UTC millisecond time math.
   - In-game concession adding (snacks & beverages) with instant price snapshots.

2. **Strict Financial Accuracy & Invariant Enforcement**:
   - **Zero Float Precision**: All monetary values are calculated and persisted as **exact integer paise** ($1\text{ INR} = 100\text{ paise}$). Floating-point arithmetic is prohibited for financial sums.
   - Supported payment modes: **GPay / UPI**, **Cash**, and **Split Payment (GPay + Cash)**.
   - Validation invariant: $\text{GPay Received} + \text{Cash Received} \equiv \text{Total Received}$.
   - Overpayment protection: Cash drawer overpayments cannot be recorded without an explicit adjustment.
   - Partial payment support: Explicit tracking of unpaid customer balances with `PAID`, `PARTIAL`, and `UNPAID` statuses.

3. **Live Station Bays**:
   - Real-time station occupancy overview showing PS5 bays and billiard tables.
   - Live running timers (hours:minutes:seconds) and active charge estimations.
   - One-click mid-game concession addition and fast checkout.

4. **Shift & Daily Cash Closing Reconciliation**:
   - Physical cash drawer counter supporting all Indian banknote denominations (₹500, ₹200, ₹100, ₹50, ₹20, ₹10 notes and loose coins).
   - Instant calculation of **Counted Cash vs System Expected Cash** with variance reporting (Surplus / Shortage).
   - Separate GPay digital totals that are never mixed with physical drawer cash.
   - Mandatory closing remarks for discrepancies.

5. **Role-Based Security & Permissions**:
   - **Admin**: Full financial access, pricing and rate configuration, staff management, voiding and corrections, audit trail inspection, CSV exports.
   - **Employee**: Customer check-in, start/end sessions, concession billing, daily closing, view own shift transactions. Blocked from modifying rates, deactivating users, or deleting financial records.
   - Enforced on backend PostgreSQL via Row Level Security (RLS) policies and in the application business logic.

6. **Reporting & Forensic Auditing**:
   - Daily, Weekly, Monthly, and Custom date range financial reports.
   - Detailed mathematical derivations verifying:
     $$\text{Total Sales} = \text{PS5 Revenue} + \text{Pool Revenue} + \text{Snack Revenue} - \text{Discounts}$$
     $$\text{Total Collections} = \text{GPay Collections} + \text{Cash Collections}$$
   - Filtered CSV exports matching dashboard calculations.
   - Immutable audit logs capturing actor, role, action, entity ID, timestamp, and JSON state diffs.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19, TypeScript, Vite |
| **Styling & Design System** | Tailwind CSS (Commercial dark slate theme, tabular numerals, 80mm print receipts) |
| **Iconography** | Lucide React |
| **Database & Auth (Cloud)** | Supabase PostgreSQL 15+ with Row Level Security (RLS) & Triggers |
| **Database (Offline/Local)** | Zero-config in-memory & IndexedDB/Local storage engine with seed data |
| **Testing** | Vitest (Automated acceptance & invariant test suite) |

---

## 🚀 Quick Start & Local Development

### 1. Prerequisites
- **Node.js** v18+ (tested on Node v24.16.0)
- **npm** v9+

### 2. Installation
```bash
git clone <repo-url>
cd "Vault Digital"
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173/](http://localhost:5173/) in your browser. The application runs immediately in **Local Persistent Mode** with pre-seeded PS5 stations, pool tables, snacks, and demo accounts!

### 4. Run Test Suite
```bash
npm test
```
Executes all 13 comprehensive acceptance tests verifying session duration calculations, rounding rules, split payment invariants, midnight crossing, void authorizations, and cash closing variances.

### 5. Production Build
```bash
npm run build
```

---

## 👥 Demo Credentials & Test Role Switcher

The top-right header contains an interactive **Role Switcher** allowing instant testing of permissions:

| Name | Role | Email | Permissions |
|---|---|---|---|
| **Vikram Sethi** | `admin` | `admin@vaultgaming.in` | Full system access, Pricing, Rates, Staff Management, Voids, Audits |
| **Rahul Sharma** | `employee` | `rahul@vaultgaming.in` | Digital Entry, Active Sessions, Add Snacks, Cash Closing, Checkout |
| **Priya Patel** | `employee` | `priya@vaultgaming.in` | Digital Entry, Active Sessions, Add Snacks, Cash Closing, Checkout |

---

## 🗄️ Database Architecture & Supabase Setup

### Connecting to Free-Tier Supabase

1. Create a free project at [supabase.com](https://supabase.com/).
2. Open the **SQL Editor** in your Supabase project dashboard.
3. Paste and run the contents of [`supabase/migrations/20261025000000_init_schema.sql`](supabase/migrations/20261025000000_init_schema.sql).
4. Run the seed data script in [`supabase/seed.sql`](supabase/seed.sql).
5. In the project root, create a `.env` file:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
6. Restart Vite (`npm run dev`). The status badge in the header will display **"Supabase Live"**.

### Database Schema Overview

- `profiles`: Authenticated users with role (`admin` vs `employee`), display name, and active status.
- `stations`: PS5 bays and pool tables with live status (`available`, `occupied`, `maintenance`).
- `pricing_config`: Business name, timezone (`Asia/Kolkata`), PS5 hourly rates, pool rates, rounding rule, discount caps.
- `products`: Snack catalogue with category and price in integer paise.
- `sessions`: Session records with start/end ISO timestamps, duration in minutes, customer name, station snapshot, pricing snapshot, gaming charge, snack subtotal, discount, and final bill.
- `session_items`: Itemized snacks attached to sessions with frozen historical `unit_price_paise`.
- `payments`: Transaction records with `gpay_amount_paise`, `cash_amount_paise`, `total_received_paise`, status (`PAID`, `PARTIAL`, `UNPAID`, `VOIDED`).
- `daily_closings`: Shift cash tally with expected cash, counted cash, variance, denomination breakdown, and cashier notes.
- `audit_logs`: Immutable security log protected by a PostgreSQL trigger that raises an exception on any `UPDATE` or `DELETE`.

---

## ☁️ Free-Tier Constraints & Hosting Architecture

Deployable on standard free-tier hosting platforms without paid services:

1. **Frontend Hosting (100% Free)**:
   - **Vercel** or **Netlify**: Connect your GitHub repository, set framework preset to `Vite`, build command to `npm run build`, output directory to `dist`.
2. **Database & Auth (Supabase Free Plan)**:
   - 500 MB PostgreSQL database storage.
   - Up to 50,000 monthly active users.
   - *Limitation*: Inactive Supabase projects on the free tier may pause after 7 days of inactivity. Simply click "Restore" in the Supabase dashboard to resume.
3. **No Paid Dependencies**:
   - Zero paid payment gateway SDKs (employees record physical/UPI transfers).
   - Zero paid charting packages or paid CSV services.

---

## ⌨️ Keyboard Shortcuts & Counter Ergonomics

- `Alt + N`: Instantly open New Digital Entry modal from any screen.
- `Escape`: Close any active dialog or modal.
- `Enter`: Submit focused form.

---

## 📄 License
MIT License. Built for commercial gaming centre operations.
