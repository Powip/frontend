export const LIMA_TIME_ZONE = "America/Lima";

const MONTHS_SHORT = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const DAY_MS = 24 * 60 * 60 * 1000;

const limaPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: LIMA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export interface LimaDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

type DateInput = Date | string | number;

function toDate(value: DateInput): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Fecha inválida");
  }
  return date;
}

export function getLimaDateParts(value: DateInput): LimaDateParts {
  const parts = limaPartsFormatter.formatToParts(toDate(value));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour") % 24,
    minute: read("minute"),
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

export function formatLimaTime(value: DateInput): string {
  const { hour, minute } = getLimaDateParts(value);
  return `${pad(hour)}:${pad(minute)}`;
}

export function formatLimaDate(value: DateInput): string {
  const { year, month, day } = getLimaDateParts(value);
  return `${pad(day)}/${pad(month)}/${year}`;
}

export function formatLimaDateTime(value: DateInput): string {
  return `${formatLimaDate(value)} ${formatLimaTime(value)}`;
}

export function formatLimaShortDate(value: DateInput): string {
  const { month, day } = getLimaDateParts(value);
  return `${pad(day)} ${MONTHS_SHORT[month - 1]}`;
}

const TIME_KEY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidTimeKey(value: string): boolean {
  return TIME_KEY_PATTERN.test(value);
}

export function isValidDateKey(value: string): boolean {
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function toLimaDateKey(value: DateInput): string {
  const { year, month, day } = getLimaDateParts(value);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function toLimaTimeKey(value: DateInput): string {
  return formatLimaTime(value);
}

export function isLimaDateTimeInFuture(dateKey: string, timeKey: string, now: DateInput): boolean {
  if (!isValidDateKey(dateKey) || !isValidTimeKey(timeKey)) return false;
  return `${dateKey}T${timeKey}` > `${toLimaDateKey(now)}T${toLimaTimeKey(now)}`;
}

export function formatDateKey(dateKey: string): string {
  if (!isValidDateKey(dateKey)) return dateKey;
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
}

function limaDayNumber(value: DateInput): number {
  const { year, month, day } = getLimaDateParts(value);
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

export function isSameLimaDay(a: DateInput, b: DateInput): boolean {
  return limaDayNumber(a) === limaDayNumber(b);
}

export function formatLimaDayLabel(value: DateInput, now: DateInput = new Date()): string {
  const difference = limaDayNumber(now) - limaDayNumber(value);
  if (difference === 0) return "Hoy";
  if (difference === 1) return "Ayer";
  if (difference === -1) return "Mañana";
  return formatLimaShortDate(value);
}
