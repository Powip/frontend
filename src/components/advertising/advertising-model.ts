export type AdvertisingProvider = "meta" | "tiktok";

export interface AdvertisingAccount {
  id: string;
  provider: AdvertisingProvider;
  name: string;
  externalId: string;
  currency: string;
  timeZone: string;
  enabled: boolean;
  updatedAt: string | null;
  historyImport?: AdvertisingHistoryImportState | null;
}

export interface AdvertisingDay {
  accountId: string;
  date: string;
  amountMinor: number | null;
  amountDecimal?: string | null;
  provisional?: boolean;
}

export interface ManualAdvertisingRecord {
  id: string;
  date: string;
  amountMinor: number | null;
  amountDecimal?: string | null;
  currency: string | null;
  status: AdvertisingManualRecordWire["status"];
  importedAccountId?: string;
  source?: string;
  browserKey?: string;
  sourceId?: string;
  classificationCurrency?: string | null;
  exclusionKind?: AdvertisingManualRecordWire["exclusionKind"];
  resolutionVersion?: number;
  updatedAt?: string | null;
}

export interface AdvertisingSnapshot {
  accounts: AdvertisingAccount[];
  days: AdvertisingDay[];
  manualRecords: ManualAdvertisingRecord[];
  providers: Record<
    AdvertisingProvider,
    {
      available: boolean;
      status: "disconnected" | "connected" | "needs-auth" | "paused";
    }
  >;
  today: string;
}

export interface AdvertisingFilters {
  from: string;
  to: string;
  provider: "all" | AdvertisingProvider;
  accountId: string;
  currency: string;
}

export interface AdvertisingAccountSummary {
  account: AdvertisingAccount;
  amountMinor: number | null;
  missingDates: string[];
  complete: boolean;
  amountDecimal?: string | null;
}

export interface AdvertisingCurrencyTotal {
  currency: string;
  amountMinor: number | null;
  complete: boolean;
  accountCount: number;
  amountDecimal?: string | null;
}

export interface AdvertisingDailyAmount {
  date: string;
  amountMinor: number | null;
  complete: boolean;
  amountDecimal?: string | null;
  provisional?: boolean;
}

export interface AdvertisingSummary {
  accounts: AdvertisingAccountSummary[];
  totals: AdvertisingCurrencyTotal[];
  daily: Record<string, AdvertisingDailyAmount[]>;
}

/** Date keys are provider calendar days, rather than local browser timestamps. */
function parseDateKey(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString().slice(0, 10) === date ? timestamp : null;
}

function periodDates(from: string, to: string): string[] {
  const start = parseDateKey(from);
  const end = parseDateKey(to);
  if (start === null || end === null || start > end) return [];
  const dates: string[] = [];
  for (let timestamp = start; timestamp <= end; timestamp += 86_400_000) {
    dates.push(new Date(timestamp).toISOString().slice(0, 10));
  }
  return dates;
}

function sumAvailable(values: Array<number | null>): number | null {
  const available = values.filter((value): value is number => value !== null);
  return available.length === 0 ? null : available.reduce((sum, value) => sum + value, 0);
}

export function getAdvertisingSummary(
  snapshot: AdvertisingSnapshot,
  filters: AdvertisingFilters,
): AdvertisingSummary {
  const dates = periodDates(filters.from, filters.to);
  if (dates.length === 0) return { accounts: [], totals: [], daily: {} };

  // Disabled accounts retain their imported history. Connection state does not
  // change whether an already imported amount exists.
  const selectedAccounts = snapshot.accounts.filter(
    (account) =>
      (filters.provider === "all" || account.provider === filters.provider) &&
      (filters.accountId === "all" || account.id === filters.accountId) &&
      (filters.currency === "all" || account.currency === filters.currency),
  );

  const importedDays = new Map<string, Map<string, number | null>>();
  for (const day of snapshot.days) {
    if (!importedDays.has(day.accountId)) {
      importedDays.set(day.accountId, new Map());
    }
    // One value per account/day also prevents repeated imports being summed.
    importedDays
      .get(day.accountId)
      ?.set(
        day.date,
        day.amountMinor !== null && Number.isSafeInteger(day.amountMinor) ? day.amountMinor : null,
      );
  }

  const accounts = selectedAccounts.map((account): AdvertisingAccountSummary => {
    const values = dates.map((date) => importedDays.get(account.id)?.get(date) ?? null);
    const missingDates = dates.filter((_, index) => values[index] === null);
    return {
      account,
      amountMinor: sumAvailable(values),
      missingDates,
      complete: missingDates.length === 0,
    };
  });

  const currencies = [...new Set(selectedAccounts.map((account) => account.currency))];
  const totals = currencies.map((currency): AdvertisingCurrencyTotal => {
    const matchingAccounts = accounts.filter(({ account }) => account.currency === currency);
    return {
      currency,
      amountMinor: sumAvailable(matchingAccounts.map(({ amountMinor }) => amountMinor)),
      complete: matchingAccounts.every(({ complete }) => complete),
      accountCount: matchingAccounts.length,
    };
  });

  const daily: AdvertisingSummary["daily"] = {};
  for (const currency of currencies) {
    const matchingAccounts = selectedAccounts.filter((account) => account.currency === currency);
    daily[currency] = dates.map((date) => {
      const values = matchingAccounts.map(
        (account) => importedDays.get(account.id)?.get(date) ?? null,
      );
      return {
        date,
        amountMinor: sumAvailable(values),
        complete: values.every((value) => value !== null),
      };
    });
  }

  // API amounts retain provider precision. Round AFTER the sum, only for presentation.
  if (snapshot.days.some((day) => day.amountDecimal !== undefined)) {
    const exactDays = new Map<string, Map<string, AdvertisingDay>>();
    for (const day of snapshot.days) {
      if (!exactDays.has(day.accountId)) exactDays.set(day.accountId, new Map());
      exactDays.get(day.accountId)?.set(day.date, day);
    }
    for (const summary of accounts) {
      const values = dates.map(
        (date) => exactDays.get(summary.account.id)?.get(date)?.amountDecimal ?? null,
      );
      summary.amountDecimal = sumAdvertisingDecimals(values);
      summary.amountMinor = advertisingDecimalToMinor(
        summary.amountDecimal,
        summary.account.currency,
      );
      summary.missingDates = dates.filter((_, index) => values[index] === null);
      summary.complete = summary.missingDates.length === 0;
    }
    for (const total of totals) {
      const matching = accounts.filter(({ account }) => account.currency === total.currency);
      total.amountDecimal = sumAdvertisingDecimals(
        matching.map((summary) => summary.amountDecimal ?? null),
      );
      total.amountMinor = advertisingDecimalToMinor(total.amountDecimal, total.currency);
      total.complete = matching.every((summary) => summary.complete);
      daily[total.currency] = dates.map((date) => {
        const rows = matching.map(({ account }) => exactDays.get(account.id)?.get(date));
        const values = rows.map((row) => row?.amountDecimal ?? null);
        const amountDecimal = sumAdvertisingDecimals(values);
        return {
          date,
          amountDecimal,
          amountMinor: advertisingDecimalToMinor(amountDecimal, total.currency),
          complete: values.every((value) => value !== null),
          provisional: rows.some((row) => row?.provisional),
        };
      });
    }
  }
  // Manual entries are reviewed separately, never implicitly added to imports.
  return { accounts, totals, daily };
}

export function providerLabel(provider: AdvertisingProvider): string {
  return provider === "meta" ? "Meta Ads" : "TikTok Ads";
}

export function formatAdvertisingMoney(
  amountMinor: number | null,
  currency: string,
  amountDecimal?: string | null,
): string {
  if (amountDecimal != null) return formatAdvertisingDecimal(amountDecimal, currency);
  if (amountMinor === null) return "Pendiente";
  const formatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency,
  });
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  return formatter.format(amountMinor / 10 ** fractionDigits);
}

export function snapshotFromWire(wire: AdvertisingSnapshotWire): AdvertisingSnapshot {
  if (
    wire.accounts.some(
      (account) =>
        account.historyImport != null && !isAdvertisingHistoryImport(account.historyImport),
    )
  )
    throw new Error("No pudimos leer el estado de importación.");
  const currencies = new Map(wire.accounts.map((account) => [account.id, account.currency]));
  return {
    accounts: wire.accounts,
    days: wire.days.map((day) => {
      if (currencies.get(day.accountId) !== day.currency)
        throw new Error("La moneda del gasto no coincide con la cuenta.");
      return {
        accountId: day.accountId,
        date: day.date,
        amountDecimal: day.amount,
        amountMinor: advertisingDecimalToMinor(day.amount, day.currency),
        provisional: day.provisional,
      };
    }),
    manualRecords: wire.manualRecords.map((record) => ({
      id: record.id,
      date: record.date,
      amountMinor:
        (record.classificationCurrency ?? record.currency)
          ? advertisingDecimalToMinor(
              record.amount,
              (record.classificationCurrency ?? record.currency) as string,
            )
          : null,
      amountDecimal: record.amount,
      currency: record.currency,
      status: record.status,
      importedAccountId: record.importedAccountId ?? undefined,
      source: record.source,
      browserKey: record.browserKey,
      sourceId: record.sourceId,
      classificationCurrency: record.classificationCurrency,
      exclusionKind: record.exclusionKind,
      resolutionVersion: record.resolutionVersion,
      updatedAt: record.updatedAt,
    })),
    providers: wire.providers,
    today: wire.today,
  };
}

export function isAdvertisingZero(
  amountMinor: number | null,
  amountDecimal?: string | null,
): boolean {
  return amountDecimal !== undefined
    ? amountDecimal !== null && /^0+(?:\.0+)?$/.test(amountDecimal)
    : amountMinor === 0;
}

export function hasAdvertisingAmount(
  value: { amountMinor: number | null; amountDecimal?: string | null } | undefined,
): boolean {
  return (
    !!value &&
    (value.amountDecimal !== undefined ? value.amountDecimal !== null : value.amountMinor !== null)
  );
}

export function formatAdvertisingDate(date: string): string {
  const timestamp = parseDateKey(date);
  if (timestamp === null) return date;
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(timestamp);
}

export const EMPTY_ADVERTISING_SNAPSHOT: AdvertisingSnapshot = {
  accounts: [],
  days: [],
  manualRecords: [],
  providers: {
    meta: { available: false, status: "disconnected" },
    tiktok: { available: false, status: "disconnected" },
  },
  today: new Date().toISOString().slice(0, 10),
};

import type {
  AdvertisingHistoryImportState,
  AdvertisingManualRecordWire,
  AdvertisingSnapshotWire,
} from "@/services/advertisingService";
import {
  advertisingDecimalToMinor,
  formatAdvertisingDecimal,
  sumAdvertisingDecimals,
} from "./advertising-decimal";
import { isAdvertisingHistoryImport } from "./advertising-history";
