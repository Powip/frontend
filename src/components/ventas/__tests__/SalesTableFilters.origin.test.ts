import { applyFilters, SOURCE_OPTIONS, type SalesFilters } from "../SalesTableFilters";

// FEAT-33 A7: «Todos» primero y el filtro de Origen filtra POWIP Live y POWIP Link (Finanzas, Atención).
const sale = (orderNumber: string, externalSource: string | null) => ({
  orderNumber,
  clientName: "Cliente",
  phoneNumber: "999999999",
  date: "24/11/2026",
  paymentMethod: "YAPE",
  pendingPayment: 0,
  salesRegion: "LIMA" as const,
  deliveryType: "DOMICILIO",
  externalSource,
});
const sales = [
  sale("ORD-1", "POWIP_LIVE"),
  sale("ORD-2", "POWIP_LINK"),
  sale("ORD-3", "SHOPIFY"),
  sale("ORD-4", null),
];
const filter = (source: string) => ({ source }) as unknown as SalesFilters;

test("«Todos» is the first origin option", () => {
  expect(SOURCE_OPTIONS[0]).toEqual({ value: "", label: "Todos" });
  expect(SOURCE_OPTIONS.map((option) => option.label)).toEqual([
    "Todos",
    "POWIP Live",
    "POWIP Link",
    "Powip",
    "Shopify",
    "Google Sheets",
  ]);
});

test.each([
  ["powip_live", ["ORD-1"]],
  ["powip_link", ["ORD-2"]],
  ["shopify", ["ORD-3"]],
  ["manual", ["ORD-4"]],
  ["", ["ORD-1", "ORD-2", "ORD-3", "ORD-4"]],
])("origin %p keeps %j", (source, kept) => {
  expect(applyFilters(sales, filter(source)).map((row) => row.orderNumber)).toEqual(kept);
});
