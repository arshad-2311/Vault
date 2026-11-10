import { createClient } from '@supabase/supabase-js';
import { Session, SessionItem, PaymentRecord, DailyExpense } from '../types';

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

    // 1. Ensure the station exists in Supabase stations table before inserting session
    try {
      await supabase.from('stations').upsert({
        id: stationId,
        name: session.stationName || (stationId === 'station-walk-in' ? 'Walk-in Snack Counter' : stationId),
        gaming_type: session.gamingType || 'pool',
        status: 'available',
        display_order: stationId === 'station-walk-in' ? 99 : 1,
      });
    } catch (stErr) {
      console.warn('Could not upsert station prerequisite:', stErr);
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
  let lastError: string | undefined = undefined;

  for (const s of sessions) {
    const res = await syncSessionToSupabase(s);
    if (res.success) {
      synced++;
    } else {
      failed++;
      if (res.error && !lastError) {
        lastError = res.error;
      }
    }
  }

  return { total: sessions.length, synced, failed, error: lastError };
}

function mapSupabaseRowToSession(row: any): Session {
  const items: SessionItem[] = Array.isArray(row.items)
    ? row.items.map((it: any) => ({
        id: it.id,
        sessionId: it.session_id,
        productId: it.product_id,
        name: it.name,
        quantity: it.quantity,
        unitPricePaise: it.unit_price_paise,
        lineTotalPaise: it.line_total_paise,
        isCustom: Boolean(it.is_custom),
      }))
    : [];

  let payment: PaymentRecord | undefined;
  const payRecord = Array.isArray(row.payment) ? row.payment[0] : row.payment;
  if (payRecord) {
    payment = {
      id: payRecord.id,
      sessionId: payRecord.session_id,
      method: payRecord.method,
      gpayAmountPaise: payRecord.gpay_amount_paise || 0,
      cashAmountPaise: payRecord.cash_amount_paise || 0,
      totalReceivedPaise: payRecord.total_received_paise || 0,
      finalBillPaise: payRecord.final_bill_paise || 0,
      outstandingBalancePaise: payRecord.outstanding_balance_paise || 0,
      recordedBy: payRecord.recorded_by || 'usr-admin-1',
      recordedByName: payRecord.recorded_by_name || 'Staff',
      timestamp: payRecord.timestamp,
      status: payRecord.status,
      notes: payRecord.notes,
    };
  }

  return {
    id: row.id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone || undefined,
    gamingType: row.gaming_type,
    stationId: row.station_id,
    stationName: row.station_name,
    billingType: row.billing_type,
    isMultiplayer: Boolean(row.is_multiplayer),
    fixedPlanId: row.fixed_plan_id || undefined,
    fixedPlanName: row.fixed_plan_name || undefined,
    framesCount: row.frames_count,
    startTime: row.start_time,
    endTime: row.end_time || null,
    durationMinutes: row.duration_minutes ?? null,
    status: row.status,
    rateSnapshot: row.rate_snapshot || {},
    gamingChargePaise: row.gaming_charge_paise || 0,
    items,
    snackSubtotalPaise: row.snack_subtotal_paise || 0,
    discountPaise: row.discount_paise || 0,
    discountReason: row.discount_reason || undefined,
    finalBillPaise: row.final_bill_paise || 0,
    payment,
    createdBy: row.created_by || 'usr-admin-1',
    createdByName: row.created_by_name || 'Staff',
    completedBy: row.completed_by || undefined,
    completedByName: row.completed_by_name || undefined,
    notes: row.notes || undefined,
    isVoided: Boolean(row.is_voided),
    voidReason: row.void_reason || undefined,
    voidedAt: row.voided_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetches all sessions from Supabase cloud database to synchronize across browsers and devices.
 */
export async function fetchSessionsFromSupabase(): Promise<{
  success: boolean;
  sessions?: Session[];
  error?: string;
}> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*, items:session_items(*), payment:payments(*)')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const sessions = (data || []).map(mapSupabaseRowToSession);
    return { success: true, sessions };
  } catch (err: any) {
    return { success: false, error: err.message || 'Fetch failed' };
  }
}

/**
 * Listens for real-time Supabase postgres changes to notify connected devices.
 */
export function subscribeToSupabaseSessions(onUpdate: () => void): () => void {
  if (!supabase || !isSupabaseConfigured) return () => {};

  try {
    const channel = supabase
      .channel('pos-sessions-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions' },
        () => {
          onUpdate();
        }
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
}

/**
 * Syncs a single daily expense to Supabase cloud.
 */
export async function syncExpenseToSupabase(expense: DailyExpense): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: 'Supabase not configured' };
  }
  try {
    const payload = {
      id: expense.id,
      date: expense.date,
      title: expense.title,
      category: expense.category,
      amount_paise: expense.amountPaise,
      payment_method: expense.paymentMethod,
      notes: expense.notes || null,
      receipt_number: expense.receiptNumber || null,
      recorded_by: isValidUUID(expense.recordedBy) ? expense.recordedBy : null,
      recorded_by_name: expense.recordedByName,
      created_at: expense.createdAt,
      updated_at: expense.updatedAt,
    };
    const { error } = await supabase.from('daily_expenses').upsert(payload);
    if (error) {
      console.warn('Could not sync expense to Supabase:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetches all daily expenses from Supabase cloud database.
 */
export async function fetchExpensesFromSupabase(): Promise<{
  success: boolean;
  expenses?: DailyExpense[];
  error?: string;
}> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: 'Supabase not configured' };
  }
  try {
    const { data, error } = await supabase
      .from('daily_expenses')
      .select('*')
      .order('date', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const expenses: DailyExpense[] = (data || []).map((row: any) => ({
      id: row.id,
      date: row.date,
      title: row.title,
      category: row.category,
      amountPaise: row.amount_paise,
      paymentMethod: row.payment_method,
      notes: row.notes || undefined,
      receiptNumber: row.receipt_number || undefined,
      recordedBy: row.recorded_by || 'usr-admin-1',
      recordedByName: row.recorded_by_name || 'Admin',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { success: true, expenses };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Deletes a daily expense record from Supabase cloud database.
 */
export async function deleteExpenseFromSupabase(
  expenseId: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: 'Supabase not configured' };
  }
  try {
    const { error } = await supabase.from('daily_expenses').delete().eq('id', expenseId);
    if (error) {
      console.warn('Could not delete expense from Supabase:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Bulk syncs an array of daily expenses to Supabase cloud.
 */
export async function syncAllExpensesToSupabase(
  expenses: DailyExpense[]
): Promise<{ synced: number; failed: number }> {
  if (!supabase || !isSupabaseConfigured || expenses.length === 0) {
    return { synced: 0, failed: 0 };
  }
  let synced = 0;
  let failed = 0;
  for (const exp of expenses) {
    const res = await syncExpenseToSupabase(exp);
    if (res.success) synced++;
    else failed++;
  }
  return { synced, failed };
}

