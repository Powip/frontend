/**
 * Tests: useStockCoverage (FEAT-24 H13-D2).
 *
 * 1. Pide el reporte de stock con `withCoverage=true` (todo, del almacén pedido) y arma vd y cobertura por
 *    variante (`null` = sin ventas); los días objetivo salen de la regla de la empresa.
 * 2. Un servidor sin cobertura (anterior a H13) no arma el mapa: la columna no se muestra.
 * 3. Apagado (otra pestaña), no consulta nada.
 */

import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getStockReport, type StockReportData, type StockReportItem } from "@/services/inventoryReportsService";
import { getInventoryRules } from "@/services/warehousesService";
import { useStockCoverage } from "../useStockCoverage";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "t", user: { id: "u-1" }, company: { id: "c-1" } } }) }));
jest.mock("@/services/inventoryReportsService", () => ({ getStockReport: jest.fn() }));
jest.mock("@/services/warehousesService", () => ({ getInventoryRules: jest.fn() }));

const row = (variantId: string, extra: Partial<StockReportItem>): StockReportItem => ({
  variantId,
  productId: "p",
  productName: "Polo",
  sku: null,
  companySku: null,
  attributes: null,
  physical: 1,
  reserved: 0,
  available: 1,
  warehouses: [],
  ...extra,
});

function report(items: StockReportItem[]): StockReportData {
  return {
    available: true,
    date: "2026-11-18",
    asOf: null,
    source: "live",
    closePeriod: null,
    cutoffAt: null,
    warehouses: [],
    items,
    totals: { variants: items.length, physical: 0, reserved: 0, available: 0, withoutCost: { variants: 0, units: 0 } },
    total: items.length,
    page: 1,
    limit: 20000,
    coverage: { windowDays: 30, until: "2026-11-18T15:00:00Z" },
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getInventoryRules).mockResolvedValue({ releaseAfterDays: null, pickingRequired: false, igvAffected: true, allowPurchaseToCourier: false, defaultCoverageDays: 45 });
});

it("arma la cobertura por variante del almacén pedido y toma los días objetivo de la regla", async () => {
  jest.mocked(getStockReport).mockResolvedValue(report([row("v-1", { vd: 1.5, coverageDays: 12 }), row("v-2", { vd: 0, coverageDays: null })]));
  const { result } = renderHook(() => useStockCoverage({ inventoryId: "inv-1" }), { wrapper });
  await waitFor(() => expect(result.current.byVariant?.size).toBe(2));
  expect(result.current.byVariant?.get("v-1")).toEqual({ vd: 1.5, coverageDays: 12 });
  expect(result.current.byVariant?.get("v-2")).toEqual({ vd: 0, coverageDays: null });
  await waitFor(() => expect(result.current.targetDays).toBe(45));
  expect(result.current.windowDays).toBe(30);
  expect(getStockReport).toHaveBeenCalledWith({ inventoryId: "inv-1", all: true, withCoverage: true }, expect.anything());
});

it("un servidor sin cobertura no arma el mapa (la columna no se muestra)", async () => {
  jest.mocked(getStockReport).mockResolvedValue(report([row("v-1", {})]));
  const { result } = renderHook(() => useStockCoverage({}), { wrapper });
  await waitFor(() => expect(getStockReport).toHaveBeenCalled());
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(result.current.byVariant).toBeUndefined();
  expect(getStockReport).toHaveBeenCalledWith({ inventoryId: undefined, all: true, withCoverage: true }, expect.anything());
});

it("apagado no consulta", () => {
  const { result } = renderHook(() => useStockCoverage({ enabled: false }), { wrapper });
  expect(getStockReport).not.toHaveBeenCalled();
  expect(result.current.byVariant).toBeUndefined();
  expect(result.current.targetDays).toBe(30);
});
