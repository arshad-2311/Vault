# Environment Setup & Installation Guide: VAULT 147 POS

This guide walks through configuring, installing, running, and testing VAULT 147 POS on a local development machine or cloud build environment.

---

## 1. System Prerequisites

Before beginning, ensure your environment meets the minimum version requirements:

- **Node.js**: `v20.10.0` or higher (Node 22 LTS recommended)
- **npm**: `v10.0.0` or higher
- **Git**: `v2.40.0` or higher
- **Modern Browser**: Chrome, Edge, Safari, or Firefox with Web Crypto API support

---

## 2. Environment Variables Configuration

Create a `.env` file in the root directory by copying the provided `.env.example`:

```bash
cp .env.example .env
```

### Environment Variables Template (`.env.example`):
```ini
# ==============================================================================
# VAULT 147 POS - Supabase Cloud Configuration
# ==============================================================================

# 1. Supabase Project URL (e.g. https://your-project-id.supabase.co)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co

# 2. Supabase Anonymous Public Key (Publishable / Anon Key only - Never use Service Role Key)
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

> [!CAUTION]
> **Zero Plaintext Secrets Rule**: Never commit `.env` or real API keys to version control. Ensure `.env` remains in `.gitignore`.

---

## 3. Step-by-Step Installation

### Step 1: Clone Repository & Enter Directory
```bash
git clone https://github.com/arshad-2311/Vault.git "Vault Digital"
cd "Vault Digital"
```

### Step 2: Install Node Dependencies
```bash
npm install
```

### Step 3: Configure Cloud Database (Supabase)
1. Log into your [Supabase Dashboard](https://supabase.com).
2. Create a new project (e.g., `vault-pos-production`) in the **ap-south-1 (Mumbai)** region for lowest latency.
3. Open the **SQL Editor** in your Supabase dashboard.
4. Copy the entire contents of [`supabase/full_schema_setup.sql`](file:///c:/Users/arsha/Downloads/Vault%20Digital/supabase/full_schema_setup.sql) and click **Run**.
5. Copy your **Project URL** and **Anon Public Key** from **Project Settings -> API** and paste them into `.env`.

---

## 4. Development & Build Scripts

| Command | Action & Behavior |
| :--- | :--- |
| `npm run dev` | Boots the Vite development server with Hot Module Replacement (HMR) at `http://localhost:5173`. |
| `npm test` | Executes all 109 unit, integration, and security tests in Vitest. |
| `npm run build` | Runs TypeScript compilation check (`tsc -b`) and bundles production assets into `/dist`. |
| `npm run lint` | Runs fast Oxlint static code analysis across all `.ts` and `.tsx` source files. |
| `npm run preview` | Locally serves the minified production `/dist` bundle for pre-deployment inspection. |

---

## 5. Offline / Local-Only Development Mode

If you wish to test or develop without connecting to a real Supabase database:
1. Leave `VITE_SUPABASE_URL` unset or blank in `.env`.
2. The POS automatically detects that Supabase is unconfigured and switches to **Offline / Local Mode**.
3. All sessions, transactions, expenses, and inventory adjustments execute seamlessly inside the embedded `PosStorageEngine`.

