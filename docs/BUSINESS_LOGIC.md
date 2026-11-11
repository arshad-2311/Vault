# Business Logic & Core Workflows: VAULT 147 POS

This document provides complete engineering specifications for all business logic, financial calculations, state transitions, validation rules, and error handling across VAULT 147 POS.

---

## Feature 1: PS5 Session Management & Multi-Player Scaling

### 1. Business Purpose
Allows gamers to rent PlayStation 5 consoles on either an hourly basis or through fixed-duration promotional passes. Automatically adjusts hourly rates depending on the number of active controllers/players (1 to 4 joysticks) to maximize venue revenue.

### 2. User Workflow
1. Cashier clicks an "Available" PS5 station card or presses `Alt + N`.
2. Selects customer, phone number (optional), billing type (`Hourly` or `Fixed Pass`), and controller count (1, 2, 3, or 4).
3. The station turns occupied; elapsed time begins running from the start timestamp.
4. During checkout, system computes the bill based on exact elapsed duration, applies rounding/grace policies, and allows `-1 min` / `+1 min` manual duration adjustments.

### 3. Pure Calculation Algorithm ([`src/utils/pricing.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/utils/pricing.ts))
```ts
// Duration calculation via UTC millisecond delta
export function calculateDurationMinutes(startTimeISO: string, endTimeISO: string): number {
  const start = new Date(startTimeISO).getTime();
  const end = new Date(endTimeISO).getTime();
  const deltaMs = end - start;
  if (deltaMs <= 0) return 1;
  return Math.round(deltaMs / (1000 * 60));
}

// Controller-Tiered Rate Selection
let hourlyRatePaise: number;
switch (controllersCount) {
  case 4: hourlyRatePaise = config.ps5Rate4PlayersPaise || 50000; break; // ₹500/hr
  case 3: hourlyRatePaise = config.ps5Rate3PlayersPaise || 40000; break; // ₹400/hr
  case 2: hourlyRatePaise = config.ps5Rate2PlayersPaise || 30000; break; // ₹300/hr
  default: hourlyRatePaise = config.ps5Rate1PlayerPaise || 15000; break; // ₹150/hr
}

// Grace Period & Rounding Rule
if (actualMinutes <= (graceMinutes || 5)) {
  return { gamingChargePaise: 0, explanation: 'Within grace period (free)' };
}
const billedMinutes = applyRoundingPolicy(actualMinutes, config.roundingRule);
const gamingChargePaise = Math.round((billedMinutes / 60) * hourlyRatePaise);
```

### 4. Validation & Error Scenarios
- **Collision Prevention**: `createSession` throws an error if station status is already `'occupied'`.
- **Double Checkout Prevention**: `completeSession` checks that `session.status === 'active'`.

---

## Feature 2: Snooker & 8-Ball Pool Table Billing

### 1. Business Purpose
Supports tournament English Snooker and standard 8-Ball Pool tables. Accommodates two distinct commercial models: standard hourly table rental or fast per-frame match pricing.

### 2. Billing Algorithms
- **Hourly Model**: Standard rate of ₹250/hour (`25000 paise`). Duration rounded to nearest 5 minutes.
- **Per-Frame Model**: Customer pays per frame played (default ₹50/frame = `5000 paise`). Duration does not affect price:
  $$\text{gamingChargePaise} = \text{framesCount} \times \text{poolPerFrameRatePaise}$$

---

## Feature 3: Concessions & Snack Inventory Tracking

### 1. Business Purpose
Manages retail concessions across two sales channels:
1. Mid-session orders attached to an ongoing gaming tab.
2. Fast over-the-counter walk-in sales ([`WalkInSnackPosPage.tsx`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/pages/WalkInSnackPosPage.tsx)).

### 2. Client Catalogue Specifications
The venue carries 10 dedicated products with separate stock tracking:
- **Beverages (₹20)**: Miranda, Pepsi, Seven Up, Mountain Dew.
- **Milkshakes (₹30)**: Vanilla Milkshake, Badam Milkshake, Butterscotch Milkshake, Chocolate Milkshake.
- **Accessories (₹100)**: Snooker Gloves.
- **Hydration (₹10)**: Water Bottle.

### 3. Inventory Stock Mutation Rules
- **Sales Deductions**: Adding an item to a session or completing a walk-in sale decrements product stock immediately:
  $$\text{stock}_{\text{new}} = \max(0, \text{stock}_{\text{old}} - \text{quantity})$$
- **Item Removal from Active Tab**: If an item was added by mistake, `removeSnackFromSession` restores the exact quantity to the catalogue.
- **Zero-Reversion Guarantee**: Out-of-stock items (`stock: 0`) stay permanently at 0 without reset upon app reload.

---

## Feature 4: Financial Settlement, Split Payments & Change Due

### 1. Business Purpose
Enforces financial accuracy during checkout. Handles cash overpayments, calculates change due, and supports hybrid split tender (e.g. customer pays ₹200 on GPay and ₹150 in cash for a ₹350 bill).

### 2. Payment Validation Invariants ([`src/utils/pricing.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/utils/pricing.ts))
```ts
export function validatePaymentAmounts(params: {
  method: PaymentMethod;
  finalBillPaise: number;
  gpayAmountPaise: number;
  cashAmountPaise: number;
  allowPartial?: boolean;
}): PaymentValidationResult {
  const totalReceived = gpayAmountPaise + cashAmountPaise;

  // Case 1: Underpayment
  if (totalReceived < finalBillPaise && !allowPartial) {
    return { isValid: false, error: 'Tendered amount is less than final bill.' };
  }

  // Case 2: Cash Overpayment (Dispenses Physical Change)
  if (method === 'cash' && cashAmountPaise > finalBillPaise) {
    const changeDuePaise = cashAmountPaise - finalBillPaise;
    return {
      isValid: true,
      changeDuePaise,
      paymentStatus: 'OVERPAID_CHANGE_DUE',
      outstandingBalancePaise: 0,
    };
  }

  // Case 3: Digital UPI Overpayment Guard
  if (method === 'gpay' && gpayAmountPaise > finalBillPaise) {
    return { isValid: false, error: 'Digital GPay cannot exceed bill to dispense cash change.' };
  }

  // Case 4: Split Settlement
  return {
    isValid: true,
    changeDuePaise: 0,
    paymentStatus: totalReceived >= finalBillPaise ? 'PAID' : 'PARTIAL',
    outstandingBalancePaise: Math.max(0, finalBillPaise - totalReceived),
  };
}
```

---

## Feature 5: Payment Method Editing & Reallocation

### 1. Business Purpose
Cashiers occasionally click the wrong payment method under pressure (e.g. selecting GPay when the customer handed over a cash note). Administrators need the ability to correct the tender record without voiding the entire gaming session.

### 2. Implementation Rules (`updatePaymentDetails` in `storage.ts`)
- **Permission**: Strict superuser check (`actor.role === 'admin'`).
- **Precondition**: Session must be in `completed` status and `isVoided === false`.
- **Validation**: `cashAmountPaise + gpayAmountPaise >= finalBillPaise`.
- **Audit Logging**: Logs `PAYMENT_UPDATED` with previous and new payment snapshots.
- **Cloud Sync**: Immediately triggers `syncSessionToSupabase`.

---

## Feature 6: Daily Cash Closing & Drawer Balancing

### 1. Business Purpose
Ensures cashiers balance physical cash notes in the drawer against expected cash collections at the end of each business shift.

### 2. Auditing Workflow ([`CashClosingPage.tsx`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/pages/CashClosingPage.tsx))
1. Cashier enters note counts:
   - ₹500 notes $\times$ count
   - ₹200 notes $\times$ count
   - ₹100 notes $\times$ count
   - ₹50 notes $\times$ count
   - ₹20 notes $\times$ count
   - ₹10 notes $\times$ count
   - ₹1 / ₹2 / ₹5 coins total
2. System calculates `countedCashPaise`.
3. System aggregates all cash collections for the date:
   $$\text{expectedCashPaise} = \sum \text{cashAmountPaise} - \sum \text{changeDuePaise} - \sum \text{cashExpensesPaise}$$
4. System computes variance:
   $$\text{cashVariancePaise} = \text{countedCashPaise} - \text{expectedCashPaise}$$
   - If $\text{variance} = 0$: Perfect balance (Green).
   - If $\text{variance} < 0$: Cash shortage (Red alert).
   - If $\text{variance} > 0$: Cash surplus (Amber alert).

---

## Feature 7: Operational Expense Management

### 1. Business Purpose
Tracks day-to-day venue disbursements (beverage restock crates, snooker cue chalk, maintenance, utility bills, employee advances) to determine true net venue profit.

### 2. Implementation Rules (`storage.ts`)
- Records amount in integer paise, title, category, payment method (`cash`, `gpay`, `bank_transfer`), and optional receipt number.
- Cash-funded expenses are automatically subtracted from drawer expected cash during closing.

---

## Feature 8: Session Voiding & Inventory Restoration

### 1. Business Purpose
Enables administrators to void an erroneous entry or cancelled transaction while maintaining accounting integrity and automatically returning sold snacks to inventory.

### 2. Execution Steps (`voidSession` in `storage.ts`)
1. Rejects non-admin actors.
2. Marks session `isVoided = true`, `status = 'cancelled'`, and records `voidReason` and `voidedAt`.
3. **Inventory Reversion**: Loops through `session.items` and adds quantities back to `product.stock`.
4. Frees station if the voided session was currently active.
5. Emits `VAULT_DATA_CHANGED_EVENT` and syncs to Supabase.

