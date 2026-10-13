import { render, screen } from "@testing-library/react";
import { useAdvertisingBusinessMetrics } from "@/hooks/useAdvertisingBusinessMetrics";
import { AdvertisingSalesCostCard } from "../AdvertisingSalesCostCard";
import { compareAdvertisingBusinessCurrency } from "../advertising-business-metrics-model";
import { advertisingClosedPeriod, advertisingSalesCost } from "../advertising-sales-cost-model";
import { businessV11, summaryV11 } from "./advertising-v11-fixtures";

jest.mock("@/hooks/useAdvertisingBusinessMetrics", () => ({
  useAdvertisingBusinessMetrics: jest.fn(),
}));
const useMetrics = jest.mocked(useAdvertisingBusinessMetrics);
function registered() {
  return {
    ...businessV11(),
    basis: "created" as const,
    countCoverage: { basis: "created" as const, complete: true, reasons: [] },
    revenueCoverage: { basis: "created" as const, complete: false, reasons: ["unknown-currency"] },
    coverage: { complete: false, reasons: ["unknown-currency"] },
    currencies: [{ ...businessV11().currencies[0], currency: null }],
  };
}
it("calcula inversión por pedido con conteo confirmado aunque no se conozca la moneda de la venta", () => {
  expect(advertisingSalesCost(summaryV11(), registered())).toEqual({
    cost: "8.341667",
    currency: "PEN",
    reason: null,
  });
});
it("no divide gasto parcial entre todos los pedidos ni mezcla monedas o alcances", () => {
  const summary = summaryV11();
  const business = registered();
  for (const invalid of [
    { ...summary, to: "2026-10-04" },
    { ...summary, storeId: "store-b" },
    { ...summary, currencies: [{ ...summary.currencies[0], coverage: "partial" as const }] },
    { ...summary, currencies: [{ ...summary.currencies[0], timeZones: ["UTC"] }] },
    {
      ...summary,
      currencies: [summary.currencies[0], { ...summary.currencies[0], currency: "USD" }],
    },
  ])
    expect(advertisingSalesCost(invalid, business).cost).toBeNull();
  expect(advertisingSalesCost(summary, { ...business, channelId: "channel-a" }).cost).toBeNull();
});
it("mantiene entregas sin fecha incompletas y no convierte cero pedidos en cero costo", () => {
  const business = {
    ...businessV11(),
    countCoverage: {
      basis: "delivered" as const,
      complete: false,
      reasons: ["missing-delivery-date"],
    },
  };
  expect(advertisingSalesCost(summaryV11(), business).reason).toContain("sin fecha");
  expect(advertisingSalesCost(summaryV11(), { ...registered(), totalOrders: 0 }).reason).toBe(
    "Sin pedidos registrados.",
  );
  const zeroSpend = {
    ...summaryV11(),
    currencies: [{ ...summaryV11().currencies[0], spend: "0" }],
  };
  expect(advertisingSalesCost(zeroSpend, registered()).cost).toBe("0.000000");
});
it("no interpreta el contrato viejo incompleto como un conteo completo", () => {
  const old = { ...registered(), countCoverage: undefined };
  expect(advertisingSalesCost(summaryV11(), old).cost).toBeNull();
});
it("separa el costo por entrega de la rentabilidad cuando sólo la moneda falta", () => {
  const summary = summaryV11();
  const business = {
    ...businessV11(),
    countCoverage: { basis: "delivered" as const, complete: true, reasons: [] },
    revenueCoverage: {
      basis: "delivered" as const,
      complete: false,
      reasons: ["unknown-currency"],
    },
    coverage: { complete: false, reasons: ["unknown-currency"] },
    currencies: [
      { ...businessV11().currencies[0], deliveredCount: 2 },
      { ...businessV11().currencies[0], currency: null, deliveredCount: 8 },
    ],
  };
  const result = compareAdvertisingBusinessCurrency(summary, summary.currencies[0], business);
  expect(result.costPerDelivered).toBe("10.010000");
  expect(result.revenueToSpend).toBeNull();
  expect(result.revenueReason).toContain("moneda");
  const mixedSpend = {
    ...summary,
    currencies: [...summary.currencies, { ...summary.currencies[0], currency: "USD" }],
  };
  expect(
    compareAdvertisingBusinessCurrency(mixedSpend, mixedSpend.currencies[0], business)
      .costPerDelivered,
  ).toBeNull();
  const confirmed = {
    ...business,
    coverage: { complete: true, reasons: [] },
    revenueCoverage: { basis: "delivered" as const, complete: true, reasons: [] },
    currencies: business.currencies.map((row) => ({ ...row, currency: row.currency ?? "USD" })),
  };
  const mixedResult = compareAdvertisingBusinessCurrency(
    mixedSpend,
    mixedSpend.currencies[0],
    confirmed,
  );
  expect(mixedResult.costPerDelivered).toBeNull();
  expect(mixedResult.revenueToSpend).not.toBeNull();
  expect(
    compareAdvertisingBusinessCurrency(summary, summary.currencies[0], confirmed, true)
      .costPerDelivered,
  ).toBeNull();
});
it("recorta hasta ayer sólo mediante una opción explícita y usa el día de Lima", () => {
  expect(
    advertisingClosedPeriod("2026-10-01", "2026-10-12", new Date("2026-10-12T04:30:00Z")),
  ).toEqual({ from: "2026-10-01", to: "2026-10-10" });
  expect(
    advertisingClosedPeriod("2026-09-01", "2026-09-30", new Date("2026-10-12T04:30:00Z")),
  ).toBeNull();
  expect(
    advertisingClosedPeriod("2026-10-12", "2026-10-12", new Date("2026-10-12T20:00:00Z")),
  ).toBeNull();
});
it("muestra el conteo disponible incluso si la inversión sigue parcial", () => {
  useMetrics.mockReturnValue({
    data: registered(),
    isError: false,
    isFetching: false,
  } as unknown as ReturnType<typeof useAdvertisingBusinessMetrics>);
  const summary = {
    ...summaryV11(),
    currencies: [{ ...summaryV11().currencies[0], coverage: "partial" as const }],
  };
  render(
    <AdvertisingSalesCostCard
      identity={{}}
      from={summary.from}
      to={summary.to}
      storeId="all"
      summary={summary}
    />,
  );
  expect(screen.getByText("12")).toBeInTheDocument();
  expect(
    screen.getByText("La inversión está incompleta o incluye días provisionales."),
  ).toBeInTheDocument();
  expect(screen.getByText(/también anulados/)).toBeInTheDocument();
});
it("muestra el fallo de ventas y no reutiliza valores cuando hay un error", () => {
  useMetrics.mockReturnValue({
    data: registered(),
    error: new Error("unavailable"),
    isError: true,
    isFetching: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useAdvertisingBusinessMetrics>);
  const summary = summaryV11();
  render(
    <AdvertisingSalesCostCard
      identity={{}}
      from={summary.from}
      to={summary.to}
      storeId="all"
      summary={summary}
    />,
  );
  expect(screen.getByText("No se pudieron cargar las ventas.")).toBeInTheDocument();
  expect(screen.queryByText("12")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reintentar ventas" })).toBeInTheDocument();
});
