import { render, screen } from "@testing-library/react";
import { advertisingSegmentColor, advertisingStackedSeries } from "../AdvertisingStackedSpendChart";
import { AdvertisingSummaryCards } from "../AdvertisingSummaryCards";
import { compareAdvertisingBusinessCurrency } from "../advertising-business-metrics-model";
import { businessV11, summaryV11 } from "./advertising-v11-fixtures";

it("combina sólo gasto efectivo y entregas de igual periodo, tienda, moneda y zona", () => {
  const summary = summaryV11(),
    business = businessV11();
  expect(compareAdvertisingBusinessCurrency(summary, summary.currencies[0], business)).toEqual({
    costPerDelivered: "10.010000",
    revenueToSpend: "10.00",
    reason: null,
  });
  for (const changed of [
    { ...business, to: "2026-10-02" },
    { ...business, storeId: "store-b" },
    { ...business, channelId: "channel-b" },
    { ...business, timeZone: "UTC" },
    { ...business, coverage: { complete: false, reasons: ["missing-delivered-date"] } },
    { ...business, currencies: [{ ...business.currencies[0], currency: null }] },
  ]) {
    expect(
      compareAdvertisingBusinessCurrency(summary, summary.currencies[0], changed).costPerDelivered,
    ).toBeNull();
  }
  expect(
    compareAdvertisingBusinessCurrency(summary, summary.currencies[0], business, true)
      .costPerDelivered,
  ).toBeNull();
  expect(
    compareAdvertisingBusinessCurrency({ ...summary, storeId: "none" }, summary.currencies[0], {
      ...business,
      storeId: "none",
    }).costPerDelivered,
  ).toBeNull();
  expect(
    compareAdvertisingBusinessCurrency(
      summary,
      { ...summary.currencies[0], coverage: "partial" },
      business,
    ).costPerDelivered,
  ).toBeNull();
  expect(
    compareAdvertisingBusinessCurrency(
      summary,
      { ...summary.currencies[0], timeZones: [] },
      business,
    ).costPerDelivered,
  ).toBeNull();
});
it("conserva decimales exactos y no rellena un día pendiente con cero", () => {
  const summary = summaryV11();
  summary.currencies[0].completeDates = ["2026-10-02"];
  summary.series.push({ ...summary.series[0], spend: "0.00000001" });
  const data = advertisingStackedSeries(summary, summary.currencies[0]);
  expect(data.days.map((day) => day.spend)).toEqual(["100.10000001", "0", null]);
  expect(data.days[2].amounts["segment-0"]).toBeNull();
  expect(data.segments[0].amount).toBe("100.10000001");
});
it("no agrega monedas ni admite colores arbitrarios de la API", () => {
  const summary = summaryV11();
  summary.series.push({ ...summary.series[0], currency: "USD", spend: "900" });
  expect(advertisingStackedSeries(summary, summary.currencies[0]).segments[0].amount).toBe(
    "100.10",
  );
  expect(advertisingSegmentColor("url(https://example.com)", 0)).toBe("var(--chart-1)");
  expect(advertisingSegmentColor("#abcdef", 0)).toBe("#abcdef");
  expect(() =>
    advertisingStackedSeries({ ...summary, to: "2029-10-01" }, summary.currencies[0]),
  ).toThrow();
});
it("muestra frecuencia del periodo, aproximación y CTR de enlace con su fuente", () => {
  render(<AdvertisingSummaryCards summary={summaryV11()} business={businessV11()} />);
  expect(screen.getByText("CTR de enlace · Meta")).toBeInTheDocument();
  expect(screen.getByText("1.25 %")).toBeInTheDocument();
  expect(screen.getByText("3.20")).toBeInTheDocument();
  expect(screen.getByText("Aproximada entre cuentas.")).toBeInTheDocument();
  expect(screen.getByText("Alta · más de 3")).toBeInTheDocument();
});
it("mantiene métricas no verificadas pendientes aunque lleguen números", () => {
  const summary = summaryV11();
  summary.currencies[0].periodMetricsStatus = "unknown";
  render(<AdvertisingSummaryCards summary={summary} />);
  expect(screen.queryByText("1.25 %")).not.toBeInTheDocument();
  expect(screen.queryByText("3.20")).not.toBeInTheDocument();
  expect(screen.queryByText("Alta · más de 3")).not.toBeInTheDocument();
});

it("incluye porcentajes por moneda sobre los importes disponibles, sin convertir monedas", () => {
  const summary = summaryV11();
  summary.series = [
    { ...summary.series[0], spend: "25" },
    {
      ...summary.series[0],
      segment: { ...summary.series[0].segment, id: "store-b", name: "Norte" },
      spend: "75",
    },
    { ...summary.series[0], currency: "USD", spend: "900" },
  ];
  const data = advertisingStackedSeries(summary, summary.currencies[0]);
  expect(data.segments.map((segment) => segment.percentage?.replace(/\s/g, ""))).toEqual([
    "25%",
    "75%",
  ]);
});

it("mantiene leads e impresiones conocidos separados de los otros resultados desconocidos", () => {
  const summary = summaryV11();
  summary.currencies[0].costPerResult = [
    {
      type: "leads",
      resultType: "lead",
      label: "Leads (Meta)",
      count: "5",
      costPerResult: "20.02",
      status: "complete",
    },
    {
      type: "other",
      resultType: "impressions",
      label: "Impresiones",
      count: "1000",
      costPerResult: "0.1001",
      status: "complete",
    },
    {
      type: "other",
      resultType: null,
      label: "Otros resultados",
      count: null,
      costPerResult: null,
      status: "unknown",
    },
  ];
  const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    render(<AdvertisingSummaryCards summary={summary} />);
    expect(screen.getByText("Leads (Meta)")).toBeVisible();
    expect(screen.getByText("Impresiones")).toBeVisible();
    expect(screen.getByText("Otros resultados")).toBeVisible();
    expect(error).not.toHaveBeenCalled();
  } finally {
    error.mockRestore();
  }
});

it("distingue compras medidas de un evento de optimización sin confirmar", () => {
  const summary = summaryV11();
  summary.currencies[0].costPerResult = [
    {
      type: "webPurchases",
      resultType: "purchase",
      label: "Compras por web (medidas)",
      count: "4",
      costPerResult: "25.025",
      status: "complete",
      source: "reported-action",
      limitation: "optimization-event-unconfirmed",
    },
  ];
  render(<AdvertisingSummaryCards summary={summary} />);
  expect(screen.getByText("Compras por web (medidas)")).toBeVisible();
  expect(screen.getByText("Resultados reportados por Meta.")).toBeVisible();
  expect(screen.getByText("Evento optimizado por confirmar.")).toBeVisible();
});
