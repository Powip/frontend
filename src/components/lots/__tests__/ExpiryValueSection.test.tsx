/**
 * Tests: «Vencimiento en dinero» en Alertas (FEAT-24 H5-L).
 *
 * 1. Totales (vencido, dentro del aviso, después, perdido) y un renglón por lote con el nombre de la variante.
 * 2. Sin rol de costos (la fachada omite los montos) todo sale «••••».
 * 3. El filtro de almacén ofrece solo los que el usuario ve y vuelve a pedir con ese almacén.
 * 4. Excel y PDF.
 * 5. Si la empresa no tiene lotes por vencer ni mermas por vencimiento, no se muestra.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getExpiringLots, type ExpiringLots } from "@/services/lotsService";
import { fetchVariantsByIds } from "@/services/variantCodesService";
import { downloadWorkbook } from "@/lib/reports/excel";
import ExpiryValueSection from "../ExpiryValueSection";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "t", company: { id: "c1" }, user: { id: "u1", role: "OPERACIONES" } } }) }));
jest.mock("@/services/lotsService", () => ({ LOTS_QUERY_KEY: "lots", getExpiringLots: jest.fn() }));
jest.mock("@/services/variantCodesService", () => ({ fetchVariantsByIds: jest.fn() }));
jest.mock("@/hooks/useMyWarehouses");
jest.mock("@/hooks/useCompanyWarehouses", () => ({
  useCompanyWarehouses: () => ({
    warehouses: [
      { id: "w1", name: "Breña", status: true },
      { id: "w2", name: "Arequipa", status: true },
      { id: "w3", name: "Trujillo", status: true },
    ],
    nameOf: (id: string) => ({ w1: "Breña", w2: "Arequipa", w3: "Trujillo" })[id] ?? "Almacén",
  }),
}));
const pdfDownload = jest.fn();
jest.mock("@/hooks/usePdfDownload", () => ({ usePdfDownload: () => pdfDownload, useReportAuthor: () => "Ana" }));
jest.mock("@/lib/reports/excel", () => ({ ...jest.requireActual("@/lib/reports/excel"), downloadWorkbook: jest.fn().mockResolvedValue(undefined) }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __setMyWarehouses } = require("@/hooks/useMyWarehouses") as typeof import("@/hooks/__mocks__/useMyWarehouses");

const DATA: ExpiringLots = {
  today: "2026-11-18",
  days: 90,
  alertDays: 30,
  items: [
    { lotId: "l3", lotNumber: "A117", variantId: "v1", inventoryId: "w1", inventoryName: "Breña", expiresAt: "2026-10-31", daysToExpiry: -18, status: "vencido", quantity: 3, averageCost: 10, value: 30 },
    { lotId: "l2", lotNumber: "L2402", variantId: "v1", inventoryId: "w1", inventoryName: "Breña", expiresAt: "2026-11-25", daysToExpiry: 7, status: "vigente", quantity: 12, averageCost: 10, value: 120 },
  ],
  truncated: false,
  totals: {
    expired: { lots: 1, units: 3, value: 30, withoutCost: { lots: 0, units: 0 } },
    withinAlert: { lots: 1, units: 12, value: 120, withoutCost: { lots: 0, units: 0 } },
    later: { lots: 0, units: 0, value: 0, withoutCost: { lots: 0, units: 0 } },
    all: { lots: 2, units: 15, value: 150, withoutCost: { lots: 0, units: 0 } },
  },
  lostByExpiry: [
    { period: "2026-10", units: 4, value: 64.8, unitsWithoutCost: 0 },
    { period: "2026-11", units: 0, value: 0, unitsWithoutCost: 0 },
  ],
};

const MASKED: ExpiringLots = {
  ...DATA,
  items: DATA.items.map((row) => ({ lotId: row.lotId, lotNumber: row.lotNumber, variantId: row.variantId, inventoryId: row.inventoryId, inventoryName: row.inventoryName, expiresAt: row.expiresAt, daysToExpiry: row.daysToExpiry, status: row.status, quantity: row.quantity })),
  totals: {
    expired: { lots: 1, units: 3 },
    withinAlert: { lots: 1, units: 12 },
    later: { lots: 0, units: 0 },
    all: { lots: 2, units: 15 },
  },
  lostByExpiry: DATA.lostByExpiry.map((month) => ({ period: month.period, units: month.units })),
};

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ExpiryValueSection />
    </QueryClientProvider>,
  );
}

const money = (text: string) => text.replace(/ /g, " ");

beforeEach(() => {
  jest.clearAllMocks();
  __setMyWarehouses(null);
  jest.mocked(getExpiringLots).mockResolvedValue(DATA);
  jest.mocked(fetchVariantsByIds).mockResolvedValue([
    { id: "v1", sku: "INT-1", companySku: "CRE-50", barcode: null, powipEan: null, attributeValues: { Tamaño: "50 ml" }, productName: "Crema Centella" },
  ]);
});

describe("Vencimiento en dinero (FEAT-24 H5-L)", () => {
  it("totales por rango, lo perdido y un renglón por lote con su nombre", async () => {
    setup();
    const section = await screen.findByRole("region", { name: "Vencimiento en dinero" });
    expect(getExpiringLots).toHaveBeenCalledWith({ days: 90, inventoryId: undefined }, expect.anything());
    const totals = within(section).getByLabelText("Totales de vencimiento");
    expect(money(totals.textContent ?? "")).toContain("Ya vencidoS/ 30.00");
    expect(money(totals.textContent ?? "")).toContain("Vence en 30 díasS/ 120.00");
    expect(totals).toHaveTextContent("Vence en 31–90 días");
    expect(money(totals.textContent ?? "")).toContain("Perdido por vencimientoS/ 64.80");
    const expired = await within(section).findByTestId("vence-l3-w1");
    await waitFor(() => expect(expired).toHaveTextContent("Crema Centella · Tamaño: 50 ml"));
    expect(expired).toHaveTextContent("CRE-50");
    expect(expired).toHaveTextContent("A117");
    expect(expired).toHaveTextContent("Vencido hace 18 días");
    expect(money(expired.textContent ?? "")).toContain("S/ 30.00");
    expect(within(section).getByTestId("vence-l2-w1")).toHaveTextContent("En 7 días");
    expect(fetchVariantsByIds).toHaveBeenCalledWith(["v1"], "c1");
  });

  it("sin rol de costos los montos salen «••••»", async () => {
    jest.mocked(getExpiringLots).mockResolvedValue(MASKED);
    setup();
    const section = await screen.findByRole("region", { name: "Vencimiento en dinero" });
    const totals = within(section).getByLabelText("Totales de vencimiento");
    expect(within(totals).getAllByText("••••")).toHaveLength(4);
    expect(within(section).getByTestId("vence-l3-w1")).toHaveTextContent("••••");
    expect(totals).toHaveTextContent("Oct •••• · Nov ••••");
  });

  it("el filtro ofrece solo los almacenes que el usuario ve y vuelve a pedir con ese almacén", async () => {
    const user = userEvent.setup();
    __setMyWarehouses({ all: false, inventoryIds: ["w1", "w2"], operableIds: ["w1"] });
    setup();
    const select = await screen.findByLabelText("Almacén");
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual(["Todos los almacenes", "Breña", "Arequipa"]);
    jest.mocked(getExpiringLots).mockResolvedValue({ ...DATA, items: [], totals: MASKED.totals, lostByExpiry: [] });
    await user.selectOptions(select, "w2");
    await waitFor(() => expect(getExpiringLots).toHaveBeenLastCalledWith({ days: 90, inventoryId: "w2" }, expect.anything()));
    expect(await screen.findByText("Nada vence en los próximos 90 días.")).toBeInTheDocument();
  });

  it("descarga el Excel y el PDF", async () => {
    const user = userEvent.setup();
    setup();
    const section = await screen.findByRole("region", { name: "Vencimiento en dinero" });
    await within(section).findAllByText("Crema Centella · Tamaño: 50 ml");
    await user.click(within(section).getByRole("button", { name: "Descargar Excel" }));
    await waitFor(() => expect(downloadWorkbook).toHaveBeenCalledTimes(1));
    expect(jest.mocked(downloadWorkbook).mock.calls[0][1]).toMatch(/^vencimiento-\d{4}-\d{2}-\d{2}$/);
    await user.click(within(section).getByRole("button", { name: "Descargar PDF" }));
    await waitFor(() => expect(pdfDownload).toHaveBeenCalledTimes(1));
    expect(pdfDownload.mock.calls[0][0]).toMatchObject({ title: "Vencimiento en dinero" });
    expect(pdfDownload.mock.calls[0][0].tables[0].rows[0][0]).toBe("Crema Centella · Tamaño: 50 ml");
  });

  it("sin lotes por vencer ni mermas por vencimiento no se muestra", async () => {
    jest.mocked(getExpiringLots).mockResolvedValue({ ...DATA, items: [], lostByExpiry: [{ period: "2026-11", units: 0, value: 0 }] });
    const { container } = setup();
    await waitFor(() => expect(getExpiringLots).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container).toBeEmptyDOMElement();
  });
});
