import {
  User,
  Station,
  SnackItem,
  PricingConfig,
  Session,
  DailyClosing,
  AuditLog,
  DashboardMetrics,
  PaymentRecord,
  SessionItem,
} from '../types';
import {
  calculateGamingCharge,
  calculateFinalBill,
  validatePaymentAmounts,
} from '../utils/pricing';
import { formatRupees, formatDateTime } from '../utils/formatters';

export interface UserCredential {
  userId: string;
  salt: string;
  hash: string;
}

export interface AuthSession {
  token: string;
  userId: string;
  role: 'admin' | 'employee';
  displayName: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  lastActivityAt: number;
  signature?: string;
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + ':' + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSecureToken(byteLength = 16): string {
  const arr = new Uint8Array(byteLength);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Precomputed salted SHA-256 hashes for standard accounts (Zero plaintext passwords)
export const INITIAL_CREDENTIALS: Record<string, UserCredential> = {
  'usr-admin-1': {
    userId: 'usr-admin-1',
    salt: 's4lt_v4ult_4dm1n_2026',
    hash: '12f8aff8d420cb332211d23c4da3dc3e62c862683415e9052238b0e785c8d623',
  },
  'usr-emp-1': {
    userId: 'usr-emp-1',
    salt: 's4lt_v4ult_3mp1_2026',
    hash: '7ec76a600619a875e6e2b5e56479900b074ddaa5c2d5a27262889456d3150322',
  },
  'usr-emp-2': {
    userId: 'usr-emp-2',
    salt: 's4lt_v4ult_3mp2_2026',
    hash: 'da97a05db58744f1922a8cf8e59f6c5d198a01f606bd9006857686e48d3e20ce',
  },
};

const STORAGE_KEYS = {
  USERS: 'vault_pos_users',
  CREDENTIALS: 'vault_pos_credentials',
  AUTH_SESSION: 'vault_pos_auth_session',
  RATE_LIMITS: 'vault_pos_rate_limits',
  STATIONS: 'vault_pos_stations',
  SNACKS: 'vault_pos_snacks',
  PRICING: 'vault_pos_pricing',
  SESSIONS: 'vault_pos_sessions',
  CLOSINGS: 'vault_pos_closings',
  AUDIT_LOGS: 'vault_pos_audit_logs',
  CURRENT_USER: 'vault_pos_current_user',
};

export const VAULT_DATA_CHANGED_EVENT = 'vault_pos_data_changed';

const inMemoryListeners = new Set<() => void>();

export function subscribeToDataChanges(callback: () => void): () => void {
  inMemoryListeners.add(callback);
  return () => inMemoryListeners.delete(callback);
}

export function emitDataChanged(): void {
  inMemoryListeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VAULT_DATA_CHANGED_EVENT));
  }
}

// Initial default seed configuration
export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  id: 'cfg-default',
  businessName: 'Vault Gaming Centre & Snooker Lounge',
  businessTimezone: 'Asia/Kolkata',
  currencySymbol: '₹',
  ps5HourlyRatePaise: 15000, // ₹150.00 / hr (1 Player)
  ps5MultiplayerHourlyRatePaise: 30000, // ₹300.00 / hr (2 Players fallback)
  ps5Rate1PlayerPaise: 15000, // ₹150.00 / hr (1 Controller)
  ps5Rate2PlayersPaise: 30000, // ₹300.00 / hr (2 Controllers)
  ps5Rate3PlayersPaise: 40000, // ₹400.00 / hr (3 Controllers)
  ps5Rate4PlayersPaise: 50000, // ₹500.00 / hr (4 Controllers)
  ps5FixedPlans: [
    { id: 'plan-30m', name: '30-Min Rush Pass', gamingType: 'ps5', durationMinutes: 30, pricePaise: 8000 },
    { id: 'plan-1h', name: '1-Hour Fixed Pass', gamingType: 'ps5', durationMinutes: 60, pricePaise: 15000 },
    { id: 'plan-2h', name: '2-Hour Power Pack', gamingType: 'ps5', durationMinutes: 120, pricePaise: 28000 },
  ],
  poolHourlyRatePaise: 25000, // ₹250.00 / hr (Snooker: Mon-Sun)
  snookerHourlyRatePaise: 25000, // ₹250.00 / hr
  poolPerFrameRatePaise: 5000, // ₹50.00 / frame
  roundingRule: 'nearest_5',
  allowCustomSnacks: true,
  allowPartialPayments: true,
  maxEmployeeDiscountPaise: 5000, // Max ₹50 without admin approval
};

export const INITIAL_STATIONS: Station[] = [
  { id: 'ps5-1', name: 'PS5 Station 01 (4K OLED)', gamingType: 'ps5', status: 'occupied', activeSessionId: 'sess-active-1', displayOrder: 1 },
  { id: 'ps5-2', name: 'PS5 Station 02 (4K OLED)', gamingType: 'ps5', status: 'available', activeSessionId: null, displayOrder: 2 },
  { id: 'ps5-3', name: 'PS5 Station 03 (Gaming Chair)', gamingType: 'ps5', status: 'available', activeSessionId: null, displayOrder: 3 },
  { id: 'pool-1', name: 'Snooker Table 01 (Tournament)', gamingType: 'pool', status: 'occupied', activeSessionId: 'sess-active-2', displayOrder: 4 },
  { id: 'pool-2', name: 'Snooker Table 02 (Match Table)', gamingType: 'pool', status: 'available', activeSessionId: null, displayOrder: 5 },
  { id: 'pool-3', name: 'Snooker Table 03 (Classic Table)', gamingType: 'pool', status: 'available', activeSessionId: null, displayOrder: 6 },
];

export const INITIAL_USERS: User[] = [
  {
    id: 'usr-admin-1',
    email: 'admin@vaultgaming.in',
    displayName: 'Vikram Sethi (Admin)',
    role: 'admin',
    isActive: true,
    createdAt: '2026-10-01T10:00:00Z',
    lastLoginAt: new Date().toISOString(),
  },
  {
    id: 'usr-emp-1',
    email: 'rahul@vaultgaming.in',
    displayName: 'Rahul Sharma (Counter Staff)',
    role: 'employee',
    isActive: true,
    createdAt: '2026-10-05T10:00:00Z',
    lastLoginAt: new Date().toISOString(),
  },
  {
    id: 'usr-emp-2',
    email: 'priya@vaultgaming.in',
    displayName: 'Priya Patel (Floor Manager)',
    role: 'employee',
    isActive: true,
    createdAt: '2026-10-10T10:00:00Z',
    lastLoginAt: new Date().toISOString(),
  },
];

export const INITIAL_SNACKS: SnackItem[] = [
  { id: 'snk-1', name: 'Red Bull Energy Drink (250ml)', category: 'Beverages', pricePaise: 12500, isActive: true, stock: 24, lowStockThreshold: 5 },
  { id: 'snk-2', name: 'Mountain Dew Can (300ml)', category: 'Beverages', pricePaise: 4000, isActive: true, stock: 30, lowStockThreshold: 5 },
  { id: 'snk-3', name: 'Coca-Cola Zero Can (300ml)', category: 'Beverages', pricePaise: 4000, isActive: true, stock: 18, lowStockThreshold: 5 },
  { id: 'snk-4', name: 'Kinley Mineral Water (500ml)', category: 'Beverages', pricePaise: 2000, isActive: true, stock: 50, lowStockThreshold: 10 },
  { id: 'snk-5', name: "Lay's Magic Masala (Large)", category: 'Chips & Savouries', pricePaise: 3000, isActive: true, stock: 12, lowStockThreshold: 5 },
  { id: 'snk-6', name: 'Doritos Cheese Supreme (75g)', category: 'Chips & Savouries', pricePaise: 5000, isActive: true, stock: 4, lowStockThreshold: 5 },
  { id: 'snk-7', name: 'Snickers Chocolate Bar', category: 'Chocolates', pricePaise: 5000, isActive: true, stock: 3, lowStockThreshold: 5 },
  { id: 'snk-8', name: 'Maggi Masala Double Bowl', category: 'Hot Items', pricePaise: 6000, isActive: true, stock: 15, lowStockThreshold: 5 },
];

function generateInitialSessions(): Session[] {
  const now = new Date();
  const todayMorning = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();
  const todayNoon = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const fortyFiveMinsAgo = new Date(now.getTime() - 45 * 60 * 1000).toISOString();
  const twentyMinsAgo = new Date(now.getTime() - 20 * 60 * 1000).toISOString();

  return [
    // Completed Session 1 (Today: PS5 2 hours + snacks, Split payment ₹200 GPay + ₹100 Cash)
    {
      id: 'sess-comp-1',
      customerName: 'Aman Verma',
      customerPhone: '9876543210',
      gamingType: 'ps5',
      stationId: 'ps5-2',
      stationName: 'PS5 Station 02 (4K OLED)',
      billingType: 'hourly',
      isMultiplayer: false,
      startTime: todayMorning,
      endTime: new Date(new Date(todayMorning).getTime() + 60 * 60 * 1000).toISOString(),
      durationMinutes: 60,
      status: 'completed',
      rateSnapshot: {
        hourlyRatePaise: 15000,
        description: 'PS5 Single Player',
        roundingPolicy: 'nearest_5',
      },
      gamingChargePaise: 15000, // ₹150
      items: [
        {
          id: 'item-1',
          sessionId: 'sess-comp-1',
          productId: 'snk-1',
          name: 'Red Bull Energy Drink (250ml)',
          quantity: 1,
          unitPricePaise: 12500,
          lineTotalPaise: 12500,
          isCustom: false,
        },
        {
          id: 'item-2',
          sessionId: 'sess-comp-1',
          productId: 'snk-5',
          name: "Lay's Magic Masala (Large)",
          quantity: 1,
          unitPricePaise: 2500, // historical price test
          lineTotalPaise: 2500,
          isCustom: false,
        },
      ],
      snackSubtotalPaise: 15000, // ₹150
      discountPaise: 0,
      finalBillPaise: 30000, // ₹300 total
      payment: {
        id: 'pay-1',
        sessionId: 'sess-comp-1',
        method: 'split',
        gpayAmountPaise: 20000, // ₹200 GPay
        cashAmountPaise: 10000, // ₹100 Cash
        totalReceivedPaise: 30000,
        finalBillPaise: 30000,
        outstandingBalancePaise: 0,
        recordedBy: 'usr-emp-1',
        recordedByName: 'Rahul Sharma',
        timestamp: todayNoon,
        status: 'PAID',
      },
      createdBy: 'usr-emp-1',
      createdByName: 'Rahul Sharma',
      completedBy: 'usr-emp-1',
      completedByName: 'Rahul Sharma',
      notes: 'Requested FIFA 24 co-op setup',
      createdAt: todayMorning,
      updatedAt: todayNoon,
    },
    // Completed Session 2 (Snooker table 1 hour, Full GPay)
    {
      id: 'sess-comp-2',
      customerName: 'Karan Mehra',
      customerPhone: '9822334455',
      gamingType: 'pool',
      stationId: 'pool-2',
      stationName: 'Snooker Table 02 (Match Table)',
      billingType: 'hourly',
      startTime: new Date(now.getTime() - 150 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() - 90 * 60 * 1000).toISOString(),
      durationMinutes: 60,
      status: 'completed',
      rateSnapshot: {
        hourlyRatePaise: 25000,
        description: 'Snooker Table',
        roundingPolicy: 'nearest_5',
      },
      gamingChargePaise: 18000,
      items: [
        {
          id: 'item-3',
          sessionId: 'sess-comp-2',
          productId: 'snk-4',
          name: 'Kinley Mineral Water (500ml)',
          quantity: 2,
          unitPricePaise: 2000,
          lineTotalPaise: 4000,
          isCustom: false,
        },
      ],
      snackSubtotalPaise: 4000,
      discountPaise: 2000, // ₹20 promo discount
      discountReason: 'Happy Hour Welcome Discount',
      finalBillPaise: 20000, // ₹200
      payment: {
        id: 'pay-2',
        sessionId: 'sess-comp-2',
        method: 'gpay',
        gpayAmountPaise: 20000,
        cashAmountPaise: 0,
        totalReceivedPaise: 20000,
        finalBillPaise: 20000,
        outstandingBalancePaise: 0,
        recordedBy: 'usr-emp-2',
        recordedByName: 'Priya Patel',
        timestamp: new Date(now.getTime() - 90 * 60 * 1000).toISOString(),
        status: 'PAID',
      },
      createdBy: 'usr-emp-2',
      createdByName: 'Priya Patel',
      completedBy: 'usr-emp-2',
      completedByName: 'Priya Patel',
      createdAt: new Date(now.getTime() - 150 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 90 * 60 * 1000).toISOString(),
    },
    // Completed Session 3 (PS5 Fixed Plan, Full Cash)
    {
      id: 'sess-comp-3',
      customerName: 'Aditya & Friends',
      customerPhone: '9811223344',
      gamingType: 'ps5',
      stationId: 'ps5-3',
      stationName: 'PS5 Station 03 (Gaming Chair)',
      billingType: 'fixed',
      fixedPlanId: 'plan-1h',
      fixedPlanName: '1-Hour Fixed Pass',
      startTime: new Date(now.getTime() - 80 * 60 * 1000).toISOString(),
      endTime: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
      durationMinutes: 60,
      status: 'completed',
      rateSnapshot: {
        fixedPricePaise: 14000,
        description: 'Fixed Plan: 1-Hour Fixed Pass',
        roundingPolicy: 'fixed',
      },
      gamingChargePaise: 14000,
      items: [
        {
          id: 'item-4',
          sessionId: 'sess-comp-3',
          productId: 'snk-8',
          name: 'Maggi Masala Double Bowl',
          quantity: 1,
          unitPricePaise: 6000,
          lineTotalPaise: 6000,
          isCustom: false,
        },
      ],
      snackSubtotalPaise: 6000,
      discountPaise: 0,
      finalBillPaise: 20000, // ₹200
      payment: {
        id: 'pay-3',
        sessionId: 'sess-comp-3',
        method: 'cash',
        gpayAmountPaise: 0,
        cashAmountPaise: 20000, // ₹200 cash
        totalReceivedPaise: 20000,
        finalBillPaise: 20000,
        outstandingBalancePaise: 0,
        recordedBy: 'usr-emp-1',
        recordedByName: 'Rahul Sharma',
        timestamp: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
        status: 'PAID',
      },
      createdBy: 'usr-emp-1',
      createdByName: 'Rahul Sharma',
      completedBy: 'usr-emp-1',
      completedByName: 'Rahul Sharma',
      createdAt: new Date(now.getTime() - 80 * 60 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 20 * 60 * 1000).toISOString(),
    },
    // Active Session 1 (PS5-1 running for ~45 mins)
    {
      id: 'sess-active-1',
      customerName: 'Rohan Kapoor',
      customerPhone: '9711223344',
      gamingType: 'ps5',
      stationId: 'ps5-1',
      stationName: 'PS5 Station 01 (4K OLED)',
      billingType: 'hourly',
      controllersCount: 2,
      isMultiplayer: true,
      startTime: fortyFiveMinsAgo,
      endTime: null,
      status: 'active',
      rateSnapshot: {
        hourlyRatePaise: 30000,
        description: 'PS5 (2 Controllers / 2 Players)',
        roundingPolicy: 'nearest_5',
      },
      gamingChargePaise: 22500, // live estimated
      items: [
        {
          id: 'item-active-1',
          sessionId: 'sess-active-1',
          productId: 'snk-2',
          name: 'Mountain Dew Can (300ml)',
          quantity: 2,
          unitPricePaise: 4000,
          lineTotalPaise: 8000,
          isCustom: false,
        },
      ],
      snackSubtotalPaise: 8000,
      discountPaise: 0,
      finalBillPaise: 30500,
      createdBy: 'usr-emp-1',
      createdByName: 'Rahul Sharma',
      notes: 'Playing Tekken 8 Tournament with 2 controllers',
      createdAt: fortyFiveMinsAgo,
      updatedAt: fortyFiveMinsAgo,
    },
    // Active Session 2 (Snooker-1 running for ~20 mins)
    {
      id: 'sess-active-2',
      customerName: 'Samir & Bilal',
      customerPhone: '9844556677',
      gamingType: 'pool',
      stationId: 'pool-1',
      stationName: 'Snooker Table 01 (Tournament)',
      billingType: 'hourly',
      startTime: twentyMinsAgo,
      endTime: null,
      status: 'active',
      rateSnapshot: {
        hourlyRatePaise: 25000,
        description: 'Snooker Table',
        roundingPolicy: 'nearest_5',
      },
      gamingChargePaise: 8500,
      items: [],
      snackSubtotalPaise: 0,
      discountPaise: 0,
      finalBillPaise: 8500,
      createdBy: 'usr-emp-2',
      createdByName: 'Priya Patel',
      notes: 'Brought their own professional cues',
      createdAt: twentyMinsAgo,
      updatedAt: twentyMinsAgo,
    },
  ];
}

// Safe storage adapter (supports browser localStorage & in-memory Node/test environments)
const memoryStore = new Map<string, string>();
const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {}
    return memoryStore.get(key) || null;
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch {}
    memoryStore.set(key, value);
  },
  clear: (): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
      }
    } catch {}
    memoryStore.clear();
  },
};

// Storage helpers with JSON fallbacks
class PosStorageEngine {
  private inFlightCheckouts = new Set<string>();

  constructor() {
    this.init();
  }

  private getRateLimits(): Record<string, { count: number; lockedUntil: number | null }> {
    const raw = safeStorage.getItem(STORAGE_KEYS.RATE_LIMITS);
    return raw ? JSON.parse(raw) : {};
  }

  private saveRateLimits(limits: Record<string, { count: number; lockedUntil: number | null }>): void {
    safeStorage.setItem(STORAGE_KEYS.RATE_LIMITS, JSON.stringify(limits));
  }

  private init() {
    if (!safeStorage.getItem(STORAGE_KEYS.USERS)) {
      safeStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    }
    if (!safeStorage.getItem(STORAGE_KEYS.CREDENTIALS)) {
      safeStorage.setItem(STORAGE_KEYS.CREDENTIALS, JSON.stringify(INITIAL_CREDENTIALS));
    }
    const stationsRaw = safeStorage.getItem(STORAGE_KEYS.STATIONS);
    if (!stationsRaw) {
      safeStorage.setItem(STORAGE_KEYS.STATIONS, JSON.stringify(INITIAL_STATIONS));
    } else {
      try {
        const parsed = JSON.parse(stationsRaw);
        if (parsed.some((s: any) => s.id === 'ps5-4') || !parsed.some((s: any) => s.id === 'pool-3')) {
          safeStorage.setItem(STORAGE_KEYS.STATIONS, JSON.stringify(INITIAL_STATIONS));
        }
      } catch {}
    }
    if (!safeStorage.getItem(STORAGE_KEYS.SNACKS)) {
      safeStorage.setItem(STORAGE_KEYS.SNACKS, JSON.stringify(INITIAL_SNACKS));
    }
    const pricingRaw = safeStorage.getItem(STORAGE_KEYS.PRICING);
    if (!pricingRaw) {
      safeStorage.setItem(STORAGE_KEYS.PRICING, JSON.stringify(DEFAULT_PRICING_CONFIG));
    } else {
      try {
        const parsed = JSON.parse(pricingRaw);
        if (!parsed.ps5Rate1PlayerPaise || !parsed.snookerHourlyRatePaise) {
          safeStorage.setItem(
            STORAGE_KEYS.PRICING,
            JSON.stringify({ ...DEFAULT_PRICING_CONFIG, ...parsed })
          );
        }
      } catch {}
    }
    if (!safeStorage.getItem(STORAGE_KEYS.SESSIONS)) {
      safeStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(generateInitialSessions()));
    }
    if (!safeStorage.getItem(STORAGE_KEYS.CLOSINGS)) {
      safeStorage.setItem(STORAGE_KEYS.CLOSINGS, JSON.stringify([]));
    }
    if (!safeStorage.getItem(STORAGE_KEYS.AUDIT_LOGS)) {
      const initialLogs: AuditLog[] = [
        {
          id: 'log-init-1',
          actorId: 'usr-admin-1',
          actorName: 'Vikram Sethi (Admin)',
          actorRole: 'admin',
          action: 'SYSTEM_INITIALIZED',
          entityType: 'pricing',
          entityId: 'cfg-default',
          details: 'Initialized POS with default rates and 6 gaming stations',
          timestamp: new Date().toISOString(),
        },
      ];
      safeStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(initialLogs));
    }
    if (!safeStorage.getItem(STORAGE_KEYS.CURRENT_USER)) {
      safeStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(INITIAL_USERS[0]));
    }
  }

  // --- AUTHENTICATION & SESSION MANAGEMENT ---
  async authenticateUser(email: string, password: string): Promise<User> {
    const normalizedEmail = email.trim().toLowerCase();
    const now = Date.now();
    const rateLimits = this.getRateLimits();
    const attemptRecord = rateLimits[normalizedEmail] || { count: 0, lockedUntil: null };

    // Check rate limit lockout (persists across page reloads and browser sessions)
    if (attemptRecord.lockedUntil && now < attemptRecord.lockedUntil) {
      const remainingSecs = Math.ceil((attemptRecord.lockedUntil - now) / 1000);
      throw new Error(`Too many failed login attempts. Account temporarily locked for ${remainingSecs} seconds.`);
    }

    const users = this.getUsers();
    const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (!user || !user.isActive) {
      attemptRecord.count += 1;
      if (attemptRecord.count >= 5) {
        attemptRecord.lockedUntil = now + 60 * 1000;
      }
      rateLimits[normalizedEmail] = attemptRecord;
      this.saveRateLimits(rateLimits);
      this.addAuditLog({
        actorId: 'system',
        actorName: 'Security Gate',
        actorRole: 'admin',
        action: 'LOGIN_FAILED',
        entityType: 'auth',
        entityId: normalizedEmail,
        details: `Failed login attempt for unknown or deactivated account: ${normalizedEmail} (Attempt ${attemptRecord.count})`,
      });
      if (attemptRecord.count >= 3 && attemptRecord.count < 5) {
        await new Promise((r) => setTimeout(r, (attemptRecord.count - 2) * 800));
      }
      throw new Error('Invalid email or password.');
    }

    const credentialsRaw = safeStorage.getItem(STORAGE_KEYS.CREDENTIALS);
    const credentialsMap: Record<string, UserCredential> = credentialsRaw ? JSON.parse(credentialsRaw) : INITIAL_CREDENTIALS;
    const userCred = credentialsMap[user.id];

    let isValid = false;
    if (userCred) {
      const candidateHash = await hashPassword(password, userCred.salt);
      isValid = candidateHash === userCred.hash;
    }

    if (!isValid) {
      attemptRecord.count += 1;
      if (attemptRecord.count >= 5) {
        attemptRecord.lockedUntil = now + 60 * 1000;
        rateLimits[normalizedEmail] = attemptRecord;
        this.saveRateLimits(rateLimits);
        this.addAuditLog({
          actorId: user.id,
          actorName: user.displayName,
          actorRole: user.role,
          action: 'ACCOUNT_LOCKED',
          entityType: 'auth',
          entityId: user.id,
          details: `Account ${user.email} locked for 60 seconds after 5 consecutive failed login attempts.`,
        });
        throw new Error('Too many failed login attempts. Account locked for 60 seconds.');
      }
      rateLimits[normalizedEmail] = attemptRecord;
      this.saveRateLimits(rateLimits);
      this.addAuditLog({
        actorId: user.id,
        actorName: user.displayName,
        actorRole: user.role,
        action: 'LOGIN_FAILED',
        entityType: 'auth',
        entityId: user.id,
        details: `Failed password authentication for ${user.email} (Attempt ${attemptRecord.count} of 5)`,
      });
      if (attemptRecord.count >= 3) {
        await new Promise((r) => setTimeout(r, (attemptRecord.count - 2) * 800));
      }
      throw new Error(`Invalid email or password. Attempt ${attemptRecord.count} of 5 before temporary lockout.`);
    }

    // Success: Clear failed attempts
    delete rateLimits[normalizedEmail];
    this.saveRateLimits(rateLimits);

    // Update lastLoginAt
    user.lastLoginAt = new Date().toISOString();
    const uIndex = users.findIndex((u) => u.id === user.id);
    if (uIndex !== -1) {
      users[uIndex] = user;
      safeStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    }

    // Create cryptographically signed auth session
    const sessionToken = generateSecureToken(16);
    const signature = await hashPassword(
      `${sessionToken}:${user.id}:${user.role}:${user.email}`,
      userCred.salt
    );
    const authSession: AuthSession = {
      token: sessionToken,
      userId: user.id,
      role: user.role,
      displayName: user.displayName,
      email: user.email,
      createdAt: now,
      expiresAt: now + 8 * 60 * 60 * 1000, // 8-hour maximum lifetime
      lastActivityAt: now,
      signature,
    };
    safeStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(authSession));
    safeStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));

    this.addAuditLog({
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      action: 'USER_LOGIN',
      entityType: 'auth',
      entityId: user.id,
      details: `User ${user.displayName} (${user.role.toUpperCase()}) authenticated successfully via secure password verification.`,
    });

    emitDataChanged();
    return user;
  }

  getAuthSession(): AuthSession | null {
    const raw = safeStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
    if (!raw) return null;
    try {
      const session: AuthSession = JSON.parse(raw);
      const now = Date.now();
      // 8-hour max session lifespan
      if (now > session.expiresAt) {
        this.clearAuthSession('Session expired after 8-hour duration limit.');
        return null;
      }
      // 60-minute inactivity limit
      if (now - session.lastActivityAt > 60 * 60 * 1000) {
        this.clearAuthSession('Session expired due to 60 minutes of inactivity.');
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  async verifySessionIntegrity(session: AuthSession): Promise<boolean> {
    if (!session || !session.signature) return false;
    const credsRaw = safeStorage.getItem(STORAGE_KEYS.CREDENTIALS);
    const credsMap: Record<string, UserCredential> = credsRaw ? JSON.parse(credsRaw) : INITIAL_CREDENTIALS;
    const userCred = credsMap[session.userId];
    if (!userCred) return false;

    const expectedSig = await hashPassword(
      `${session.token}:${session.userId}:${session.role}:${session.email}`,
      userCred.salt
    );
    const isAuthentic = expectedSig === session.signature;
    if (!isAuthentic) {
      this.addAuditLog({
        actorId: session.userId,
        actorName: session.displayName || 'Unknown',
        actorRole: session.role || 'employee',
        action: 'SECURITY_ALERT',
        entityType: 'auth',
        entityId: session.userId,
        details: `Cryptographic session signature mismatch! Tampered session rejected for ${session.email} claiming role ${session.role}.`,
      });
    }
    return isAuthentic;
  }

  touchSessionActivity(): void {
    const raw = safeStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
    if (raw) {
      try {
        const session: AuthSession = JSON.parse(raw);
        session.lastActivityAt = Date.now();
        safeStorage.setItem(STORAGE_KEYS.AUTH_SESSION, JSON.stringify(session));
      } catch {}
    }
  }

  clearAuthSession(reason?: string): void {
    const raw = safeStorage.getItem(STORAGE_KEYS.AUTH_SESSION);
    if (raw) {
      try {
        const session: AuthSession = JSON.parse(raw);
        this.addAuditLog({
          actorId: session.userId,
          actorName: session.displayName,
          actorRole: session.role,
          action: 'USER_LOGOUT',
          entityType: 'auth',
          entityId: session.userId,
          details: reason || `User ${session.displayName} signed out of POS session.`,
        });
      } catch {}
    }
    safeStorage.setItem(STORAGE_KEYS.AUTH_SESSION, '');
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(STORAGE_KEYS.AUTH_SESSION);
      } catch {}
    }
    emitDataChanged();
  }

  // --- CURRENT USER ---
  getCurrentUser(): User {
    const session = this.getAuthSession();
    if (session) {
      const user = this.getUsers().find((u) => u.id === session.userId);
      if (user && user.isActive) return user;
    }
    const raw = safeStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (!raw) return INITIAL_USERS[0];
    try {
      return JSON.parse(raw);
    } catch {
      return INITIAL_USERS[0];
    }
  }

  setCurrentUser(user: User): void {
    safeStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    this.addAuditLog({
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      action: 'USER_SWITCH',
      entityType: 'user',
      entityId: user.id,
      details: `Switched active profile to ${user.displayName} (${user.role.toUpperCase()})`,
    });
  }

  // --- USERS ---
  getUsers(): User[] {
    const raw = safeStorage.getItem(STORAGE_KEYS.USERS);
    return raw ? JSON.parse(raw) : INITIAL_USERS;
  }

  createUser(userData: Omit<User, 'id' | 'createdAt'>, actor: User): User {
    if (actor.role !== 'admin') {
      throw new Error('Permission denied: Only administrators can create new users.');
    }
    const users = this.getUsers();
    if (users.some((u) => u.email.toLowerCase() === userData.email.toLowerCase())) {
      throw new Error(`A user with email ${userData.email} already exists.`);
    }

    const newUser: User = {
      ...userData,
      id: `usr-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    safeStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    // Store default salted hash for new employee account
    const credsRaw = safeStorage.getItem(STORAGE_KEYS.CREDENTIALS);
    const credsMap: Record<string, UserCredential> = credsRaw ? JSON.parse(credsRaw) : { ...INITIAL_CREDENTIALS };
    credsMap[newUser.id] = {
      userId: newUser.id,
      salt: 's4lt_v4ult_3mp1_2026',
      hash: '7ec76a600619a875e6e2b5e56479900b074ddaa5c2d5a27262889456d3150322',
    };
    safeStorage.setItem(STORAGE_KEYS.CREDENTIALS, JSON.stringify(credsMap));

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: newUser.id,
      details: `Created new employee account: ${newUser.displayName} (${newUser.email}) with role ${newUser.role}`,
    });

    return newUser;
  }

  async createUserWithPassword(
    userData: Omit<User, 'id' | 'createdAt'>,
    password: string,
    actor: User
  ): Promise<User> {
    if (actor.role !== 'admin') {
      throw new Error('Permission denied: Only administrators can create new users.');
    }
    if (!password || password.trim().length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }
    const users = this.getUsers();
    if (users.some((u) => u.email.toLowerCase() === userData.email.toLowerCase())) {
      throw new Error(`A user with email ${userData.email} already exists.`);
    }

    const salt = generateSecureToken(16);
    const hash = await hashPassword(password.trim(), salt);

    const newUser: User = {
      ...userData,
      id: `usr-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    safeStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    const credsRaw = safeStorage.getItem(STORAGE_KEYS.CREDENTIALS);
    const credsMap: Record<string, UserCredential> = credsRaw ? JSON.parse(credsRaw) : { ...INITIAL_CREDENTIALS };
    credsMap[newUser.id] = {
      userId: newUser.id,
      salt,
      hash,
    };
    safeStorage.setItem(STORAGE_KEYS.CREDENTIALS, JSON.stringify(credsMap));

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: newUser.id,
      details: `Created new staff account: ${newUser.displayName} (${newUser.email}) with role ${newUser.role} (secured with salted SHA-256 hash)`,
    });

    return newUser;
  }

  updateUserRole(userId: string, newRole: 'admin' | 'employee', actor: User): User {
    if (actor.role !== 'admin') {
      throw new Error('Permission denied: Only administrators can modify user roles.');
    }
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) throw new Error('User not found.');

    const oldUser = users[index];
    const updatedUser = { ...oldUser, role: newRole };
    users[index] = updatedUser;
    safeStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'USER_ROLE_CHANGED',
      entityType: 'user',
      entityId: userId,
      details: `Changed role of ${oldUser.displayName} from ${oldUser.role} to ${newRole}`,
      previousState: { role: oldUser.role },
      newState: { role: newRole },
    });

    return updatedUser;
  }

  toggleUserStatus(userId: string, actor: User): User {
    if (actor.role !== 'admin') {
      throw new Error('Permission denied: Only administrators can activate/deactivate users.');
    }
    if (userId === actor.id) {
      throw new Error('Safety protection: You cannot deactivate your own account.');
    }
    const users = this.getUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) throw new Error('User not found.');

    const oldUser = users[index];
    const newStatus = !oldUser.isActive;
    const updatedUser = { ...oldUser, isActive: newStatus };
    users[index] = updatedUser;
    safeStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: newStatus ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'user',
      entityId: userId,
      details: `${newStatus ? 'Activated' : 'Deactivated'} user account: ${oldUser.displayName}`,
    });

    return updatedUser;
  }

  // --- STATIONS ---
  getStations(): Station[] {
    const raw = safeStorage.getItem(STORAGE_KEYS.STATIONS);
    const stations: Station[] = raw ? JSON.parse(raw) : INITIAL_STATIONS;

    // Single source of truth: synchronize station status with actual active sessions
    const sessionsRaw = safeStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (!sessionsRaw) return stations;

    try {
      const sessions: Session[] = JSON.parse(sessionsRaw);
      const activeByStation = new Map<string, Session>();
      sessions.forEach((s) => {
        if (s.status === 'active') {
          activeByStation.set(s.stationId, s);
        }
      });

      let modified = false;
      const synced = stations.map((st) => {
        if (st.status === 'maintenance') return st;
        const active = activeByStation.get(st.id);
        if (active) {
          if (st.status !== 'occupied' || st.activeSessionId !== active.id) {
            modified = true;
            return { ...st, status: 'occupied' as const, activeSessionId: active.id };
          }
        } else {
          if (st.status === 'occupied' || st.activeSessionId) {
            modified = true;
            return { ...st, status: 'available' as const, activeSessionId: null };
          }
        }
        return st;
      });

      if (modified) {
        safeStorage.setItem(STORAGE_KEYS.STATIONS, JSON.stringify(synced));
      }
      return synced;
    } catch {
      return stations;
    }
  }

  updateStation(stationId: string, updates: Partial<Station>): void {
    const stations = this.getStations();
    const index = stations.findIndex((s) => s.id === stationId);
    if (index !== -1) {
      stations[index] = { ...stations[index], ...updates };
      safeStorage.setItem(STORAGE_KEYS.STATIONS, JSON.stringify(stations));
      emitDataChanged();
    }
  }

  // --- SNACKS ---
  getSnacks(): SnackItem[] {
    const raw = safeStorage.getItem(STORAGE_KEYS.SNACKS);
    const list: SnackItem[] = raw ? JSON.parse(raw) : INITIAL_SNACKS;
    return list.map((s) => ({
      ...s,
      stock: s.stock !== undefined ? s.stock : 20,
      lowStockThreshold: s.lowStockThreshold !== undefined ? s.lowStockThreshold : 5,
    }));
  }

  createSnack(snackData: Omit<SnackItem, 'id'>, actor: User): SnackItem {
    if (actor.role !== 'admin') {
      throw new Error('Permission denied: Only administrators can add items to the catalogue.');
    }
    const snacks = this.getSnacks();
    const newSnack: SnackItem = {
      ...snackData,
      id: `snk-${Date.now()}`,
    };
    snacks.push(newSnack);
    safeStorage.setItem(STORAGE_KEYS.SNACKS, JSON.stringify(snacks));

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'SNACK_CREATED',
      entityType: 'snack',
      entityId: newSnack.id,
      details: `Added new snack: ${newSnack.name} at ₹${(newSnack.pricePaise / 100).toFixed(2)}`,
    });

    return newSnack;
  }

  updateSnack(snackId: string, updates: Partial<SnackItem>, actor: User): SnackItem {
    if (actor.role !== 'admin') {
      throw new Error('Permission denied: Only administrators can update catalogue prices.');
    }
    const snacks = this.getSnacks();
    const index = snacks.findIndex((s) => s.id === snackId);
    if (index === -1) throw new Error('Snack item not found.');

    const oldSnack = snacks[index];
    const updated = { ...oldSnack, ...updates };
    snacks[index] = updated;
    safeStorage.setItem(STORAGE_KEYS.SNACKS, JSON.stringify(snacks));

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'SNACK_UPDATED',
      entityType: 'snack',
      entityId: snackId,
      details: `Updated snack ${updated.name}: Price ₹${(updated.pricePaise / 100).toFixed(2)} (Previous: ₹${(oldSnack.pricePaise / 100).toFixed(2)})`,
      previousState: oldSnack,
      newState: updated,
    });

    return updated;
  }

  deleteSnack(snackId: string, actor: User): void {
    if (actor.role !== 'admin') {
      throw new Error('Permission denied: Only administrators can delete catalogue items.');
    }
    const snacks = this.getSnacks();
    const index = snacks.findIndex((s) => s.id === snackId);
    if (index === -1) throw new Error('Snack item not found.');

    const deleted = snacks[index];
    snacks.splice(index, 1);
    safeStorage.setItem(STORAGE_KEYS.SNACKS, JSON.stringify(snacks));

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'SNACK_DELETED',
      entityType: 'snack',
      entityId: snackId,
      details: `Deleted snack item: ${deleted.name} from catalogue`,
      previousState: deleted,
    });

    emitDataChanged();
  }

  // --- PRICING CONFIG ---
  getPricingConfig(): PricingConfig {
    const raw = safeStorage.getItem(STORAGE_KEYS.PRICING);
    return raw ? JSON.parse(raw) : DEFAULT_PRICING_CONFIG;
  }

  updatePricingConfig(updates: Partial<PricingConfig>, actor: User): PricingConfig {
    if (actor.role !== 'admin') {
      throw new Error('Permission denied: Only administrators can modify business rates.');
    }
    const current = this.getPricingConfig();
    const updated = { ...current, ...updates };
    safeStorage.setItem(STORAGE_KEYS.PRICING, JSON.stringify(updated));

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'PRICING_UPDATED',
      entityType: 'pricing',
      entityId: updated.id,
      details: `Updated pricing config. PS5: ₹${(updated.ps5HourlyRatePaise / 100).toFixed(0)}/hr, Pool: ₹${(updated.poolHourlyRatePaise / 100).toFixed(0)}/hr, Rounding: ${updated.roundingRule}`,
      previousState: current,
      newState: updated,
    });

    return updated;
  }

  // --- SESSIONS ---
  getSessions(): Session[] {
    const raw = safeStorage.getItem(STORAGE_KEYS.SESSIONS);
    return raw ? JSON.parse(raw) : [];
  }

  getSessionById(sessionId: string): Session | undefined {
    return this.getSessions().find((s) => s.id === sessionId);
  }

  /**
   * Starts a new session atomically.
   */
  createSession(params: {
    customerName: string;
    customerPhone?: string;
    gamingType: 'ps5' | 'pool';
    stationId: string;
    billingType: 'hourly' | 'fixed';
    startTimeISO: string;
    controllersCount?: number;
    isMultiplayer?: boolean;
    fixedPlanId?: string;
    framesCount?: number;
    initialSnacks?: Array<{ snackId: string; quantity: number }>;
    notes?: string;
    actor: User;
  }): Session {
    const {
      customerName,
      customerPhone,
      gamingType,
      stationId,
      billingType,
      startTimeISO,
      controllersCount,
      isMultiplayer,
      fixedPlanId,
      framesCount,
      initialSnacks,
      notes,
      actor,
    } = params;

    const stations = this.getStations();
    const station = stations.find((s) => s.id === stationId);
    if (!station) throw new Error(`Station not found.`);

    // Verify whether an active session is actively running on this station
    const sessions = this.getSessions();
    const existingActive = sessions.find((s) => s.stationId === stationId && s.status === 'active');
    if (existingActive || station.status === 'occupied') {
      throw new Error(`Station ${station.name} is currently occupied.`);
    }

    const config = this.getPricingConfig();
    const sessionId = `sess-${Date.now()}`;

    // Prepare snack items with price snapshots and decrement inventory stock
    const items: SessionItem[] = [];
    if (initialSnacks && initialSnacks.length > 0) {
      const allSnacks = this.getSnacks();
      let inventoryChanged = false;

      for (const item of initialSnacks) {
        const product = allSnacks.find((s) => s.id === item.snackId);
        if (product && item.quantity > 0) {
          items.push({
            id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            sessionId,
            productId: product.id,
            name: product.name,
            quantity: item.quantity,
            unitPricePaise: product.pricePaise, // SNAPSHOT
            lineTotalPaise: product.pricePaise * item.quantity,
            isCustom: false,
          });

          // Deduct from stock if inventory is tracked
          if (product.stock !== undefined) {
            product.stock = Math.max(0, product.stock - item.quantity);
            inventoryChanged = true;
          }
        }
      }

      if (inventoryChanged) {
        safeStorage.setItem(STORAGE_KEYS.SNACKS, JSON.stringify(allSnacks));
      }
    }

    const snackSubtotalPaise = items.reduce((sum, it) => sum + it.lineTotalPaise, 0);

    const actualControllers = gamingType === 'ps5' ? (controllersCount || (isMultiplayer ? 2 : 1)) : undefined;

    // Initial charge estimate
    const chargeCalc = calculateGamingCharge({
      gamingType,
      billingType,
      startTimeISO,
      endTimeISO: null,
      config,
      isMultiplayer: actualControllers ? actualControllers > 1 : isMultiplayer,
      controllersCount: actualControllers,
      fixedPlanId,
      framesCount,
    });

    const fixedPlan = config.ps5FixedPlans.find((p) => p.id === fixedPlanId);

    let hourlyRatePaise = config.ps5HourlyRatePaise;
    if (gamingType === 'ps5') {
      if (actualControllers === 4) hourlyRatePaise = config.ps5Rate4PlayersPaise || 50000;
      else if (actualControllers === 3) hourlyRatePaise = config.ps5Rate3PlayersPaise || 40000;
      else if (actualControllers === 2) hourlyRatePaise = config.ps5Rate2PlayersPaise || config.ps5MultiplayerHourlyRatePaise || 30000;
      else hourlyRatePaise = config.ps5Rate1PlayerPaise || config.ps5HourlyRatePaise || 15000;
    } else {
      hourlyRatePaise = config.snookerHourlyRatePaise || config.poolHourlyRatePaise || 25000;
    }

    const newSession: Session = {
      id: sessionId,
      customerName: customerName.trim(),
      customerPhone: customerPhone?.trim(),
      gamingType,
      stationId,
      stationName: station.name,
      billingType,
      controllersCount: actualControllers,
      isMultiplayer: actualControllers ? actualControllers > 1 : (isMultiplayer || false),
      fixedPlanId,
      fixedPlanName: fixedPlan ? fixedPlan.name : undefined,
      framesCount,
      startTime: startTimeISO,
      endTime: null,
      durationMinutes: null,
      status: 'active',
      rateSnapshot: {
        hourlyRatePaise,
        fixedPricePaise: fixedPlan ? fixedPlan.pricePaise : undefined,
        description: chargeCalc.explanation,
        roundingPolicy: config.roundingRule,
      },
      gamingChargePaise: chargeCalc.gamingChargePaise,
      items,
      snackSubtotalPaise,
      discountPaise: 0,
      finalBillPaise: chargeCalc.gamingChargePaise + snackSubtotalPaise,
      createdBy: actor.id,
      createdByName: actor.displayName,
      notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save session
    const allSessions = this.getSessions();
    allSessions.unshift(newSession);
    safeStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(allSessions));

    // Update station to occupied
    this.updateStation(stationId, {
      status: 'occupied',
      activeSessionId: sessionId,
    });

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'SESSION_STARTED',
      entityType: 'session',
      entityId: sessionId,
      details: `Started ${gamingType.toUpperCase()}${actualControllers ? ` (${actualControllers} controllers)` : ''} session on ${station.name} for ${customerName}`,
      newState: newSession,
    });

    emitDataChanged();
    return newSession;
  }

  /**
   * Adds a snack item mid-game to an active session with historical price snapshot and decrements stock.
   */
  addSnackToSession(params: {
    sessionId: string;
    productId?: string | null;
    customName?: string;
    unitPricePaise: number;
    quantity: number;
    actor: User;
  }): Session {
    const { sessionId, productId, customName, unitPricePaise, quantity, actor } = params;
    const sessions = this.getSessions();
    const index = sessions.findIndex((s) => s.id === sessionId);
    if (index === -1) throw new Error('Session not found.');

    const session = sessions[index];
    if (session.status !== 'active' && actor.role !== 'admin') {
      throw new Error('Only active sessions can be modified unless authorized by admin.');
    }

    let snackName = customName || 'Custom Snack';
    let isCustom = true;

    if (productId) {
      const allSnacks = this.getSnacks();
      const product = allSnacks.find((s) => s.id === productId);
      if (product) {
        snackName = product.name;
        isCustom = false;
        if (product.stock !== undefined) {
          product.stock = Math.max(0, product.stock - quantity);
          safeStorage.setItem(STORAGE_KEYS.SNACKS, JSON.stringify(allSnacks));
        }
      }
    }

    const newItem: SessionItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sessionId,
      productId: productId || null,
      name: snackName,
      quantity,
      unitPricePaise, // SNAPSHOT
      lineTotalPaise: unitPricePaise * quantity,
      isCustom,
    };

    session.items.push(newItem);
    session.snackSubtotalPaise = session.items.reduce((sum, it) => sum + it.lineTotalPaise, 0);
    session.finalBillPaise = Math.max(
      0,
      session.gamingChargePaise + session.snackSubtotalPaise - session.discountPaise
    );
    session.updatedAt = new Date().toISOString();

    sessions[index] = session;
    safeStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'SNACK_ADDED_TO_SESSION',
      entityType: 'session',
      entityId: sessionId,
      details: `Added ${quantity}x ${snackName} (₹${(newItem.lineTotalPaise / 100).toFixed(2)}) to session for ${session.customerName}`,
    });

    emitDataChanged();
    return session;
  }

  /**
   * Removes a snack item from a session, restores catalogue stock, and recalculates totals.
   */
  removeSnackFromSession(params: {
    sessionId: string;
    itemId: string;
    actor: User;
  }): Session {
    const { sessionId, itemId, actor } = params;
    const sessions = this.getSessions();
    const index = sessions.findIndex((s) => s.id === sessionId);
    if (index === -1) throw new Error('Session not found.');

    const session = sessions[index];
    if (session.status !== 'active' && actor.role !== 'admin') {
      throw new Error('Only active sessions can be modified unless authorized by admin.');
    }

    const itemIndex = session.items.findIndex((it) => it.id === itemId);
    if (itemIndex === -1) throw new Error('Snack item not found in session.');

    const removedItem = session.items[itemIndex];
    session.items.splice(itemIndex, 1);

    // Restore stock if it was a catalogue item
    if (removedItem.productId) {
      const allSnacks = this.getSnacks();
      const pIdx = allSnacks.findIndex((s) => s.id === removedItem.productId);
      if (pIdx !== -1 && allSnacks[pIdx].stock !== undefined) {
        allSnacks[pIdx].stock = (allSnacks[pIdx].stock || 0) + removedItem.quantity;
        safeStorage.setItem(STORAGE_KEYS.SNACKS, JSON.stringify(allSnacks));
      }
    }

    session.snackSubtotalPaise = session.items.reduce((sum, it) => sum + it.lineTotalPaise, 0);
    session.finalBillPaise = Math.max(
      0,
      session.gamingChargePaise + session.snackSubtotalPaise - session.discountPaise
    );
    session.updatedAt = new Date().toISOString();

    sessions[index] = session;
    safeStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'SNACK_REMOVED_FROM_SESSION',
      entityType: 'session',
      entityId: sessionId,
      details: `Removed ${removedItem.quantity}x ${removedItem.name} (-₹${(removedItem.lineTotalPaise / 100).toFixed(2)}) from session for ${session.customerName}`,
    });

    emitDataChanged();
    return session;
  }

  /**
   * Completes a session, calculates duration and final bill, records payment.
   */
  completeSession(params: {
    sessionId: string;
    endTimeISO: string;
    discountPaise?: number;
    discountReason?: string;
    paymentMethod: 'gpay' | 'cash' | 'split';
    gpayAmountPaise: number;
    cashAmountPaise: number;
    notes?: string;
    actor: User;
  }): Session {
    const {
      sessionId,
      endTimeISO,
      discountPaise = 0,
      discountReason,
      paymentMethod,
      gpayAmountPaise,
      cashAmountPaise,
      notes,
      actor,
    } = params;

    // Prevent duplicate in-flight submissions
    if (this.inFlightCheckouts.has(sessionId)) {
      throw new Error('Duplicate payment prevented: Checkout is already in-flight for this session.');
    }
    this.inFlightCheckouts.add(sessionId);

    try {
      const sessions = this.getSessions();
      const index = sessions.findIndex((s) => s.id === sessionId);
      if (index === -1) throw new Error('Session not found.');

      const session = sessions[index];
      if (session.status === 'completed') {
        throw new Error('This session has already been finalized.');
      }

      const config = this.getPricingConfig();

      // Validate employee discount authority
      if (actor.role === 'employee' && discountPaise > config.maxEmployeeDiscountPaise) {
        throw new Error(
          `Employee discount cannot exceed ₹${(config.maxEmployeeDiscountPaise / 100).toFixed(0)}. Admin approval required.`
        );
      }

      // Calculate final duration and gaming charge on server/storage logic
      const chargeCalc = calculateGamingCharge({
        gamingType: session.gamingType,
        billingType: session.billingType,
        startTimeISO: session.startTime,
        endTimeISO,
        config,
        isMultiplayer: session.isMultiplayer,
        fixedPlanId: session.fixedPlanId,
        framesCount: session.framesCount,
      });

      const snackSubtotalPaise = session.items.reduce((sum, it) => sum + it.lineTotalPaise, 0);
      const billBreakdown = calculateFinalBill({
        gamingChargePaise: chargeCalc.gamingChargePaise,
        snackSubtotalPaise,
        discountPaise,
      });

      // Validate payment amounts strictly in integer paise
      const paymentValidation = validatePaymentAmounts({
        method: paymentMethod,
        finalBillPaise: billBreakdown.finalBillPaise,
        gpayAmountPaise,
        cashAmountPaise,
        allowPartial: config.allowPartialPayments,
      });

      if (!paymentValidation.isValid) {
        throw new Error(paymentValidation.error || 'Payment validation failed.');
      }

      const totalReceivedPaise = gpayAmountPaise + cashAmountPaise;

      const paymentRecord: PaymentRecord = {
        id: `pay-${Date.now()}`,
        sessionId,
        method: paymentMethod,
        gpayAmountPaise,
        cashAmountPaise,
        totalReceivedPaise,
        finalBillPaise: billBreakdown.finalBillPaise,
        outstandingBalancePaise: paymentValidation.outstandingBalancePaise,
        changeDuePaise: paymentValidation.changeDuePaise,
        recordedBy: actor.id,
        recordedByName: actor.displayName,
        timestamp: endTimeISO,
        status: paymentValidation.paymentStatus,
        notes,
      };

      // Update Session
      session.endTime = endTimeISO;
      session.durationMinutes = chargeCalc.billedMinutes;
      session.gamingChargePaise = chargeCalc.gamingChargePaise;
      session.snackSubtotalPaise = snackSubtotalPaise;
      session.discountPaise = billBreakdown.discountPaise;
      session.discountReason = discountReason;
      session.finalBillPaise = billBreakdown.finalBillPaise;
      session.status = 'completed';
      session.payment = paymentRecord;
      session.completedBy = actor.id;
      session.completedByName = actor.displayName;
      if (notes) session.notes = (session.notes ? session.notes + ' | ' : '') + notes;
      session.updatedAt = new Date().toISOString();

      sessions[index] = session;
      safeStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));

      // Release station
      this.updateStation(session.stationId, {
        status: 'available',
        activeSessionId: null,
      });

      this.addAuditLog({
        actorId: actor.id,
        actorName: actor.displayName,
        actorRole: actor.role,
        action: 'SESSION_COMPLETED',
        entityType: 'session',
        entityId: sessionId,
        details: `Completed session for ${session.customerName}. Bill: ₹${(billBreakdown.finalBillPaise / 100).toFixed(2)}, Received: ₹${(totalReceivedPaise / 100).toFixed(2)} (GPay: ₹${(gpayAmountPaise / 100).toFixed(2)}, Cash: ₹${(cashAmountPaise / 100).toFixed(2)})`,
        newState: session,
      });

      emitDataChanged();
      return session;
    } finally {
      this.inFlightCheckouts.delete(sessionId);
    }
  }

  /**
   * Voids an entry with mandatory reason and admin authorization.
   */
  voidSession(sessionId: string, reason: string, actor: User): Session {
    if (actor.role !== 'admin') {
      throw new Error('Permission denied: Only administrators can void finalized transactions.');
    }
    if (!reason || reason.trim().length < 5) {
      throw new Error('A detailed void reason (at least 5 characters) is required for audit compliance.');
    }

    const sessions = this.getSessions();
    const index = sessions.findIndex((s) => s.id === sessionId);
    if (index === -1) throw new Error('Session not found.');

    const session = sessions[index];
    session.isVoided = true;
    session.status = 'cancelled';
    session.voidReason = reason.trim();
    session.voidedBy = actor.id;
    session.voidedAt = new Date().toISOString();
    session.updatedAt = new Date().toISOString();

    if (session.payment) {
      session.payment.status = 'VOIDED';
    }

    // Release station if was active
    this.updateStation(session.stationId, {
      status: 'available',
      activeSessionId: null,
    });

    sessions[index] = session;
    safeStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'TRANSACTION_VOIDED',
      entityType: 'session',
      entityId: sessionId,
      details: `Voided transaction for ${session.customerName} (Original Bill: ₹${(session.finalBillPaise / 100).toFixed(2)}). Reason: ${reason}`,
    });

    emitDataChanged();
    return session;
  }

  // --- DAILY CLOSINGS & CASH RECONCILIATION ---
  getDailyClosings(): DailyClosing[] {
    const raw = safeStorage.getItem(STORAGE_KEYS.CLOSINGS);
    return raw ? JSON.parse(raw) : [];
  }

  createDailyClosing(params: {
    closingDate: string;
    countedCashPaise: number;
    denominations: DailyClosing['denominations'];
    notes?: string;
    actor: User;
  }): DailyClosing {
    const { closingDate, countedCashPaise, denominations, notes, actor } = params;

    // Calculate actual system numbers for the closing date
    const allSessions = this.getSessions();
    const daysSessions = allSessions.filter((s) => {
      if (s.isVoided) return false;
      const sDate = s.startTime.split('T')[0];
      return sDate === closingDate;
    });

    let expectedCashPaise = 0;
    let gpayTotalPaise = 0;
    let totalSalesPaise = 0;

    daysSessions.forEach((s) => {
      if (s.payment) {
        expectedCashPaise += s.payment.cashAmountPaise;
        gpayTotalPaise += s.payment.gpayAmountPaise;
        totalSalesPaise += s.finalBillPaise;
      }
    });

    const cashVariancePaise = countedCashPaise - expectedCashPaise;

    const newClosing: DailyClosing = {
      id: `close-${Date.now()}`,
      closingDate,
      expectedCashPaise,
      countedCashPaise,
      cashVariancePaise,
      gpayTotalPaise,
      totalSalesPaise,
      denominations,
      notes,
      closedBy: actor.id,
      closedByName: actor.displayName,
      closedAt: new Date().toISOString(),
    };

    const closings = this.getDailyClosings();
    closings.unshift(newClosing);
    safeStorage.setItem(STORAGE_KEYS.CLOSINGS, JSON.stringify(closings));

    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'DAILY_CASH_CLOSING',
      entityType: 'closing',
      entityId: newClosing.id,
      details: `Daily cash closing for ${closingDate}. Expected: ₹${(expectedCashPaise / 100).toFixed(2)}, Counted: ₹${(countedCashPaise / 100).toFixed(2)}, Variance: ₹${(cashVariancePaise / 100).toFixed(2)}`,
      newState: newClosing,
    });

    return newClosing;
  }

  // --- AUDIT LOGS ---
  private _readAuditLogs(): AuditLog[] {
    const raw = safeStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    return raw ? JSON.parse(raw) : [];
  }

  getAuditLogs(actor?: User): AuditLog[] {
    if (actor && actor.role !== 'admin') {
      throw new Error('Permission denied: Only administrators can view the audit trail.');
    }
    return this._readAuditLogs();
  }

  addAuditLog(entry: Omit<AuditLog, 'id' | 'timestamp'>): void {
    const logs = this._readAuditLogs();
    const newLog: AuditLog = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newLog);
    // Keep max 500 logs for local performance
    if (logs.length > 500) logs.length = 500;
    safeStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs));
  }

  // --- IMMUTABILITY & DELETION GUARDS ---
  deleteSession(sessionId: string, actor: User): never {
    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'SECURITY_ALERT',
      entityType: 'session',
      entityId: sessionId,
      details: `Security Violation: Unauthorized attempt by ${actor.displayName} (${actor.role}) to delete session ${sessionId}.`,
    });
    throw new Error('Security Violation: Historical financial records and completed sessions are immutable and cannot be deleted.');
  }

  deletePayment(paymentId: string, actor: User): never {
    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'SECURITY_ALERT',
      entityType: 'payment',
      entityId: paymentId,
      details: `Security Violation: Unauthorized attempt by ${actor.displayName} (${actor.role}) to delete payment ${paymentId}.`,
    });
    throw new Error('Security Violation: Payment records are immutable and cannot be deleted.');
  }

  deleteAuditLog(logId: string, actor: User): never {
    this.addAuditLog({
      actorId: actor.id,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'SECURITY_ALERT',
      entityType: 'audit_log',
      entityId: logId,
      details: `Security Violation: Unauthorized attempt by ${actor.displayName} (${actor.role}) to delete audit log ${logId}.`,
    });
    throw new Error('Security Violation: Audit logs are strictly immutable and cannot be deleted.');
  }

  // --- REPORTING METRICS ---
  calculateDashboardMetrics(startDateStr: string, endDateStr: string): DashboardMetrics {
    const sessions = this.getSessions().filter((s) => {
      if (s.isVoided) return false;
      const sDate = s.startTime.split('T')[0];
      return sDate >= startDateStr && sDate <= endDateStr;
    });

    let totalSalesPaise = 0;
    let gpayCollectionsPaise = 0;
    let cashCollectionsPaise = 0;
    let outstandingBalancePaise = 0;
    let ps5RevenuePaise = 0;
    let poolRevenuePaise = 0;
    let snackRevenuePaise = 0;
    let completedSessionsCount = 0;
    let activeSessionsCount = 0;

    const employeeMap = new Map<
      string,
      {
        employeeId: string;
        employeeName: string;
        sessionCount: number;
        totalSalesPaise: number;
        cashCollectedPaise: number;
        gpayCollectedPaise: number;
      }
    >();

    sessions.forEach((s) => {
      if (s.status === 'completed') {
        completedSessionsCount++;
        totalSalesPaise += s.finalBillPaise;
        snackRevenuePaise += s.snackSubtotalPaise;

        if (s.gamingType === 'ps5') {
          ps5RevenuePaise += s.gamingChargePaise;
        } else {
          poolRevenuePaise += s.gamingChargePaise;
        }

        if (s.payment) {
          gpayCollectionsPaise += s.payment.gpayAmountPaise;
          cashCollectionsPaise += s.payment.cashAmountPaise;
          outstandingBalancePaise += s.payment.outstandingBalancePaise;
        }

        // Employee stats
        const empId = s.completedBy || s.createdBy;
        const empName = s.completedByName || s.createdByName;
        const current = employeeMap.get(empId) || {
          employeeId: empId,
          employeeName: empName,
          sessionCount: 0,
          totalSalesPaise: 0,
          cashCollectedPaise: 0,
          gpayCollectedPaise: 0,
        };
        current.sessionCount++;
        current.totalSalesPaise += s.finalBillPaise;
        if (s.payment) {
          current.cashCollectedPaise += s.payment.cashAmountPaise;
          current.gpayCollectedPaise += s.payment.gpayAmountPaise;
        }
        employeeMap.set(empId, current);
      } else if (s.status === 'active') {
        activeSessionsCount++;
      }
    });

    const averageTransactionValuePaise =
      completedSessionsCount > 0 ? Math.round(totalSalesPaise / completedSessionsCount) : 0;

    return {
      totalSalesPaise,
      gpayCollectionsPaise,
      cashCollectionsPaise,
      outstandingBalancePaise,
      totalEntriesCount: sessions.length,
      completedSessionsCount,
      activeSessionsCount,
      ps5RevenuePaise,
      poolRevenuePaise,
      snackRevenuePaise,
      averageTransactionValuePaise,
      salesByEmployee: Array.from(employeeMap.values()),
    };
  }

  // --- CSV EXPORT ---
  exportSessionsToCSV(sessions: Session[]): string {
    const headers = [
      'Session ID',
      'Customer Name',
      'Phone',
      'Gaming Type',
      'Station',
      'Billing Type',
      'Start Time',
      'End Time',
      'Duration (Mins)',
      'Status',
      'Gaming Charge (INR)',
      'Snacks Subtotal (INR)',
      'Discount (INR)',
      'Final Bill (INR)',
      'Payment Method',
      'GPay Amount (INR)',
      'Cash Amount (INR)',
      'Outstanding Balance (INR)',
      'Created By',
      'Completed By',
      'Is Voided',
      'Void Reason',
    ];

    const rows = sessions.map((s) => [
      s.id,
      `"${s.customerName.replace(/"/g, '""')}"`,
      s.customerPhone || '',
      s.gamingType.toUpperCase(),
      `"${s.stationName}"`,
      s.billingType,
      formatDateTime(s.startTime),
      s.endTime ? formatDateTime(s.endTime) : 'Active',
      s.durationMinutes ?? '—',
      s.status.toUpperCase(),
      (s.gamingChargePaise / 100).toFixed(2),
      (s.snackSubtotalPaise / 100).toFixed(2),
      (s.discountPaise / 100).toFixed(2),
      (s.finalBillPaise / 100).toFixed(2),
      s.payment ? s.payment.method.toUpperCase() : 'PENDING',
      s.payment ? (s.payment.gpayAmountPaise / 100).toFixed(2) : '0.00',
      s.payment ? (s.payment.cashAmountPaise / 100).toFixed(2) : '0.00',
      s.payment ? (s.payment.outstandingBalancePaise / 100).toFixed(2) : '0.00',
      `"${s.createdByName}"`,
      `"${s.completedByName || ''}"`,
      s.isVoided ? 'YES' : 'NO',
      `"${(s.voidReason || '').replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  resetToDemoData(): void {
    safeStorage.clear();
    this.inFlightCheckouts.clear();
    this.init();
  }
}

export const db = new PosStorageEngine();
