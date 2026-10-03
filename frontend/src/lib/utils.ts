import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Air-gapped PII Masking utility.
 * Strict standard: Never reveal unmasked national ID or passport by default.
 * Only reveal upon explicit user click, which emits an immutable audit event.
 */
export function maskPii(
  value: string,
  type: 'national_id' | 'passport' | 'phone' | 'plate' = 'national_id'
): string {
  if (!value) return '';
  const clean = value.trim();

  if (type === 'national_id') {
    if (clean.length <= 4) return '••••';
    const start = clean.slice(0, 3);
    const end = clean.slice(-2);
    return `${start}••••••••${end}`;
  }

  if (type === 'passport') {
    if (clean.length <= 3) return '•••';
    const start = clean.slice(0, 2);
    const end = clean.slice(-2);
    return `${start}••••${end}`;
  }

  if (type === 'phone') {
    if (clean.length <= 4) return '••••';
    return `${clean.slice(0, 4)}••••${clean.slice(-2)}`;
  }

  if (type === 'plate') {
    if (clean.length <= 3) return '•••';
    return `${clean.slice(0, 3)} ••••`;
  }

  return '••••••••';
}

export function formatTimestamp(dateStr?: string | Date): string {
  if (!dateStr) return '--:--:--';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

export function formatTimeOnly(dateStr?: string | Date): string {
  if (!dateStr) return '--:--:--';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return d.toTimeString().slice(0, 8);
}

/**
 * Renders a byte count for display ("4.2 MB").
 *
 * `recordings.size_bytes` comes back from Postgres as a BIGINT, which the pg
 * driver returns as a string. Parsing defensively keeps the UI from rendering
 * "NaN undefined" if that ever changes.
 */
export function formatBytes(bytes: number | string | null | undefined): string {
  const value = typeof bytes === 'string' ? Number(bytes) : bytes;
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return '—';

  if (value < 1024) return `${value} B`;

  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  // One decimal distinguishes 12 MB from 12.5 MB without adding noise.
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Renders a Postgres `timestamptz` as a relative age ("3h ago", "2d ago").
 * Used across the console to show how stale an operational record is.
 */
export function formatRelativeTime(dateStr?: string | Date | null): string {
  if (!dateStr) return '—';
  const then = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  if (Number.isNaN(then.getTime())) return '—';

  const seconds = Math.floor((Date.now() - then.getTime()) / 1000);
  if (seconds < 0) return 'in the future';
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Normalises an ID document value to the masking profile used by
 * `PiiMaskedText`. Postgres stores the discriminator separately, so the UI
 * needs a translation before it can apply the correct mask.
 */
export function piiTypeFromIdType(
  idType: string | null | undefined
): 'national_id' | 'passport' | 'phone' | 'plate' {
  switch (idType) {
    case 'passport':
      return 'passport';
    case 'drivers_license':
    case 'national_id':
      return 'national_id';
    default:
      return 'national_id';
  }
}
