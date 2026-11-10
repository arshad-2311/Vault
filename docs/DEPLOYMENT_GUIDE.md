# Deployment & Production Operations Guide: VAULT 147 POS

## 1. Hosting Architecture & Prerequisites

VAULT 147 POS is built as a static Single Page Application (SPA). It can be deployed to any modern Edge CDN provider (Vercel, Netlify, or Cloudflare Pages).

### Build Pipeline:
- **Command**: `npm run build`
- **Output Directory**: `dist/`
- **Static Entry Point**: `dist/index.html`
- **Assets**: `dist/assets/index-[hash].js`, `dist/assets/index-[hash].css`

---

## 2. Deployment to Vercel (Recommended)

### Step 1: Connect Git Repository
1. Log in to [Vercel](https://vercel.com) and click **"Add New Project"**.
2. Select the repository: `https://github.com/arshad-2311/Vault`.
3. Set the Framework Preset to **Vite**.

### Step 2: Configure Build Settings
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Step 3: Configure Environment Variables
Add the following in **Project Settings -> Environment Variables**:
- `VITE_SUPABASE_URL`: `https://your-project-id.supabase.co`
- `VITE_SUPABASE_ANON_KEY`: `your-anon-publishable-key`
- `VITE_SUPABASE_PUBLISHABLE_KEY`: `your-anon-publishable-key`

### Step 4: Verify SPA Client Routing
The repository includes [`vercel.json`](file:///c:/Users/arsha/Downloads/Vault%20Digital/vercel.json) to handle single-page application client-side routing:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 3. Deployment to Netlify

1. In Netlify, link the GitHub repository.
2. Build command: `npm run build`.
3. Publish directory: `dist`.
4. Netlify automatically detects [`public/_redirects`](file:///c:/Users/arsha/Downloads/Vault%20Digital/public/_redirects) for SPA routing:
   ```text
   /*    /index.html   200
   ```
5. Add the Supabase environment variables in **Site Settings -> Environment Variables**.

---

## 4. Supabase Database Deployment & Migrations

To initialize or migrate the cloud database:

1. Open the **SQL Editor** in the Supabase Dashboard.
2. Execute [`supabase/full_schema_setup.sql`](file:///c:/Users/arsha/Downloads/Vault%20Digital/supabase/full_schema_setup.sql).
   - This script is **100% idempotent** (uses `CREATE TABLE IF NOT EXISTS`, `DO $$ BEGIN ... EXCEPTION`, `ON CONFLICT DO UPDATE`).
   - Creates tables, custom enum types, row-level security policies, and immutability triggers.
3. If syncing snacks and rates, ensure [`supabase/enable_cloud_sync.sql`](file:///c:/Users/arsha/Downloads/Vault%20Digital/supabase/enable_cloud_sync.sql) has been run.

---

## 5. Production Health Checks & Troubleshooting

| Symptom | Probable Cause | Corrective Action |
| :--- | :--- | :--- |
| **"Supabase is not configured" Pill** | Missing or incorrect environment variables in host dashboard. | Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel/Netlify settings, then trigger a redeployment. |
| **404 Error on Direct Page Refresh** | Missing SPA rewrite rules on host. | Ensure `vercel.json` or `_redirects` is deployed at the root of `dist/`. |
| **Snack Stock Reverts on Reload** | Legacy hardcoded reset active. | Verify [`src/services/storage.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/services/storage.ts) has the fix where `s.stock = 50` loop is removed. |
| **Rate Limit Lockout Triggered** | 5 consecutive bad login attempts. | Wait for the 60-second timer to expire, or use the Emergency Admin Login bypass if in local demo mode. |

---

## 6. Backup & Disaster Recovery

1. **Supabase Point-in-Time Recovery**: Supabase Pro projects provide automated continuous daily WAL backups.
2. **Local POS Recovery**: All active sessions, past transactions, and catalogue data reside in browser `localStorage`.
3. **Manual Cloud Sync**: Cashiers can click the **"Sync Cloud"** button in [`TransactionsPage.tsx`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/pages/TransactionsPage.tsx) or [`SnacksPage.tsx`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/pages/SnacksPage.tsx) at any time to push all local data to Supabase.
