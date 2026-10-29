/**
 * Formatters for Indian Currency (INR), Timestamps, and Durations.
 * All monetary values are strictly processed as integer paise to prevent floating point inaccuracies.
 */

export function formatRupees(paise: number | undefined | null): string {
  if (paise === undefined || paise === null || isNaN(paise)) {
    return '₹0.00';
  }
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
 * Returns today's date in YYYY-MM-DD
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
