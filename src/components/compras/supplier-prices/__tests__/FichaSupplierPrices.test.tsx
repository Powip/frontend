/**
 * Tests: ficha del producto › «Precio de compra por proveedor» (FEAT-24 H13-D4).
 *
 * 1. Una fila por proveedor de la variante elegida (el mejor último precio primero, con su etiqueta), con
 *    promedio, mínimo, compras, unidades y fechas; elegir otra variante trae su historial.
 * 2. Sin rol de costos: «••••» y sin «Mejor precio».
 * 3. Sin compras de la variante lo dice.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getSupplierPrices, type SupplierPrice } from "@/services/suggestedPurchaseService";
import FichaSupplierPrices from "../FichaSupplierPrices";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "t", user: { id: "u-1", role: "ADMINISTRADOR" }, company: { id: "c-1" } } }) }));
jest.mock("@/services/suggestedPurchaseService", () => ({ getSupplierPrices: jest.fn() }));

function price(overrides: Partial<SupplierPrice>): SupplierPrice {
  return {
    variantId: "v-1",
    sku: "POL-M",
    productName: "Polo",
    supplierId: "s-1",
    supplierName: "Textiles",
    supplierActive: true,
    purchases: 2,
    units: 48,
    lastUnitCost: 11,
    averageUnitCost: 10.5,
    minUnitCost: 10,
    maxUnitCost: 11,
    lastPurchaseUnit: "Caja",
    lastPurchaseFactor: 12,
    lastPurchaseNumber: "OC-0004",
    lastPurchaseOrderId: "oc-4",
    firstDate: "2026-07-10",
    lastDate: "2026-10-20",
    ...overrides,
  };
}

const VARIANTS = [
  { id: "v-1", label: "Talla: M (POL-M)" },
  { id: "v-2", label: "Talla: L (POL-L)" },
];

function setup(linkOrders = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FichaSupplierPrices variants={VARIANTS} linkOrders={linkOrders} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getSupplierPrices).mockImplementation(async ({ variantId }) =>
    variantId === "v-1"
      ? { items: [price({}), price({ supplierId: "s-2", supplierName: "Hilos", lastUnitCost: 9.5, supplierActive: false, lastPurchaseNumber: "OC-0006", lastPurchaseOrderId: "oc-6" })], total: 2, truncated: false }
      : { items: [], total: 0, truncated: false },
  );
});

describe("precio de compra por proveedor en la ficha", () => {
  it("lista los proveedores de la variante, el mejor precio primero, con su historial", async () => {
    setup();
    const best = await screen.findByTestId("supplier-price-s-2");
    const rows = screen.getAllByTestId(/^supplier-price-/);
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual(["supplier-price-s-2", "supplier-price-s-1"]);
    expect(within(best).getByText("Mejor precio")).toBeInTheDocument();
    expect(within(best).getByText("Inactivo")).toBeInTheDocument();
    const cells = within(screen.getByTestId("supplier-price-s-1")).getAllByRole("cell").map((cell) => cell.textContent?.trim());
    expect(cells[0]).toBe("Textiles");
    expect(cells[1]).toMatch(/11\.00/);
    expect(cells[2]).toMatch(/10\.50/);
    expect(cells[3]).toMatch(/10\.00/);
    expect(cells.slice(5, 8)).toEqual(["2", "48", "10/07/2026"]);
    expect(within(screen.getByTestId("supplier-price-s-1")).getByRole("link", { name: "OC-0004" })).toHaveAttribute("href", "/compras?oc=oc-4");
    expect(getSupplierPrices).toHaveBeenCalledWith({ variantId: "v-1" }, expect.anything());
  });

  it("elegir otra variante trae su historial (y si no tiene compras lo dice)", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByTestId("supplier-price-s-2");
    await user.selectOptions(screen.getByLabelText("Variante"), "v-2");
    expect(await screen.findByText("Todavía no hay compras emitidas o recibidas de esta variante.")).toBeInTheDocument();
    await waitFor(() => expect(getSupplierPrices).toHaveBeenCalledWith({ variantId: "v-2" }, expect.anything()));
  });

  it("sin rol de costos muestra «••••», sin «Mejor precio» ni enlace a la OC", async () => {
    jest.mocked(getSupplierPrices).mockImplementation(async () => {
      const masked = [price({}), price({ supplierId: "s-2", supplierName: "Hilos" })].map((row) => {
        const copy: Partial<SupplierPrice> = { ...row };
        delete copy.lastUnitCost;
        delete copy.averageUnitCost;
        delete copy.minUnitCost;
        delete copy.maxUnitCost;
        return copy as SupplierPrice;
      });
      return { items: masked, total: 2, truncated: false };
    });
    setup(false);
    const row = await screen.findByTestId("supplier-price-s-1");
    expect(within(row).getAllByText("••••")).toHaveLength(4);
    expect(screen.queryByText("Mejor precio")).not.toBeInTheDocument();
    expect(within(row).queryByRole("link")).not.toBeInTheDocument();
  });
});
