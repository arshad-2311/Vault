export type UserRole = 'admin' | 'employee';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export type GamingType = 'ps5' | 'pool';
export type BillingType = 'hourly' | 'fixed';
export type SessionStatus = 'active' | 'completed' | 'cancelled';
export type PaymentMethod = 'gpay' | 'cash' | 'split';
export type PaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERPAID_CHANGE_DUE' | 'VOIDED';

export interface Station {
  id: string;
  name: string;
  gamingType: GamingType;
  status: 'available' | 'occupied' | 'maintenance';
  activeSessionId?: string | null;
  displayOrder: number;
}

export interface SnackItem {
  id: string;
  name: string;
  category: string;
  pricePaise: number; // Integer paise (e.g. 4000 = ₹40.00)
  isActive: boolean;
}

export interface SessionItem {
  id: string;
  sessionId: string;
  productId?: string | null;
  name: string;
  quantity: number;
  unitPricePaise: number; // Historical price snapshot
  lineTotalPaise: number;
  isCustom: boolean;
}

export interface PaymentRecord {
  id: string;
  sessionId: string;
  method: PaymentMethod;
  gpayAmountPaise: number;
  cashAmountPaise: number;
  totalReceivedPaise: number;
  finalBillPaise: number;
  outstandingBalancePaise: number;
  changeDuePaise?: number; // Change returned to customer for cash overpayment
  discrepancyPaise?: number; // Explicit overpayment/discrepancy notes
  recordedBy: string;
  recordedByName: string;
  timestamp: string;
  status: PaymentStatus;
  notes?: string;
}

export interface FixedPricingPlan {
  id: string;
  name: string;
  gamingType: GamingType;
  durationMinutes: number;
  pricePaise: number;
}

export interface PricingConfig {
  id: string;
  businessName: string;
  businessTimezone: string;
  currencySymbol: string;
  ps5HourlyRatePaise: number; // e.g. 15000 = ₹150/hr
  ps5MultiplayerHourlyRatePaise: number; // e.g. 22000 = ₹220/hr
  ps5FixedPlans: FixedPricingPlan[];
  poolHourlyRatePaise: number; // e.g. 18000 = ₹180/hr
  poolPerFrameRatePaise: number; // e.g. 5000 = ₹50/frame
  roundingRule: 'exact' | 'nearest_5' | 'nearest_15' | 'ceiling_15';
  allowCustomSnacks: boolean;
  allowPartialPayments: boolean;
  maxEmployeeDiscountPaise: number; // e.g. 5000 = max ₹50 employee can apply without admin
}

export interface Session {
  id: string;
  customerName: string;
  customerPhone?: string;
  gamingType: GamingType;
  stationId: string;
  stationName: string;
  billingType: BillingType;
  isMultiplayer?: boolean; // for PS5 dual controllers
  fixedPlanId?: string;
  fixedPlanName?: string;
  framesCount?: number; // for pool per-frame billing
  startTime: string; // ISO string
  endTime?: string | null; // ISO string
  durationMinutes?: number | null;
  status: SessionStatus;
  rateSnapshot: {
    hourlyRatePaise?: number;
    fixedPricePaise?: number;
    description: string;
    roundingPolicy: string;
  };
  gamingChargePaise: number;
  items: SessionItem[];
  snackSubtotalPaise: number;
  discountPaise: number;
  discountReason?: string;
  finalBillPaise: number;
  payment?: PaymentRecord;
  createdBy: string;
  createdByName: string;
  completedBy?: string;
  completedByName?: string;
  notes?: string;
  isVoided?: boolean;
  voidReason?: string;
  voidedBy?: string;
  voidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CashDenominations {
  note500: number;
  note200: number;
  note100: number;
  note50: number;
  note20: number;
  note10: number;
  coins: number;
}

export interface DailyClosing {
  id: string;
  closingDate: string; // YYYY-MM-DD
  expectedCashPaise: number;
  countedCashPaise: number;
  cashVariancePaise: number; // Counted - Expected
  gpayTotalPaise: number;
  totalSalesPaise: number;
  denominations: CashDenominations;
  notes?: string;
  closedBy: string;
  closedByName: string;
  closedAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  entityType: 'session' | 'payment' | 'pricing' | 'snack' | 'closing' | 'user';
  entityId: string;
  details: string;
  timestamp: string;
  previousState?: any;
  newState?: any;
}

export interface DashboardMetrics {
  totalSalesPaise: number;
  gpayCollectionsPaise: number;
  cashCollectionsPaise: number;
  outstandingBalancePaise: number;
  totalEntriesCount: number;
  completedSessionsCount: number;
  activeSessionsCount: number;
  ps5RevenuePaise: number;
  poolRevenuePaise: number;
  snackRevenuePaise: number;
  averageTransactionValuePaise: number;
  salesByEmployee: Array<{
    employeeId: string;
    employeeName: string;
    sessionCount: number;
    totalSalesPaise: number;
    cashCollectedPaise: number;
    gpayCollectedPaise: number;
  }>;
}
