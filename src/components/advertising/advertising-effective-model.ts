import type { EffectiveAdvertisingSpendWire } from "@/types/advertisingEffective";
import { advertisingPeriodFromParams } from "./advertising-period";

function decimal(value: unknown): value is string {
  return typeof value === "string" && value.length <= 1024 && /^\d+(?:\.\d+)?$/.test(value);
}

export function isEffectiveAdvertisingSpend(
  value: unknown,
  from: string,
  to: string,
): value is EffectiveAdvertisingSpendWire {
  if (!value || typeof value !== "object") return false;
  const data = value as EffectiveAdvertisingSpendWire;
  const period = advertisingPeriodFromParams(new URLSearchParams({ from, to }));
  const count = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
  const currency = (value: unknown) => typeof value === "string" && /^[A-Z]{3}$/.test(value);
  return Boolean(
    period &&
      data.scope === "company" &&
      data.from === from &&
      data.to === to &&
      count(data.pendingManualCount) &&
      count(data.representedManualCount) &&
      count(data.excludedManualCount) &&
      Array.isArray(data.conflictedManualIds) &&
      data.conflictedManualIds.every((id) => typeof id === "string") &&
      Array.isArray(data.totals) &&
      data.totals.every(
        (total) =>
          total &&
          currency(total.currency) &&
          (total.amount === null || decimal(total.amount)) &&
          (total.importedAmount === null || decimal(total.importedAmount)) &&
          decimal(total.fallbackAmount) &&
          decimal(total.additionalAmount) &&
          ["complete", "partial", "pending"].includes(total.coverage) &&
          count(total.missingAccountDays) &&
          typeof total.provisional === "boolean",
      ) &&
      Array.isArray(data.rows) &&
      data.rows.every(
        (row) =>
          row &&
          typeof row.accountId === "string" &&
          ["meta", "tiktok"].includes(row.provider) &&
          decimal(row.amount) &&
          currency(row.currency) &&
          row.date >= from &&
          row.date <= to &&
          advertisingPeriodFromParams(new URLSearchParams({ from: row.date, to: row.date })) &&
          ["imported", "fallback", "additional"].includes(row.source) &&
          (row.manualRecordId === null || typeof row.manualRecordId === "string") &&
          (row.revision === null || typeof row.revision === "string") &&
          typeof row.provisional === "boolean",
      ),
  );
}
