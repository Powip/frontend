/**
 * Tests: Compras › Pedido sugerido (FEAT-24 H13-D3).
 *
 * 1. Grupos por proveedor con venta diaria, cobertura, disponible, mínimo, ya pedido, en camino, borradores
 *    (informativo), sugerido en la unidad de compra y monto estimado; `skipped.notInCatalog` como nota.
 * 2. Editar la cantidad recalcula unidades y monto; desmarcar saca la línea.
 * 3. Generar (Administrador u Operaciones): líneas en unidades de stock, almacén destino, clave estable en el
 *    reintento y nueva después de una generación que salió bien; enlaces a las OC; aviso de `duplicate`.
 * 4. Sin rol de costos: «••••», sin montos y sin botón de generar.
 * 5. Los filtros de la URL (atajo de la alerta) llegan al GET.
 * 6. El grupo sin proveedor pide elegir a quién comprarle.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { listPurchaseSuppliers, type PurchaseOrderDetail, type PurchaseSupplier } from "@/services/purchasesService";
import {
  generateSuggestedPurchase,
  getSuggestedPurchase,
  type SuggestedPurchase,
  type SuggestedPurchaseItem,
} from "@/services/suggestedPurchaseService";
import { getInventoryRules, listWarehouses } from "@/services/warehousesService";
import SuggestedPurchaseView from "../SuggestedPurchaseView";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => "/compras/sugerido" }));
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/services/suggestedPurchaseService", () => ({ getSuggestedPurchase: jest.fn(), generateSuggestedPurchase: jest.fn() }));
jest.mock("@/services/purchasesService", () => ({ listPurchaseSuppliers: jest.fn() }));
jest.mock("@/services/warehousesService", () => ({ listWarehouses: jest.fn(), getInventoryRules: jest.fn() }));
jest.mock("@/hooks/useMyWarehouses");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __setMyWarehouses } = require("@/hooks/useMyWarehouses") as typeof import("@/hooks/__mocks__/useMyWarehouses");

const S1 = "22222222-2222-4222-8222-222222222222";
const S2 = "33333333-3333-4333-8333-333333333333";
const W1 = "11111111-1111-4111-8111-111111111111";
const W2 = "44444444-4444-4444-8444-444444444444";

function item(overrides: Partial<SuggestedPurchaseItem> = {}): SuggestedPurchaseItem {
  return {
    variantId: "v-1",
    sku: "POL-M",
    productName: "Polo",
    attributes: { Talla: "M" },
    unitsSold: 60,
    vd: 2,
    coverageDays: 5,
    physical: 12,
    reserved: 2,
    available: 10,
    minStock: 6,
    incomingTransfer: 3,
    pendingPurchase: 4,
    draftQuantity: 7,
    targetDays: 30,
    needed: 55,
    purchaseUnit: "Caja",
    purchaseFactor: 12,
    purchaseQuantity: 5,
    suggested: 60,
    supplierId: S1,
    supplierName: "Textiles",
    supplierActive: true,
    lastUnitCost: 10,
    lastPurchaseDate: "2026-11-01",
    lastPurchaseNumber: "OC-0001",
    lastPurchaseOrderId: "oc-1",
    estimatedAmount: 600,
    ...overrides,
  };
}

const totals = { variants: 1, units: 60, purchaseQuantity: 5, estimatedAmount: 600, withoutPrice: 0 };

function suggestion(overrides: Partial<SuggestedPurchase> = {}): SuggestedPurchase {
  return {
    inventoryId: null,
    warehouseIds: [W1],
    days: 30,
    targetDays: 30,
    includeWithoutSales: false,
    supplierId: null,
    generatedAt: "2026-11-18T15:00:00Z",
    groups: [
      { supplierId: S1, supplierName: "Textiles", supplierActive: true, totals: { ...totals }, items: [item(), item({ variantId: "v-2", sku: "POL-L", attributes: { Talla: "L" }, coverageDays: null, vd: 0, draftQuantity: 0, pendingPurchase: 0, incomingTransfer: 0 })] },
      { supplierId: S2, supplierName: "Hilos", supplierActive: true, totals: { ...totals }, items: [item({ variantId: "v-3", productName: "Gorra", attributes: {}, sku: "GOR", purchaseFactor: 1, purchaseUnit: null, purchaseQuantity: 4, suggested: 4, supplierId: S2, lastUnitCost: 5 })] },
    ],
    totals: { ...totals, variants: 3, groups: 2 },
    skipped: { notInCatalog: 0 },
    ...overrides,
  };
}

function supplier(id: string, name: string): PurchaseSupplier {
  return { id, companyId: "c-1", name, businessName: null, tradeName: null, ruc: null, contactPerson: null, phone: null, email: null, fiscalAddress: null, paymentTerms: "contado", active: true, purchaseCount: 1, createdAt: "", updatedAt: "" };
}

function order(id: string, number: string, supplierName: string): PurchaseOrderDetail {
  return { id, number, supplierName, lines: [{ id: "l-1" }] } as unknown as PurchaseOrderDetail;
}

function loginAs(role: string) {
  jest.mocked(useAuth).mockReturnValue({
    auth: { accessToken: "t", user: { id: "u-1", email: "ana@powip.test", role, permissions: [] }, company: { id: "c-1", stores: [] } },
  } as unknown as ReturnType<typeof useAuth>);
}

function setup(initialFilters = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SuggestedPurchaseView initialFilters={initialFilters} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  __setMyWarehouses(null);
  loginAs("ADMINISTRADOR");
  jest.mocked(getSuggestedPurchase).mockResolvedValue(suggestion());
  jest.mocked(listPurchaseSuppliers).mockResolvedValue([supplier(S1, "Textiles"), supplier(S2, "Hilos")]);
  jest.mocked(listWarehouses).mockResolvedValue({
    warehouses: [
      { id: W1, name: "Almacén central", status: true, store_id: "st", company_id: "c-1", type: "PROPIO", is_main: true },
      { id: W2, name: "Tienda Miraflores", status: true, store_id: "st", company_id: "c-1", type: "TIENDA", is_main: false },
    ],
    links: [],
  });
  jest.mocked(getInventoryRules).mockResolvedValue({ releaseAfterDays: null, pickingRequired: false, igvAffected: true, allowPurchaseToCourier: false, defaultCoverageDays: 30 });
});

describe("Pedido sugerido", () => {
  it("agrupa por proveedor con venta diaria, cobertura, stock, lo pedido, borradores y monto", async () => {
    setup();
    const group = await screen.findByTestId(`sg-group-${S1}`);
    expect(group).toHaveTextContent("Textiles");
    expect(screen.getByTestId(`sg-group-${S2}`)).toHaveTextContent("Hilos");
    const row = screen.getByText("Polo · Talla: M").closest("tr") as HTMLElement;
    const cells = within(row).getAllByRole("cell").map((cell) => cell.textContent?.trim());
    // vd, cobertura, disponible, mínimo, ya pedido, en camino, borradores
    expect(cells.slice(2, 9)).toEqual(["2", "5 días", "10", "6", "4", "3", "7"]);
    expect(screen.getByLabelText("Pedir: Polo · Talla: M")).toHaveValue("5");
    expect(within(row).getByText("Caja × 12")).toBeInTheDocument();
    expect(screen.getByTestId("sg-units-v-1")).toHaveTextContent("60");
    expect(screen.getByTestId("sg-amount-v-1")).toHaveTextContent(/600\.00/);
    // Sin ventas: cobertura «—».
    expect(screen.getByTestId("sg-coverage-v-2")).toHaveTextContent("—");
    expect(screen.getByTestId("sg-coverage-v-1").className).toMatch(/amber/);
    expect(screen.getByTestId("sg-summary")).toHaveTextContent("Venta de los últimos 30 días · cubrir 30 días");
    expect(screen.queryByTestId("sg-skipped")).not.toBeInTheDocument();
    expect(getSuggestedPurchase).toHaveBeenCalledWith({ days: 30 }, expect.anything());
  });

  it("muestra como nota los productos que el catálogo no devolvió", async () => {
    jest.mocked(getSuggestedPurchase).mockResolvedValue(suggestion({ skipped: { notInCatalog: 2 } }));
    setup();
    expect(await screen.findByTestId("sg-skipped")).toHaveTextContent("2 productos no se muestran");
  });

  it("editar la cantidad recalcula unidades y monto; desmarcar saca la línea del resumen", async () => {
    const user = userEvent.setup();
    setup();
    const quantity = await screen.findByLabelText("Pedir: Polo · Talla: M");
    expect(screen.getByTestId("sg-selection")).toHaveTextContent("2 órdenes · 3 productos · 124 und");
    await user.clear(quantity);
    await user.type(quantity, "2");
    expect(screen.getByTestId("sg-units-v-1")).toHaveTextContent("24");
    expect(screen.getByTestId("sg-amount-v-1")).toHaveTextContent(/240\.00/);
    await user.click(screen.getByRole("checkbox", { name: "Incluir Gorra" }));
    expect(screen.getByTestId("sg-selection")).toHaveTextContent("1 orden · 2 productos · 84 und");
    await user.clear(quantity);
    await user.type(quantity, "x");
    expect(screen.getByText("Escribe un número entero.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generar órdenes de compra" })).toBeDisabled();
  });

  it("genera una OC por proveedor con la clave estable en el reintento y muestra los enlaces", async () => {
    const user = userEvent.setup();
    jest.mocked(generateSuggestedPurchase)
      .mockRejectedValueOnce({ response: { status: 503, data: { message: "Logística no responde." } } })
      .mockResolvedValueOnce({ runId: "r-1", inventoryId: W1, duplicate: false, purchaseOrders: [order("oc-10", "OC-0010", "Textiles"), order("oc-11", "OC-0011", "Hilos")] })
      .mockResolvedValueOnce({ runId: "r-2", inventoryId: W1, duplicate: false, purchaseOrders: [order("oc-12", "OC-0012", "Textiles")] });
    setup();
    await screen.findByLabelText("Pedir: Polo · Talla: M");
    await waitFor(() => expect(screen.getByLabelText("Las órdenes llegan a")).toHaveValue(W1));
    await user.click(screen.getByRole("button", { name: "Generar órdenes de compra" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Logística no responde.");
    const [body, firstKey] = jest.mocked(generateSuggestedPurchase).mock.calls[0];
    expect(body).toEqual({
      inventoryId: W1,
      lines: [
        { variantId: "v-1", quantity: 60, supplierId: S1 },
        { variantId: "v-2", quantity: 60, supplierId: S1 },
        { variantId: "v-3", quantity: 4, supplierId: S2 },
      ],
    });
    expect(firstKey).toEqual(expect.any(String));

    await user.click(screen.getByRole("button", { name: "Generar órdenes de compra" }));
    const status = await screen.findByRole("status");
    expect(jest.mocked(generateSuggestedPurchase).mock.calls[1][1]).toBe(firstKey);
    expect(status).toHaveTextContent("Se crearon 2 órdenes de compra en borrador");
    expect(within(status).getByRole("link", { name: "OC-0010" })).toHaveAttribute("href", "/compras?oc=oc-10");
    expect(within(status).getByRole("link", { name: "OC-0011" })).toHaveAttribute("href", "/compras?oc=oc-11");

    await screen.findByLabelText("Pedir: Polo · Talla: M");
    await user.click(screen.getByRole("button", { name: "Generar órdenes de compra" }));
    await waitFor(() => expect(generateSuggestedPurchase).toHaveBeenCalledTimes(3));
    expect(jest.mocked(generateSuggestedPurchase).mock.calls[2][1]).not.toBe(firstKey);
  });

  it("si la generación ya estaba registrada (duplicate) avisa que son las mismas órdenes", async () => {
    const user = userEvent.setup();
    jest.mocked(generateSuggestedPurchase).mockResolvedValue({ runId: "r-1", inventoryId: W1, duplicate: true, purchaseOrders: [order("oc-10", "OC-0010", "Textiles")] });
    setup();
    await screen.findByLabelText("Pedir: Polo · Talla: M");
    await user.click(screen.getByRole("button", { name: "Generar órdenes de compra" }));
    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("ya estaba registrada");
    expect(within(status).getByRole("link", { name: "OC-0010" })).toHaveAttribute("href", "/compras?oc=oc-10");
  });

  it("Operaciones también genera, hacia el almacén elegido", async () => {
    loginAs("OPERACIONES");
    const user = userEvent.setup();
    jest.mocked(generateSuggestedPurchase).mockResolvedValue({ runId: "r-1", inventoryId: W2, duplicate: false, purchaseOrders: [] });
    setup();
    await screen.findByLabelText("Pedir: Polo · Talla: M");
    await waitFor(() => expect(within(screen.getByLabelText("Las órdenes llegan a")).getAllByRole("option")).toHaveLength(2));
    await user.selectOptions(screen.getByLabelText("Las órdenes llegan a"), W2);
    await user.click(screen.getByRole("button", { name: "Generar órdenes de compra" }));
    await waitFor(() => expect(generateSuggestedPurchase).toHaveBeenCalledWith(expect.objectContaining({ inventoryId: W2 }), expect.any(String)));
  });

  it("sin rol de costos muestra «••••», sin montos y sin botón de generar", async () => {
    loginAs("VENTAS");
    const masked = suggestion();
    for (const group of masked.groups) {
      delete group.totals.estimatedAmount;
      for (const line of group.items) {
        delete line.lastUnitCost;
        delete line.estimatedAmount;
      }
    }
    jest.mocked(getSuggestedPurchase).mockResolvedValue(masked);
    setup();
    expect(await screen.findByTestId("sg-amount-v-1")).toHaveTextContent("••••");
    expect(screen.queryByText(/600\.00/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generar órdenes de compra" })).not.toBeInTheDocument();
    expect(screen.getByText("Solo el Administrador u Operaciones pueden generar órdenes de compra.")).toBeInTheDocument();
  });

  it("los filtros de la URL (atajo de la alerta «Bajo mínimo») llegan al cálculo", async () => {
    setup({ includeWithoutSales: true, supplierId: S2 });
    await screen.findByLabelText("Pedir: Polo · Talla: M");
    expect(getSuggestedPurchase).toHaveBeenCalledWith({ days: 30, includeWithoutSales: true, supplierId: S2 }, expect.anything());
    expect(screen.getByRole("checkbox", { name: "Incluir sin ventas bajo el mínimo" })).toBeChecked();
    await waitFor(() => expect(screen.getByLabelText("Proveedor")).toHaveValue(S2));
  });

  it("cambiar los días vuelve a calcular con los días nuevos", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByLabelText("Pedir: Polo · Talla: M");
    const target = screen.getByLabelText("Cubrir");
    await user.type(target, "45");
    await user.tab();
    await waitFor(() => expect(getSuggestedPurchase).toHaveBeenLastCalledWith({ days: 30, targetDays: 45 }, expect.anything()));
  });

  it("el grupo sin proveedor pide elegir a quién comprarle antes de generar", async () => {
    const user = userEvent.setup();
    jest.mocked(getSuggestedPurchase).mockResolvedValue(
      suggestion({ groups: [{ supplierId: null, supplierName: null, supplierActive: null, totals: { ...totals }, items: [item({ supplierId: null, supplierName: null, lastUnitCost: null, estimatedAmount: null })] }] }),
    );
    jest.mocked(generateSuggestedPurchase).mockResolvedValue({ runId: "r-1", inventoryId: W1, duplicate: false, purchaseOrders: [] });
    setup();
    await screen.findByLabelText("Pedir: Polo · Talla: M");
    expect(screen.getByTestId("sg-group-__sin_proveedor__")).toHaveTextContent("Sin proveedor");
    expect(screen.getByTestId("sg-problem")).toHaveTextContent("Elige a quién comprarle los productos sin proveedor o desmárcalos.");
    expect(screen.getByRole("button", { name: "Generar órdenes de compra" })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText("Comprar a (Sin proveedor)"), S2);
    await user.click(screen.getByRole("button", { name: "Generar órdenes de compra" }));
    await waitFor(() =>
      expect(generateSuggestedPurchase).toHaveBeenCalledWith(expect.objectContaining({ lines: [{ variantId: "v-1", quantity: 60, supplierId: S2 }] }), expect.any(String)),
    );
  });
});
