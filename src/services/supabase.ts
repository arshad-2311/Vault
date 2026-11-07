import { createClient } from '@supabase/supabase-js';
import { Session } from '../types';

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined) ||
  '';

const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ||
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your-project') &&
  supabaseAnonKey !== 'your-anon-key'
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export interface SupabaseConfigStatus {
  configured: boolean;
  url: string;
  hasKey: boolean;
}

export function getSupabaseStatus(): SupabaseConfigStatus {
  return {
    configured: isSupabaseConfigured,
    url: supabaseUrl ? supabaseUrl.replace(/^(https?:\/\/[^/]+).*/, '$1') : 'Not Configured (Running in Offline/Local Mode)',
    hasKey: Boolean(supabaseAnonKey),
  };
}

export async function supabaseSignIn(email: string, password: string) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function supabaseSignOut() {
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch {}
}

export async function supabaseGetUserProfile(userId: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

const isValidUUID = (str?: string): boolean =>
  Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

/**
 * Automatically syncs a session (including line items and payment) to Supabase Cloud Database.
 */
export async function syncSessionToSupabase(session: Session): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const stationId = session.stationId || 'station-walk-in';

    // 1. Ensure 'station-walk-in' exists in stations table
    if (stationId === 'station-walk-in') {
      try {
        await supabase.from('stations').upsert({
          id: 'station-walk-in',
          name: 'Walk-in Snack Counter',
          gaming_type: 'pool',
          status: 'available',
          display_order: 99,
        });
      } catch {}
    }

    // 2. Upsert session row
    const sessionPayload = {
      id: session.id,
      customer_name: session.customerName,
      customer_phone: session.customerPhone || null,
      gaming_type: session.gamingType,
      station_id: stationId,
      station_name: session.stationName,
      billing_type: session.billingType,
      is_multiplayer: Boolean(session.isMultiplayer),
      fixed_plan_id: session.fixedPlanId || null,
      fixed_plan_name: session.fixedPlanName || null,
      frames_count: session.framesCount || 1,
      start_time: session.startTime,
      end_time: session.endTime || null,
      duration_minutes: session.durationMinutes ?? 0,
      status: session.status,
      rate_snapshot: session.rateSnapshot || {},
      gaming_charge_paise: session.gamingChargePaise || 0,
      snack_subtotal_paise: session.snackSubtotalPaise || 0,
      discount_paise: session.discountPaise || 0,
      discount_reason: session.discountReason || null,
      final_bill_paise: session.finalBillPaise || 0,
      created_by: isValidUUID(session.createdBy) ? session.createdBy : null,
      created_by_name: session.createdByName || 'Staff',
      completed_by: isValidUUID(session.completedBy) ? session.completedBy : null,
      completed_by_name: session.completedByName || null,
      notes: session.notes || null,
      is_voided: Boolean(session.isVoided),
      void_reason: session.voidReason || null,
      voided_at: session.voidedAt || null,
      created_at: session.createdAt || new Date().toISOString(),
      updated_at: session.updatedAt || new Date().toISOString(),
    };

    const { error: sessionErr } = await supabase.from('sessions').upsert(sessionPayload);
    if (sessionErr) {
      console.warn('Supabase session sync error:', sessionErr.message);
      return { success: false, error: sessionErr.message };
    }

    // 3. Upsert session items
    if (session.items && session.items.length > 0) {
      const itemsPayload = session.items.map((it) => ({
        id: it.id,
        session_id: session.id,
        product_id: it.productId || null,
        name: it.name,
        quantity: it.quantity,
        unit_price_paise: it.unitPricePaise,
        line_total_paise: it.lineTotalPaise,
        is_custom: Boolean(it.isCustom),
        created_at: session.createdAt || new Date().toISOString(),
      }));

      const { error: itemsErr } = await supabase.from('session_items').upsert(itemsPayload);
      if (itemsErr) {
        console.warn('Supabase items sync warning:', itemsErr.message);
      }
    }

    // 4. Upsert payment record
    if (session.payment) {
      const paymentPayload = {
        id: session.payment.id,
        session_id: session.id,
        method: session.payment.method,
        gpay_amount_paise: session.payment.gpayAmountPaise || 0,
        cash_amount_paise: session.payment.cashAmountPaise || 0,
        total_received_paise: session.payment.totalReceivedPaise || 0,
        final_bill_paise: session.payment.finalBillPaise || 0,
        outstanding_balance_paise: session.payment.outstandingBalancePaise || 0,
        recorded_by: isValidUUID(session.payment.recordedBy) ? session.payment.recordedBy : null,
        recorded_by_name: session.payment.recordedByName || 'Staff',
        status: session.payment.status || 'PAID',
        notes: session.payment.notes || null,
        timestamp: session.payment.timestamp || new Date().toISOString(),
      };

      const { error: payErr } = await supabase.from('payments').upsert(paymentPayload);
      if (payErr) {
        console.warn('Supabase payment sync warning:', payErr.message);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to sync session to Supabase:', err);
    return { success: false, error: err.message || 'Sync failed' };
  }
}

/**
 * Bulk syncs all stored sessions to Supabase Cloud Database.
 */
export async function syncAllSessionsToSupabase(sessions: Session[]): Promise<{
  total: number;
  synced: number;
  failed: number;
  error?: string;
}> {
  if (!supabase || !isSupabaseConfigured) {
    return { total: 0, synced: 0, failed: 0, error: 'Supabase not configured' };
  }

  let synced = 0;
  let failed = 0;
  for (const s of sessions) {
    const res = await syncSessionToSupabase(s);
    if (res.success) {
      synced++;
    } else {
      failed++;
    }
  }

  return { total: sessions.length, synced, failed };
}
