# Future Development Guide: VAULT 147 POS

This document provides step-by-step engineering recipes for developers and AI coding agents extending the functionality of VAULT 147 POS.

---

## 1. How to Add a New Station (e.g. VR Booth or PC Gaming Rig)

Follow this recipe to add a new physical station:

1. **Update Enum Type** in [`src/types/index.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/types/index.ts) if introducing a new gaming category:
   ```ts
   export type GamingType = 'ps5' | 'pool' | 'vr';
   ```
2. **Add Default Station** to `INITIAL_STATIONS` in [`src/services/storage.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/services/storage.ts):
   ```ts
   {
     id: 'vr-1',
     name: 'VR Booth 1 (Meta Quest 3)',
     gamingType: 'vr',
     status: 'available',
     activeSessionId: null,
     displayOrder: 7,
   }
   ```
3. **Configure Pricing Calculation** in [`src/utils/pricing.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/utils/pricing.ts):
   Add rate logic inside `calculateGamingCharge`:
   ```ts
   if (gamingType === 'vr') {
     const hourlyRatePaise = 35000; // ₹350/hr
     const billedMinutes = applyRoundingPolicy(actualMinutes, config.roundingRule);
     return {
       actualMinutes,
       billedMinutes,
       gamingChargePaise: Math.round((billedMinutes / 60) * hourlyRatePaise),
       explanation: `VR Booth Rental (₹350/hr)`,
     };
   }
   ```
4. **Update Database Seed & Enum** in [`supabase/full_schema_setup.sql`](file:///c:/Users/arsha/Downloads/Vault%20Digital/supabase/full_schema_setup.sql):
   ```sql
   ALTER TYPE gaming_type ADD VALUE IF NOT EXISTS 'vr';
   INSERT INTO public.stations (id, name, gaming_type, status, display_order)
   VALUES ('vr-1', 'VR Booth 1', 'vr', 'available', 7)
   ON CONFLICT (id) DO NOTHING;
   ```
5. **Add Unit Test** in `src/test/acceptance.test.ts` verifying that sessions can be created and checked out on `vr-1`.

---

## 2. How to Add a New Fixed Pricing Pass

1. Open [`src/services/storage.ts`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/services/storage.ts) and locate `DEFAULT_PRICING_CONFIG.ps5FixedPlans`.
2. Append the new plan object:
   ```ts
   {
     id: 'plan-4h',
     name: '4-Hour Marathon Pass',
     gamingType: 'ps5',
     durationMinutes: 240,
     pricePaise: 45000, // ₹450
   }
   ```
3. In [`src/pages/SettingsPage.tsx`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/pages/SettingsPage.tsx), ensure the plan options render in the fixed plan configuration inputs.
4. Run `npm test` to verify plans calculate accurately.

---

## 3. How to Add a New Tab / Page

1. **Add Tab Key** to `NavTab` in [`src/components/layout/Sidebar.tsx`](file:///c:/Users/arsha/Downloads/Vault%20Digital/src/components/layout/Sidebar.tsx):
   ```ts
   export type NavTab = ... | 'leaderboard';
   ```
2. **Add Menu Item** to `navItems` array in `Sidebar.tsx`:
   ```ts
   { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, adminOnly: false }
   ```
3. **Build the Page Component** in `src/pages/LeaderboardPage.tsx`.
4. **Register in `src/App.tsx`**:
   ```tsx
   {activeTab === 'leaderboard' && <LeaderboardPage />}
   ```
5. **Add Rendering Test** in `src/test/components_render.test.tsx`.

---

## 4. How to Add a New Supabase Table with Active Sync

1. **Define Schema** in `supabase/full_schema_setup.sql`:
   ```sql
   CREATE TABLE public.tournaments (
     id TEXT PRIMARY KEY,
     title TEXT NOT NULL,
     entry_fee_paise INTEGER NOT NULL,
     created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
   );
   ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Allow all on tournaments" ON public.tournaments FOR ALL USING (true);
   ```
2. **Add Interface** in `src/types/index.ts`:
   ```ts
   export interface Tournament {
     id: string;
     title: string;
     entryFeePaise: number;
     createdAt: string;
   }
   ```
3. **Add Sync Functions** in `src/services/supabase.ts`:
   - `syncTournamentToSupabase(tournament: Tournament)`
   - `fetchTournamentsFromSupabase()`
4. **Wire into `PosStorageEngine`** in `src/services/storage.ts`:
   Add getter, setter, creation method, audit logging, and asynchronous call to `syncTournamentToSupabase`.
5. **Create Unit Test** verifying offline creation and cloud sync payload.
