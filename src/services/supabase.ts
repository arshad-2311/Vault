import { createClient } from '@supabase/supabase-js';
import { Session, SessionItem, PaymentRecord, DailyExpense, SnackItem, PricingConfig } from '../types';

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

const isTest =
  typeof (globalThis as any).process !== 'undefined' &&
  Boolean((globalThis as any).process?.env?.VITEST || (globalThis as any).process?.env?.NODE_ENV === 'test');

const logWarn = (...args: any[]) => {
  if (!isTest) console.warn(...args);
};

const logError = (...args: any[]) => {
  if (!isTest) console.error(...args);
};

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
      logWarn('Could not upsert station prerequisite:', stErr);
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
      logWarn('Supabase session sync error:', sessionErr.message);
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
        logWarn('Supabase items sync warning:', itemsErr.message);
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
        logWarn('Supabase payment sync warning:', payErr.message);
      }
    }

    return { success: true };
  } catch (err: any) {
    logError('Failed to sync session to Supabase:', err);
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
      .order('created_at', { ascending: false })
      .limit(50);

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
      logWarn('Could not sync expense to Supabase:', error.message);
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
      logWarn('Could not delete expense from Supabase:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Bulk syncs an array of daily expenses to Supabase cloud in a single batch request.
 */
export async function syncAllExpensesToSupabase(
  expenses: DailyExpense[]
): Promise<{ synced: number; failed: number }> {
  if (!supabase || !isSupabaseConfigured || expenses.length === 0) {
    return { synced: 0, failed: 0 };
  }
  try {
    const payload = expenses.map((exp) => ({
      id: exp.id,
      date: exp.date,
      title: exp.title,
      category: exp.category,
      amount_paise: exp.amountPaise,
      payment_method: exp.paymentMethod,
      notes: exp.notes || null,
      receipt_number: exp.receiptNumber || null,
      recorded_by: isValidUUID(exp.recordedBy) ? exp.recordedBy : null,
      recorded_by_name: exp.recordedByName,
      created_at: exp.createdAt,
      updated_at: exp.updatedAt,
    }));
    const { error } = await supabase.from('daily_expenses').upsert(payload);
    if (error) {
      logWarn('Could not bulk sync expenses to Supabase:', error.message);
      return { synced: 0, failed: expenses.length };
    }
    return { synced: expenses.length, failed: 0 };
  } catch (err: any) {
    logWarn('Bulk sync expenses error:', err.message);
    return { synced: 0, failed: expenses.length };
  }
}

/**
 * Syncs a single snack/product to Supabase cloud.
 */
export async function syncSnackToSupabase(
  snack: SnackItem
): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: 'Supabase not configured' };
  }
  try {
    const payload = {
      id: snack.id,
      name: snack.name,
      category: snack.category || 'General',
      price_paise: snack.pricePaise,
      is_active: snack.isActive,
      stock: snack.stock !== undefined ? snack.stock : 100,
      low_stock_threshold: snack.lowStockThreshold !== undefined ? snack.lowStockThreshold : 5,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('products').upsert(payload);
    if (error) {
      logWarn('Could not sync snack to Supabase:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Deletes a snack/product from Supabase cloud database.
 */
export async function deleteSnackFromSupabase(
  snackId: string
): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: 'Supabase not configured' };
  }
  try {
    const { error } = await supabase.from('products').delete().eq('id', snackId);
    if (error) {
      logWarn('Could not delete snack from Supabase:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetches all snacks/products from Supabase cloud database.
 */
export async function fetchSnacksFromSupabase(): Promise<{
  success: boolean;
  snacks?: SnackItem[];
  error?: string;
}> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: 'Supabase not configured' };
  }
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    const snacks: SnackItem[] = (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      category: row.category || 'General',
      pricePaise: row.price_paise,
      isActive: row.is_active ?? true,
      stock: row.stock !== undefined && row.stock !== null ? row.stock : 100,
      lowStockThreshold: row.low_stock_threshold !== undefined && row.low_stock_threshold !== null ? row.low_stock_threshold : 5,
    }));

    return { success: true, snacks };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Bulk syncs an array of snacks to Supabase cloud database in a single batch request.
 */
export async function syncAllSnacksToSupabase(
  snacks: SnackItem[]
): Promise<{ synced: number; failed: number }> {
  if (!supabase || !isSupabaseConfigured || snacks.length === 0) {
    return { synced: 0, failed: 0 };
  }
  try {
    const payload = snacks.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category || 'General',
      price_paise: s.pricePaise,
      is_active: s.isActive,
      stock: s.stock !== undefined ? s.stock : 100,
      low_stock_threshold: s.lowStockThreshold !== undefined ? s.lowStockThreshold : 5,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('products').upsert(payload);
    if (error) {
      logWarn('Could not bulk sync snacks to Supabase:', error.message);
      return { synced: 0, failed: snacks.length };
    }
    return { synced: snacks.length, failed: 0 };
  } catch (err: any) {
    logWarn('Bulk sync snacks error:', err.message);
    return { synced: 0, failed: snacks.length };
  }
}

/**
 * Syncs business pricing configuration to Supabase cloud database.
 */
export async function syncPricingToSupabase(
  pricing: PricingConfig
): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: 'Supabase not configured' };
  }
  try {
    const payload = {
      id: 'cfg-default',
      business_name: pricing.businessName,
      business_timezone: pricing.businessTimezone,
      currency_symbol: pricing.currencySymbol || '₹',
      ps5_hourly_rate_paise: pricing.ps5HourlyRatePaise || pricing.ps5Rate1PlayerPaise || 15000,
      ps5_multiplayer_hourly_rate_paise: pricing.ps5MultiplayerHourlyRatePaise || pricing.ps5Rate2PlayersPaise || 22000,
      ps5_fixed_plans: pricing.ps5FixedPlans || [],
      pool_hourly_rate_paise: pricing.poolHourlyRatePaise || pricing.snookerHourlyRatePaise || 18000,
      pool_per_frame_rate_paise: pricing.poolPerFrameRatePaise || 5000,
      rounding_rule: pricing.roundingRule || 'nearest_5',
      allow_custom_snacks: pricing.allowCustomSnacks ?? true,
      allow_partial_payments: pricing.allowPartialPayments ?? true,
      max_employee_discount_paise: pricing.maxEmployeeDiscountPaise || 5000,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('pricing_config').upsert(payload);
    if (error) {
      logWarn('Could not sync pricing config to Supabase:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetches business pricing configuration from Supabase cloud database.
 */
export async function fetchPricingFromSupabase(): Promise<{
  success: boolean;
  pricing?: Partial<PricingConfig>;
  error?: string;
}> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: 'Supabase not configured' };
  }
  try {
    const { data, error } = await supabase
      .from('pricing_config')
      .select('*')
      .eq('id', 'cfg-default')
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    if (!data) return { success: false, error: 'No pricing config found' };

    const pricing: Partial<PricingConfig> = {
      id: 'cfg-default',
      businessName: data.business_name,
      businessTimezone: data.business_timezone,
      currencySymbol: data.currency_symbol,
      ps5HourlyRatePaise: data.ps5_hourly_rate_paise,
      ps5Rate1PlayerPaise: data.ps5_hourly_rate_paise,
      ps5MultiplayerHourlyRatePaise: data.ps5_multiplayer_hourly_rate_paise,
      ps5Rate2PlayersPaise: data.ps5_multiplayer_hourly_rate_paise,
      ps5FixedPlans: data.ps5_fixed_plans || [],
      poolHourlyRatePaise: data.pool_hourly_rate_paise,
      snookerHourlyRatePaise: data.pool_hourly_rate_paise,
      poolPerFrameRatePaise: data.pool_per_frame_rate_paise,
      roundingRule: data.rounding_rule,
      allowCustomSnacks: data.allow_custom_snacks,
      allowPartialPayments: data.allow_partial_payments,
      maxEmployeeDiscountPaise: data.max_employee_discount_paise,
    };

    return { success: true, pricing };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

