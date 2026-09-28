export const LIMA_UTC_OFFSET_MINUTES = -300;
export const LIMA_UTC_OFFSET_LABEL = "-05:00";

const DAY_MS = 86_400_000;
const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number) => String(value).padStart(2, "0");

function fromUtcDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function isValidDayKey(value: string | null | undefined): value is string {
  if (!value) return false;
  const match = DAY_KEY_PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return fromUtcDate(date) === value;
}

export function dayKeyToUtcMidnight(key: string): number {
  const match = DAY_KEY_PATTERN.exec(key);
  if (!match) {
    throw new Error(`Fecha inválida: ${key}`);
  }
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function toLimaDayKey(instant: number): string {
  return fromUtcDate(new Date(instant + LIMA_UTC_OFFSET_MINUTES * 60_000));
}

export function addDays(key: string, days: number): string {
  return fromUtcDate(new Date(dayKeyToUtcMidnight(key) + days * DAY_MS));
}

export function diffDays(from: string, to: string): number {
  return Math.round((dayKeyToUtcMidnight(to) - dayKeyToUtcMidnight(from)) / DAY_MS);
}

export function startOfMonthKey(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

export function addMonthsToMonthStart(key: string, months: number): string {
  const utc = new Date(dayKeyToUtcMidnight(startOfMonthKey(key)));
  return fromUtcDate(new Date(Date.UTC(utc.getUTCFullYear(), utc.getUTCMonth() + months, 1)));
}

export function endOfMonthKey(key: string): string {
  return addDays(addMonthsToMonthStart(key, 1), -1);
}

export function minDayKey(a: string, b: string): string {
  return a <= b ? a : b;
}

export function maxDayKey(a: string, b: string): string {
  return a >= b ? a : b;
}

export function limaDayStartIso(key: string): string {
  return `${key}T00:00:00${LIMA_UTC_OFFSET_LABEL}`;
}

export function limaDayEndIso(key: string): string {
  return `${key}T23:59:59.999${LIMA_UTC_OFFSET_LABEL}`;
}

export function enumerateDays(from: string, to: string): string[] {
  const total = diffDays(from, to);
  if (total < 0) return [];
  return Array.from({ length: total + 1 }, (_, index) => addDays(from, index));
}
