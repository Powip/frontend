/**
 * Tests: formulario de la orden de compra (FEAT-24 H3-E).
 *
 * 1. Agregar un producto trae sus variantes activas con la unidad de compra del producto (caja × 12) y el precio
 *    sugerido desde el costo promedio.
 * 2. Vista previa SIN IGV en los precios: subtotal + 18 % = total; los gastos van al costo y no al total.
 * 3. Vista previa CON IGV incluido: el total es lo tipeado y el subtotal es sin IGV.
 * 4. Empresa no afecta al IGV: el interruptor queda apagado y no hay IGV.
 * 5. «Emitir orden» guarda el borrador (sin montos) y lo emite; si la emisión falla, el reintento edita el mismo.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createPurchaseOrder,
  getVariantCosts,
  listProductVariants,
  listPurchasableProducts,
  listPurchaseSuppliers,
  placePurchaseOrder,
  updatePurchaseOrder,
  type PurchaseOrder,
} from "@/services/purchasesService";
import { getInventoryRules, listWarehouses } from "@/services/warehousesService";
import PurchaseOrderFormDialog from "../PurchaseOrderFormDialog";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/services/purchasesService", () => ({
  createPurchaseOrder: jest.fn(),
  updatePurchaseOrder: jest.fn(),
  placePurchaseOrder: jest.fn(),
  getVariantCosts: jest.fn(),
  listProductVariants: jest.fn(),
  listPurchasableProducts: jest.fn(),
  listPurchaseSuppliers: jest.fn(),
}));
jest.mock("@/services/warehousesService", () => ({ listWarehouses: jest.fn(), getInventoryRules: jest.fn() }));
jest.mock("@/hooks/useMyWarehouses");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __setMyWarehouses } = require("@/hooks/useMyWarehouses") as typeof import("@/hooks/__mocks__/useMyWarehouses");

const onSaved = jest.fn();

function rules(igvAffected: boolean) {
  jest.mocked(getInventoryRules).mockResolvedValue({ releaseAfterDays: null, pickingRequired: false, igvAffected, allowPurchaseToCourier: false });
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PurchaseOrderFormDialog companyId="c-1" canSeeCosts onClose={jest.fn()} onSaved={onSaved} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  __setMyWarehouses(null);
  rules(true);
  jest.mocked(listPurchaseSuppliers).mockResolvedValue([
    {
      id: "s-1",
      companyId: "c-1",
      name: "Textiles",
      businessName: "Textiles SAC",
      tradeName: "Textiles",
      ruc: "20100047218",
      contactPerson: null,
      phone: null,
      email: null,
      fiscalAddress: null,
      paymentTerms: "credito_30",
      active: true,
      purchaseCount: 0,
      createdAt: "",
      updatedAt: "",
    },
  ]);
  jest.mocked(listWarehouses).mockResolvedValue({
    warehouses: [
      { id: "w-1", name: "Almacén central", status: true, store_id: "st", company_id: "c-1", type: "PROPIO", is_main: true },
      { id: "w-2", name: "Shalom", status: true, store_id: "st", company_id: "c-1", type: "COURIER", is_main: false },
      { id: "w-3", name: "Cerrado", status: false, store_id: "st", company_id: "c-1", type: "PROPIO", is_main: false },
    ],
    links: [],
  });
  jest.mocked(listPurchasableProducts).mockResolvedValue([
    { id: "p-1", name: "Polo", sku: "POLO", companySku: null, status: true, purchaseUnit: "Caja", purchaseFactor: 12 },
    { id: "p-2", name: "Gorra", sku: "GOR", companySku: null, status: false, purchaseUnit: null, purchaseFactor: 1 },
  ]);
  jest.mocked(listProductVariants).mockResolvedValue([
    { id: "v-1", sku: "POLO-M", companySku: null, attributeValues: { Talla: "M" }, isActive: true, mergedInto: null },
    { id: "v-2", sku: "POLO-L", companySku: null, attributeValues: { Talla: "L" }, isActive: false, mergedInto: null },
    { id: "v-3", sku: "POLO-S", companySku: null, attributeValues: { Talla: "S" }, isActive: true, mergedInto: "v-1" },
  ]);
  jest.mocked(getVariantCosts).mockResolvedValue([{ variantId: "v-1", averageCost: 10 }]);
});

async function fillHeaderAndAddPolo(user: ReturnType<typeof userEvent.setup>) {
  setup();
  await screen.findByRole("option", { name: "Textiles" });
  await user.selectOptions(screen.getByLabelText("Proveedor"), "s-1");
  await user.selectOptions(screen.getByLabelText("Llega a"), "w-1");
  await screen.findByRole("option", { name: /Polo · POLO · Caja × 12/ });
  await user.selectOptions(screen.getByRole("combobox", { name: "Producto" }), "p-1");
  await user.click(screen.getByRole("button", { name: /Agregar producto con sus variantes/ }));
  await screen.findByText("Polo · Talla: M");
}

describe("formulario de la OC", () => {
  it("solo ofrece almacenes activos y no courier; muestra RUC y condición del proveedor", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole("option", { name: "Almacén central" });
    const warehouses = within(screen.getByLabelText("Llega a")).getAllByRole("option").map((option) => option.textContent);
    expect(warehouses).toEqual(["Elige el almacén", "Almacén central"]);
    await user.selectOptions(screen.getByLabelText("Proveedor"), "s-1");
    expect(screen.getByText("RUC 20100047218 · Crédito 30 días")).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Gorra/ })).not.toBeInTheDocument();
  });

  it("«Llega a» ofrece solo los almacenes que el usuario opera (FEAT-24 H6)", async () => {
    __setMyWarehouses({ all: false, inventoryIds: ["w-1"], operableIds: [] });
    setup();
    await waitFor(() =>
      expect(within(screen.getByLabelText("Llega a")).getAllByRole("option").map((option) => option.textContent)).toEqual(["Elige el almacén"]),
    );
    expect(listWarehouses).toHaveBeenCalled();
  });

  it("agrega las variantes activas con la unidad del producto y el precio sugerido del costo promedio", async () => {
    const user = userEvent.setup();
    await fillHeaderAndAddPolo(user);
    expect(screen.queryByText("Polo · Talla: L")).not.toBeInTheDocument();
    expect(screen.queryByText("Polo · Talla: S")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Unidad de compra: Polo · Talla: M")).toHaveValue("Caja");
    expect(screen.getByLabelText("Factor: Polo · Talla: M")).toHaveValue("12");
    expect(screen.getByLabelText("Precio: Polo · Talla: M")).toHaveValue("120");
    expect(screen.getByTestId("units-v-1")).toHaveTextContent("12");
  });

  it("precios sin IGV: suma el 18 %; los gastos no suman al total y van al costo final", async () => {
    const user = userEvent.setup();
    await fillHeaderAndAddPolo(user);
    const quantity = screen.getByLabelText("Cantidad: Polo · Talla: M");
    await user.clear(quantity);
    await user.type(quantity, "2");
    await user.clear(screen.getByLabelText(/Gastos de la compra/));
    await user.type(screen.getByLabelText(/Gastos de la compra/), "24");
    expect(screen.getByTestId("oc-subtotal")).toHaveTextContent(/240\.00/);
    expect(screen.getByTestId("oc-igv")).toHaveTextContent(/43\.20/);
    expect(screen.getByTestId("oc-total")).toHaveTextContent(/283\.20/);
    expect(screen.getByTestId("entry-cost-v-1")).toHaveTextContent(/11\.00/);
  });

  it("precios con IGV incluido: el total es lo tipeado y el subtotal sin IGV", async () => {
    const user = userEvent.setup();
    await fillHeaderAndAddPolo(user);
    const price = screen.getByLabelText("Precio: Polo · Talla: M");
    await user.clear(price);
    await user.type(price, "118");
    await user.click(screen.getByRole("switch", { name: "Incluyen IGV" }));
    expect(screen.getByTestId("oc-subtotal")).toHaveTextContent(/100\.00/);
    expect(screen.getByTestId("oc-igv")).toHaveTextContent(/18\.00/);
    expect(screen.getByTestId("oc-total")).toHaveTextContent(/118\.00/);
  });

  it("empresa no afecta al IGV: el interruptor queda apagado y no hay IGV", async () => {
    rules(false);
    const user = userEvent.setup();
    await fillHeaderAndAddPolo(user);
    await waitFor(() => expect(screen.getByRole("switch", { name: "Incluyen IGV" })).toBeDisabled());
    expect(screen.getByText(/no está afecta al IGV/)).toBeInTheDocument();
    expect(screen.getByText("IGV (no afecta)")).toBeInTheDocument();
    expect(screen.getByTestId("oc-subtotal")).toHaveTextContent(/120\.00/);
    expect(screen.getByTestId("oc-igv")).toHaveTextContent(/0\.00/);
    expect(screen.getByTestId("oc-total")).toHaveTextContent(/120\.00/);
  });

  it("no guarda sin proveedor y avisa qué falta", async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole("option", { name: "Textiles" });
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Elige el proveedor.");
    expect(createPurchaseOrder).not.toHaveBeenCalled();
  });

  it("emitir guarda sin montos y emite; si la emisión falla, el reintento edita la misma OC", async () => {
    const user = userEvent.setup();
    const draft = { id: "oc-9", number: "OC-0009", status: "BORRADOR" } as PurchaseOrder;
    jest.mocked(createPurchaseOrder).mockResolvedValue(draft);
    jest.mocked(updatePurchaseOrder).mockResolvedValue(draft);
    jest.mocked(placePurchaseOrder)
      .mockRejectedValueOnce({ response: { status: 503, data: { message: "Servicio no disponible" } } })
      .mockResolvedValueOnce({ ...draft, status: "PEDIDA" });
    await fillHeaderAndAddPolo(user);
    await user.click(screen.getByRole("button", { name: "Emitir orden" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("OC-0009 quedó guardada como borrador, pero no se pudo emitir: Servicio no disponible");
    const body = jest.mocked(createPurchaseOrder).mock.calls[0][0];
    expect(body).toMatchObject({
      supplierId: "s-1",
      inventoryId: "w-1",
      pricesIncludeIgv: false,
      lines: [{ variantId: "v-1", purchaseQuantity: 1, purchaseFactor: 12, purchaseUnit: "Caja", unitPrice: 120 }],
    });
    expect(body).not.toHaveProperty("total");
    expect(body).not.toHaveProperty("companyId");

    await user.click(screen.getByRole("button", { name: "Emitir orden" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ status: "PEDIDA" })));
    expect(createPurchaseOrder).toHaveBeenCalledTimes(1);
    expect(updatePurchaseOrder).toHaveBeenCalledWith("oc-9", expect.objectContaining({ supplierId: "s-1" }));
  });
});
