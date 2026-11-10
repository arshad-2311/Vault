# Frontend Documentation: VAULT 147 POS

## 1. Technical Framework & Core Tooling

| Technology | Version | Purpose |
| :--- | :--- | :--- |
| **React** | `19.3.1` | Declarative UI component library utilizing modern hooks and functional components. |
| **TypeScript** | `~6.0.3` | Strong typing, interfaces, strict null checks, and compile-time contract enforcement. |
| **Vite** | `^8.3.4` | Ultra-fast Hot Module Replacement (HMR) and optimized Rolldown production bundler. |
| **Tailwind CSS** | `^3.4.17` | Utility-first responsive styling with customized dark theme tokens. |
| **Lucide React** | `^1.61.0` | Comprehensive, consistent icon library for all controls, navigation, and badges. |

---

## 2. Routing & View Navigation Architecture

Rather than relying on heavy client-side router libraries that can cause deep-linking state synchronization glitches during offline execution, VAULT 147 POS uses an **Atomic State-Driven Navigation Architecture** defined in [`src/App.tsx`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/App.tsx):

```ts
export type NavTab =
  | 'dashboard'
  | 'active-sessions'
  | 'walk-in-pos'
  | 'transactions'
  | 'expenses'
  | 'snacks'
  | 'reports'
  | 'closing'
  | 'employees'
  | 'settings'
  | 'audit-log';
```

### Navigation Control Flow
1. **Sidebar Navigation**: Clicking an item in [`Sidebar.tsx`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/components/layout/Sidebar.tsx) triggers `onSelectTab(tab)`.
2. **Permission Guarding**: Restricted tabs (`employees`, `settings`, `audit-log`, `expenses`) are conditionally rendered. If an employee attempts to navigate to a restricted tab, the main viewport displays an **Access Denied** fallback screen with a "Return to Dashboard" action button.
3. **Mobile Drawer**: On screens smaller than `768px` (iPad / Mobile), the sidebar transforms into an off-canvas slide-out drawer toggled from the hamburger menu in [`Navbar.tsx`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/components/layout/Navbar.tsx).
4. **Deep-linking & Action Shortcuts**:
   - `Alt + N` globally triggers `NewEntryModal` from anywhere in the application.
   - Concessions buttons link directly to `walk-in-pos`.
   - Dashboard financial cards navigate directly to `transactions`.

---

## 3. Component Hierarchy

```text
App (Root)
└── AuthProvider (context/AuthContext.tsx)
    └── AppContent (src/App.tsx)
        ├── [If Unauthenticated] -> LoginPage
        └── [If Authenticated]
            ├── Navbar (Sticky Top Bar, Quick Actions, Mobile Toggle)
            ├── Sidebar (Collapsible / Mobile Drawer Navigation)
            ├── Main Content Viewport
            │   ├── DashboardPage (Live Stations, Quick KPIs, Recent Sessions)
            │   ├── ActiveSessionsPage (Running Timers, Mid-session Snacks)
            │   ├── WalkInSnackPosPage (Retail Concessions Register & Cart)
            │   ├── TransactionsPage (Ledger, Payment Switcher, Cloud Sync)
            │   ├── DailyExpensesPage (Cost Tracking & Categories)
            │   ├── SnacksPage (Catalogue Manager, +/- Stock Controls)
            │   ├── ReportsPage (Analytics, Revenue Graphs, CSV Exports)
            │   ├── CashClosingPage (Denomination Balancing & Drawer Audit)
            │   ├── EmployeesPage (User Administration & Status Toggling)
            │   ├── SettingsPage (Hourly/Fixed Rates, Joysticks, Policies)
            │   └── AuditLogPage (Immutable Security Trail Viewer)
            └── Global Modals (Rendered conditionally at root level)
                ├── NewEntryModal (Check-in new player to station)
                ├── CheckoutModal (Finalize session, adjust time, settle bill)
                ├── AddSnackModal (Add refreshments to ongoing session tab)
                └── ReceiptModal (Thermal print preview & browser print trigger)
```

---

## 4. Reusable Presentation Atoms

### A. Button Primitive ([`src/components/common/Button.tsx`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/components/common/Button.tsx))
Supports uniform styling variants, sizes, icon injection, and loading states:

```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}
```
- `primary`: Crimson red gradient (`bg-red-600 hover:bg-red-700 text-white`).
- `secondary`: Subtle dark slate (`bg-slate-800 hover:bg-slate-700 text-slate-200`).
- `danger`: Warning red (`bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800`).
- `success`: Emerald accent (`bg-emerald-600 hover:bg-emerald-700 text-white`).

### B. Badge Primitive ([`src/components/common/Badge.tsx`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/components/common/Badge.tsx))
Displays station statuses, payment modes, and stock levels:

```tsx
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
}
```

### C. Modal Container ([`src/components/common/Modal.tsx`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/components/common/Modal.tsx))
Accessible backdrop dialog that handles escape-key dismissal, outside click detection, body scroll locking, and smooth fade/zoom animations.

---

## 5. State Management & Event Bus

The frontend combines two state distribution mechanisms:

1. **`AuthContext` (`src/context/AuthContext.tsx`)**:
   - Manages `currentUser`, `isAuthenticated`, `sessionExpiresAt`, and RBAC permissions (`isAdmin`, `isEmployee`).
   - Listens to global user input (`mousedown`, `keydown`, `touchstart`, `scroll`) to extend session expiry in sliding windows.

2. **The `VAULT_DATA_CHANGED_EVENT` Bus**:
   - Whenever any record in `storage.ts` is created, updated, or deleted, the engine invokes:
     ```ts
     window.dispatchEvent(new Event(VAULT_DATA_CHANGED_EVENT));
     ```
   - Pages and root components attach a single `useEffect` listener to this event:
     ```ts
     useEffect(() => {
       const handleDataChanged = () => {
         setStations(db.getStations());
         setSessions(db.getSessions());
       };
       window.addEventListener(VAULT_DATA_CHANGED_EVENT, handleDataChanged);
       return () => window.removeEventListener(VAULT_DATA_CHANGED_EVENT, handleDataChanged);
     }, []);
     ```
   - **Benefit**: Ensures 100% reactive synchrony across disparate components without massive prop-drilling or external heavyweight state libraries.

---

## 6. Form Handling & Currency Sanitization

All monetary inputs presented to staff are entered in standard Indian Rupees (₹), but **must be parsed into integer paise** before passing to the engine.

Standard Form Pattern:
```tsx
const [priceRupees, setPriceRupees] = useState('20');

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  const pricePaise = rupeesToPaise(priceRupees); // Converted safely via Math.round(Number(val) * 100)
  db.updateSnack(snackId, { pricePaise }, currentUser);
};
```

---

## 7. How to Add a New Page to the Frontend

Follow this 5-step blueprint to add a new tab/view:

1. **Define the Tab Name** in [`src/components/layout/Sidebar.tsx`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/components/layout/Sidebar.tsx):
   ```ts
   export type NavTab = ... | 'my-new-feature';
   ```
2. **Add Navigation Item** in `Sidebar.tsx` navigation array:
   ```ts
   { id: 'my-new-feature', label: 'My Feature', icon: Sparkles, adminOnly: true }
   ```
3. **Create the View Component** in `src/pages/MyNewFeaturePage.tsx`:
   ```tsx
   import React from 'react';
   export const MyNewFeaturePage: React.FC = () => {
     return <div className="space-y-6">...</div>;
   };
   ```
4. **Register in `src/App.tsx`**:
   - Import `MyNewFeaturePage`.
   - Add conditional viewport rendering:
     ```tsx
     {activeTab === 'my-new-feature' && <MyNewFeaturePage />}
     ```
5. **Add Unit/Render Test** in `src/test/components_render.test.tsx` to verify clean mounting.
