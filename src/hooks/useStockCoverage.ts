"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_COVERAGE_DAYS } from "@/lib/suggestedPurchase";
import { getStockReport } from "@/services/inventoryReportsService";
import { getInventoryRules } from "@/services/warehousesService";

// FEAT-24 H13-D2 — cobertura de cada variante para la columna «Cobertura» de
// Stock: venta diaria y días que dura el disponible, del reporte de stock con
// `withCoverage=true` (los almacenes que ve el usuario, o uno solo). Los días
// objetivo salen de la regla de la empresa (`defaultCoverageDays`).
// Es un adorno: si falla, la columna no se muestra y Stock funciona igual.

export interface VariantCoverage {
  vd: number;
  /** `null` = sin ventas en la ventana. */
  coverageDays: number | null;
}

export interface StockCoverage {
  /** `undefined` mientras carga o si falló. */
  byVariant: Map<string, VariantCoverage> | undefined;
  targetDays: number;
  windowDays: number | null;
}

export function useStockCoverage({ inventoryId, enabled = true }: { inventoryId?: string; enabled?: boolean }): StockCoverage {
  const { auth } = useAuth();
  const companyId = auth?.company?.id ?? "";
  const userId = auth?.user?.id ?? "";
  const ready = Boolean(enabled && companyId && auth?.accessToken);
  const reportQuery = useQuery({
    queryKey: ["stock-coverage", companyId, userId, inventoryId ?? "all"],
    queryFn: ({ signal }) => getStockReport({ inventoryId, all: true, withCoverage: true }, signal),
    enabled: ready,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const rulesQuery = useQuery({
    queryKey: ["inventory-rules", companyId],
    queryFn: () => getInventoryRules(),
    enabled: ready,
    retry: false,
  });
  const report = reportQuery.data;
  const byVariant = useMemo(() => {
    if (!report || report.available !== true) return undefined;
    // Sin el campo (servidor anterior a H13) no hay columna.
    if (report.items.length > 0 && !report.items.some((item) => "coverageDays" in item)) return undefined;
    const map = new Map<string, VariantCoverage>();
    for (const item of report.items) {
      if (!("coverageDays" in item)) continue;
      map.set(item.variantId, { vd: Number(item.vd) || 0, coverageDays: item.coverageDays ?? null });
    }
    return map;
  }, [report]);
  return {
    byVariant,
    targetDays: rulesQuery.data?.defaultCoverageDays ?? DEFAULT_COVERAGE_DAYS,
    windowDays: report && report.available === true ? report.coverage?.windowDays ?? null : null,
  };
}
