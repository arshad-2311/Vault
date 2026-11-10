# API Reference: VAULT 147 POS

This document provides the definitive API and Data Access specification for all Supabase cloud database operations and service methods implemented in [`src/services/supabase.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/services/supabase.ts).

---

## 1. Authentication & Service Endpoints Overview

All remote network requests interact with the Supabase PostgREST and GoTrue APIs using the Supabase JavaScript Client.

- **Base URL**: Configured via `VITE_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`.
- **API Key**: Anonymous client key passed in the `apikey` and `Authorization: Bearer <token>` headers via `VITE_SUPABASE_ANON_KEY`.
- **Content-Type**: `application/json`
- **Data Representation**: ISO 8601 UTC timestamps, integer paise for all monetary values.

---

## 2. Table API Specifications

### A. Sessions API (`public.sessions`)

#### 1. Upsert Session
- **SDK Method**: `syncSessionToSupabase(session: Session)`
- **Underlying PostgREST Operation**: `POST /rest/v1/sessions` with `Prefer: resolution=merge-duplicates`
- **Purpose**: Synchronizes an active, completed, or voided gaming session to the cloud. Automatically ensures station prerequisite exists.
- **Authentication**: Anonymous or Authenticated User.
- **Payload Structure**:
  ```json
  {
    "id": "sess-comp-1",
    "customer_name": "Aman Verma",
    "customer_phone": "9876543210",
    "gaming_type": "ps5",
    "station_id": "ps5-2",
    "station_name": "PS5 Station 2",
    "billing_type": "hourly",
    "is_multiplayer": true,
    "start_time": "2026-11-10T10:00:00.000Z",
    "end_time": "2026-11-10T11:00:00.000Z",
    "duration_minutes": 60,
    "status": "completed",
    "rate_snapshot": {
      "hourlyRatePaise": 30000,
      "description": "PS5 (2 Controllers / 2 Players)",
      "roundingPolicy": "nearest_5"
    },
    "gaming_charge_paise": 30000,
    "snack_subtotal_paise": 5000,
    "discount_paise": 0,
    "discount_reason": null,
    "final_bill_paise": 35000,
    "created_by": null,
    "created_by_name": "Ruwaidh (Admin)",
    "completed_by": null,
    "completed_by_name": "Ruwaidh (Admin)",
    "notes": "Co-op FIFA 24",
    "is_voided": false,
    "void_reason": null,
    "voided_by": null,
    "voided_at": null,
    "created_at": "2026-11-10T10:00:00.000Z",
    "updated_at": "2026-11-10T11:00:00.000Z"
  }
  ```
- **Associated Child Operations**: Also atomically syncs `session.items` to `public.session_items` and `session.payment` to `public.payments`.
- **Response**: `{ success: true }` or `{ success: false, error: string }`.

#### 2. Fetch Sessions
- **SDK Method**: `fetchSessionsFromSupabase()`
- **Underlying PostgREST Operation**: `GET /rest/v1/sessions?select=*,session_items(*),payments(*)&order=created_at.desc&limit=100`
- **Purpose**: Pulls latest sessions and active timers for multi-device synchronization.
- **Response**: Array of normalized `Session` entities with child items and payment records.

#### 3. Realtime Stream Subscription
- **SDK Method**: `subscribeToSupabaseSessions(onUpdate: () => void): () => void`
- **Protocol**: WebSocket channel (`sessions-all-changes`) listening to `INSERT`, `UPDATE`, `DELETE` events on schema `public`, table `sessions`.
- **Unsubscribe**: Calling the returned cleanup function tears down the WebSocket channel.

---

### B. Concessions & Products API (`public.products`)

#### 1. Upsert Snack / Product
- **SDK Method**: `syncSnackToSupabase(snack: SnackItem)`
- **Underlying PostgREST Operation**: `POST /rest/v1/products` with `Prefer: resolution=merge-duplicates`
- **Purpose**: Syncs a product's price, active status, stock level, or alert threshold.
- **Payload Structure**:
  ```json
  {
    "id": "snk-1",
    "name": "Miranda",
    "category": "Beverages",
    "price_paise": 2000,
    "is_active": true,
    "stock": 50,
    "low_stock_threshold": 5,
    "updated_at": "2026-11-10T22:45:00.000Z"
  }
  ```
- **Response**: `{ success: true }` or `{ success: false, error: string }`.

#### 2. Delete Snack / Product
- **SDK Method**: `deleteSnackFromSupabase(snackId: string)`
- **Underlying PostgREST Operation**: `DELETE /rest/v1/products?id=eq.{snackId}`
- **Purpose**: Removes a deleted or deprecated product from the cloud database.

#### 3. Fetch All Snacks
- **SDK Method**: `fetchSnacksFromSupabase()`
- **Underlying PostgREST Operation**: `GET /rest/v1/products?select=*&order=name.asc`
- **Purpose**: Loads active inventory catalogue from Supabase.

---

### C. Daily Operating Expenses API (`public.daily_expenses`)

#### 1. Upsert Expense
- **SDK Method**: `syncExpenseToSupabase(expense: DailyExpense)`
- **Underlying PostgREST Operation**: `POST /rest/v1/daily_expenses` with `Prefer: resolution=merge-duplicates`
- **Payload Structure**:
  ```json
  {
    "id": "exp-1731278400000-abc12",
    "date": "2026-11-10",
    "title": "Beverage Crate Restock",
    "category": "Beverages & Snacks Restock",
    "amount_paise": 450000,
    "payment_method": "cash",
    "notes": "Delivered by Metro Wholesalers",
    "receipt_number": "REC-99812",
    "recorded_by": null,
    "recorded_by_name": "Ruwaidh (Admin)",
    "created_at": "2026-11-10T14:30:00.000Z",
    "updated_at": "2026-11-10T14:30:00.000Z"
  }
  ```

#### 2. Fetch Expenses
- **SDK Method**: `fetchExpensesFromSupabase()`
- **Underlying PostgREST Operation**: `GET /rest/v1/daily_expenses?select=*&order=date.desc`
- **Response**: List of `DailyExpense` objects ordered by date descending.

#### 3. Delete Expense
- **SDK Method**: `deleteExpenseFromSupabase(expenseId: string)`
- **Underlying PostgREST Operation**: `DELETE /rest/v1/daily_expenses?id=eq.{expenseId}`

---

### D. Pricing Configuration API (`public.pricing_config`)

#### 1. Upsert Pricing Configuration
- **SDK Method**: `syncPricingToSupabase(pricing: PricingConfig)`
- **Underlying PostgREST Operation**: `POST /rest/v1/pricing_config` with `Prefer: resolution=merge-duplicates`
- **Payload Structure**:
  ```json
  {
    "id": "cfg-default",
    "business_name": "Vault Gaming Centre & Snooker Lounge",
    "business_timezone": "Asia/Kolkata",
    "currency_symbol": "₹",
    "ps5_hourly_rate_paise": 15000,
    "ps5_multiplayer_hourly_rate_paise": 30000,
    "ps5_fixed_plans": [
      { "id": "plan-1h", "name": "1-Hour Fixed Pass", "gamingType": "ps5", "durationMinutes": 60, "pricePaise": 14000 }
    ],
    "pool_hourly_rate_paise": 25000,
    "pool_per_frame_rate_paise": 5000,
    "rounding_rule": "nearest_5",
    "allow_custom_snacks": true,
    "allow_partial_payments": true,
    "max_employee_discount_paise": 5000,
    "updated_at": "2026-11-10T22:45:00.000Z"
  }
  ```

#### 2. Fetch Pricing Configuration
- **SDK Method**: `fetchPricingFromSupabase()`
- **Underlying PostgREST Operation**: `GET /rest/v1/pricing_config?id=eq.cfg-default&select=*`

---

## 3. Bulk Backup Methods

| Method | Parameters | Tables Modified | Triggered From |
| :--- | :--- | :--- | :--- |
| `syncAllSessionsToSupabase` | `sessions: Session[]` | `sessions`, `session_items`, `payments` | Transactions page 60s background timer, manual sync button, `beforeunload` exit hook. |
| `syncAllExpensesToSupabase` | `expenses: DailyExpense[]` | `daily_expenses` | Transactions page background timer, exit hook. |
| `syncAllSnacksToSupabase` | `snacks: SnackItem[]` | `products` | Snacks page restock all, cloud reconciliation. |
