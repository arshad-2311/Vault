/**
 * Formatters for Indian Currency (INR), Timestamps, and Durations.
 * All monetary values are strictly processed as integer paise to prevent floating point inaccuracies.
 */

export function formatRupees(paise: number | undefined | null): string {
  if (paise === undefined || paise === null || isNaN(paise)) {
    return '₹0';
  }
  const rupees = paise / 100;
  const isWhole = rupees % 1 === 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  }).format(rupees);
}

export function formatRupeesShort(paise: number | undefined | null): string {
  if (paise === undefined || paise === null || isNaN(paise)) {
    return '₹0';
  }
  const rupees = paise / 100;
  if (rupees % 1 === 0) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(rupees);
  }
  return formatRupees(paise);
}

export function rupeesToPaise(rupees: number | string): number {
  if (typeof rupees === 'string') {
    const cleaned = rupees.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : Math.round(num * 100);
  }
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function formatPaiseToInputRupees(paise: number): string {
  if (!paise || isNaN(paise) || paise <= 0) return '0';
  const rupees = paise / 100;
  return rupees % 1 === 0 ? rupees.toFixed(0) : rupees.toFixed(2);
}

export function formatDateTime(isoString?: string | null, timezone = 'Asia/Kolkata'): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: timezone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return isoString;
  }
}

export function formatTimeOnly(isoString?: string | null, timezone = 'Asia/Kolkata'): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return isoString;
  }
}

export function formatDateOnly(isoString?: string | null, timezone = 'Asia/Kolkata'): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: timezone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return isoString;
  }
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || isNaN(minutes) || minutes < 0) {
    return '0m';
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = Math.round(minutes % 60);
  if (hours === 0) {
    return `${remainingMins}m`;
  }
  if (remainingMins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMins}m`;
}

export function formatSecondsToTime(totalSeconds: number): string {
  if (totalSeconds < 0) totalSeconds = 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const pad = (n: number) => n.toString().padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Returns current timestamp in local Indian timezone ISO representation
 */
export function getCurrentLocalISO(): string {
  return new Date().toISOString();
}

/**
 * Returns the business date string (YYYY-MM-DD) for a given timestamp or Date,
 * where the business day begins at 3:00 AM Indian Standard Time (Asia/Kolkata, UTC+05:30)
 * and runs until 2:59:59 AM the next day.
 * Sessions between 00:00:00 and 02:59:59 IST belong to the previous calendar day's business cycle.
 * Evaluated strictly in IST to ensure identical behavior across all client devices and browsers.
 */
export function getBusinessDateString(dateInput: Date | string = new Date()): string {
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
    return dateInput.trim();
  }

  // If dateInput is a Date object or string without explicit UTC offset ('Z' or '+')
  if (dateInput instanceof Date || (typeof dateInput === 'string' && !dateInput.includes('Z') && !dateInput.includes('+'))) {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : new Date(dateInput.getTime());
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
    if (d.getHours() < 3) {
      d.setDate(d.getDate() - 1);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // If dateInput is an ISO string with UTC 'Z' or offset (e.g. from database storage)
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    return new Date().toISOString().split('T')[0];
  }

  // Convert UTC timestamp to Indian Standard Time (UTC + 5:30)
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + IST_OFFSET_MS);

  // If the time is before 3:00 AM IST, roll back 1 day to associate with the current night's shift
  if (istDate.getUTCHours() < 3) {
    istDate.setUTCDate(istDate.getUTCDate() - 1);
  }

  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's active business date in YYYY-MM-DD (cycles over at 3:00 AM IST)
 */
export function getTodayDateString(): string {
  return getBusinessDateString(new Date());
}

/**
 * Returns yesterday's business date in YYYY-MM-DD (based on 3:00 AM IST cycle)
 */
export function getYesterdayDateString(): string {
  const todayStr = getTodayDateString();
  const [y, m, d] = todayStr.split('-').map(Number);
  const prevDate = new Date(y, m - 1, d - 1);
  const year = prevDate.getFullYear();
  const month = String(prevDate.getMonth() + 1).padStart(2, '0');
  const day = String(prevDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the Monday-to-Sunday business week range (YYYY-MM-DD) for a given date
 */
export function getBusinessWeekRange(dateStr: string = getTodayDateString()): { start: string; end: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay(); // 0 = Sun, 1 = Mon...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(y, m - 1, d + diffToMonday);
  const sunday = new Date(y, m - 1, d + diffToMonday + 6);

  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

  return { start: fmt(monday), end: fmt(sunday) };
}

/**
 * Returns the first and last day of the month (YYYY-MM-DD) for a given date
 */
export function getBusinessMonthRange(dateStr: string = getTodayDateString()): { start: string; end: string } {
  const [y, m] = dateStr.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  return {
    start: `${y}-${mm}-01`,
    end: `${y}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

/**
 * Calculates the exact UTC ISO string interval corresponding to business dates [startDate, endDate]
 * in Indian Standard Time (Asia/Kolkata, UTC+05:30), where each business day starts at 03:00:00 IST
 * and ends at 02:59:59.999 IST the following day.
 */
export function getBusinessDateRangeUTC(startDateStr: string, endDateStr: string): { startISO: string; endISO: string } {
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const [ey, em, ed] = endDateStr.split('-').map(Number);

  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  // Business day starts at 03:00:00.000 IST on startDateStr
  const startMs = Date.UTC(sy, sm - 1, sd, 3, 0, 0, 0) - IST_OFFSET_MS;
  // Business day ends at 02:59:59.999 IST on the morning after endDateStr
  const endMs = Date.UTC(ey, em - 1, ed + 1, 2, 59, 59, 999) - IST_OFFSET_MS;

  return {
    startISO: new Date(startMs).toISOString(),
    endISO: new Date(endMs).toISOString(),
  };
}

/**
 * Masks a phone number for privacy compliance (shows first 2 and last 4 digits)
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return '—';
  const clean = phone.trim();
  if (clean.length < 6) return clean;
  return clean.slice(0, 2) + '••••' + clean.slice(-4);
}
