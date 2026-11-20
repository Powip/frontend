/**
 * Tests: lote opcional por línea en traslados y ajustes (FEAT-24 H5-L).
 *
 * 1. Traslado: solo las variantes con lotes muestran el selector; ofrece «Automático» y los lotes con saldo en el
 *    origen (también el vencido); el elegido viaja como `lotId`; cambiar el origen lo borra.
 * 2. Ajuste: la merma del lote vencido manda su `lotId`; en un ajuste positivo se ofrecen todos los lotes de la variante.
 * 3. El detalle del traslado muestra en qué lotes salió.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { listLots, type LotList } from "@/services/lotsService";
import { fetchVariantsByIds } from "@/services/variantCodesService";
import { createAdjustment, updateTransfer } from "@/services/warehouseOpsService";
import { listProductVariants, listPurchasableProducts } from "@/services/purchasesService";
import { listWarehouses } from "@/services/warehousesService";
import TransferFormDialog from "@/components/warehouse-ops/transfers/TransferFormDialog";
import TransferDetailDialog from "@/components/warehouse-ops/transfers/TransferDetailDialog";
import AdjustmentFormDialog from "@/components/warehouse-ops/adjustments/AdjustmentFormDialog";
import { adjustment, transfer, transferLine, WAREHOUSES } from "@/components/warehouse-ops/__tests__/fixtures";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t", company: { id: "c-1" }, user: { id: "u-1", role: "OPERACIONES", permissions: [] } } }),
}));
jest.mock("@/hooks/useMyWarehouses");
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/services/lotsService", () => ({ LOTS_QUERY_KEY: "lots", listLots: jest.fn() }));
jest.mock("@/services/variantCodesService", () => ({ fetchVariantsByIds: jest.fn(), lookupVariantsByCodes: jest.fn() }));
jest.mock("@/services/warehouseOpsService", () => ({
  createTransfer: jest.fn(),
  updateTransfer: jest.fn(),
  dispatchTransfer: jest.fn(),
  createAdjustment: jest.fn(),
}));
jest.mock("@/services/warehousesService", () => ({ listWarehouses: jest.fn() }));
jest.mock("@/services/purchasesService", () => ({ listPurchasableProducts: jest.fn(), listProductVariants: jest.fn(), getVariantCosts: jest.fn().mockResolvedValue([]) }));
jest.mock("@/services/inventoryItems.service", () => ({
  getStockByVariants: jest.fn().mockResolvedValue([
    { variant_id: "v-1", inventories: [{ inventory_id: "w-1", quantity: 33, reserved_quantity: 0 }, { inventory_id: "w-2", quantity: 5, reserved_quantity: 0 }] },
    { variant_id: "v-2", inventories: [{ inventory_id: "w-1", quantity: 9, reserved_quantity: 0 }, { inventory_id: "w-2", quantity: 5, reserved_quantity: 0 }] },
  ]),
}));
jest.mock("@/components/gre/GreIssueDialog", () => ({ __esModule: true, default: () => null }));

const row = (lotId: string, number: string, expiresAt: string, status: "vigente" | "vencido" | "bloqueado", inventoryId: string | null, quantity: number) => ({
  lotId,
  number,
  kind: "normal",
  variantId: "v-1",
  expiresAt,
  daysToExpiry: 0,
  status,
  storedStatus: status === "bloqueado" ? "bloqueado" : "vigente",
  comment: null,
  inventoryId,
  inventoryName: null,
  quantity,
});

const IN_CENTRAL: LotList = {
  today: "2026-11-18",
  items: [
    row("l-2", "L2408", "2027-08-30", "vigente", "w-1", 30),
    row("l-1", "A117", "2026-10-31", "vencido", "w-1", 3),
    row("l-0", "Z000", "2027-01-31", "vigente", "w-1", 0),
  ],
  unlotted: [],
  truncated: false,
};

function renderWith(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(listWarehouses).mockResolvedValue({ warehouses: WAREHOUSES, links: [] });
  // Solo el polo (v-1) maneja lotes.
  jest.mocked(fetchVariantsByIds).mockResolvedValue([
    { id: "v-1", sku: "POLO", companySku: null, barcode: null, powipEan: null, attributeValues: {}, productName: "Polo", tracksLots: true },
    { id: "v-2", sku: "GORRA", companySku: null, barcode: null, powipEan: null, attributeValues: {}, productName: "Gorra" },
  ]);
  jest.mocked(listLots).mockResolvedValue(IN_CENTRAL);
});

describe("lote en traslados (FEAT-24 H5-L)", () => {
  it("elige el lote de una línea con lotes, lo manda como lotId y lo borra al cambiar el origen", async () => {
    const user = userEvent.setup();
    jest.mocked(updateTransfer).mockResolvedValue(transfer());
    renderWith(<TransferFormDialog companyId="c-1" transfer={transfer()} onClose={jest.fn()} onSaved={jest.fn()} />);
    const select = await screen.findByLabelText(/^Lote: Polo/);
    expect(screen.queryByLabelText(/^Lote: Gorra/)).not.toBeInTheDocument();
    await waitFor(() => expect(within(select).getAllByRole("option")).toHaveLength(3));
    expect(listLots).toHaveBeenCalledWith({ variantId: "v-1", inventoryId: "w-1" }, expect.anything());
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Automático (sale primero el que vence antes)",
      "A117 · Vencido · 31/10/2026 · 3 und",
      "L2408 · vence 30/08/2027 · 30 und",
    ]);
    await user.selectOptions(select, "l-2");
    await user.click(screen.getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(updateTransfer).toHaveBeenCalledTimes(1));
    expect(jest.mocked(updateTransfer).mock.calls[0][1].lines).toEqual([
      { variantId: "v-1", quantity: 2, lotId: "l-2" },
      { variantId: "v-2", quantity: 1 },
    ]);
    await user.selectOptions(screen.getByLabelText("Origen"), "w-2");
    await waitFor(() => expect(screen.getByLabelText(/^Lote: Polo/)).toHaveValue(""));
  });

  it("el detalle muestra en qué lotes salió cada línea", () => {
    renderWith(
      <TransferDetailDialog
        transfer={transfer({
          status: "en_camino",
          lines: [
            transferLine("i-1", "v-1", "Polo", 4, { lots: [{ lotId: "l-2", lotNumber: "L2408", quantity: -3 }, { lotId: null, lotNumber: null, quantity: -1 }] }),
            transferLine("i-2", "v-2", "Gorra", 1, { lotId: "l-9", lotNumber: "G1", lotExpiresAt: "2027-01-31" }),
          ],
        })}
        originName="Central"
        destinationName="Tienda Sur"
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText("Lotes: L2408 ×3 · Sin lote ×1")).toBeInTheDocument();
    expect(screen.getByText("Lote G1 · vence 31/01/2027")).toBeInTheDocument();
  });
});

describe("lote en ajustes (FEAT-24 H5-L)", () => {
  beforeEach(() => {
    jest.mocked(listPurchasableProducts).mockResolvedValue([{ id: "p-1", name: "Polo", sku: "POLO", companySku: null, status: true, purchaseUnit: null, purchaseFactor: 1 }]);
    jest.mocked(listProductVariants).mockResolvedValue([{ id: "v-1", sku: "POLO", companySku: null, attributeValues: {}, isActive: true, mergedInto: null }]);
  });

  async function addPolo(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement) {
    await within(dialog).findByRole("option", { name: /Polo/ });
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Producto" }), "p-1");
    await user.click(within(dialog).getByRole("button", { name: /Agregar/ }));
  }

  it("la merma del lote vencido manda su lotId", async () => {
    const user = userEvent.setup();
    jest.mocked(createAdjustment).mockResolvedValue({ duplicate: false, adjustment: adjustment({ number: "AJ-0009", status: "aplicado" }) });
    renderWith(<AdjustmentFormDialog companyId="c-1" canSeeCosts={false} onClose={jest.fn()} onSaved={jest.fn()} />);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(within(dialog).getByLabelText("Almacén")).getAllByRole("option").length).toBeGreaterThan(1));
    await user.selectOptions(within(dialog).getByLabelText("Almacén"), "w-1");
    await user.selectOptions(within(dialog).getByLabelText("Motivo"), "vencimiento");
    await addPolo(user, dialog);
    const select = await within(dialog).findByLabelText(/^Lote: Polo/);
    await waitFor(() => expect(within(select).getByRole("option", { name: /A117/ })).toBeInTheDocument());
    await user.selectOptions(select, "l-1");
    await user.click(within(dialog).getByRole("button", { name: "Registrar" }));
    await waitFor(() => expect(createAdjustment).toHaveBeenCalledTimes(1));
    expect(jest.mocked(createAdjustment).mock.calls[0][0].lines).toEqual([{ variantId: "v-1", quantity: 1, direction: "OUT", lotId: "l-1" }]);
  });

  it("en un ajuste positivo ofrece todos los lotes de la variante («Sin lote» por defecto)", async () => {
    const user = userEvent.setup();
    jest.mocked(listLots).mockImplementation(async (filters) =>
      filters.includeEmpty ? { ...IN_CENTRAL, items: [...IN_CENTRAL.items, row("l-5", "B500", "2027-05-01", "vigente", null, 0)] } : IN_CENTRAL,
    );
    renderWith(<AdjustmentFormDialog companyId="c-1" canSeeCosts={false} onClose={jest.fn()} onSaved={jest.fn()} />);
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(within(dialog).getByLabelText("Almacén")).getAllByRole("option").length).toBeGreaterThan(1));
    await user.selectOptions(within(dialog).getByLabelText("Almacén"), "w-1");
    await user.selectOptions(within(dialog).getByLabelText("Tipo"), "positivo");
    await addPolo(user, dialog);
    const select = await within(dialog).findByLabelText(/^Lote: Polo/);
    await waitFor(() => expect(within(select).getByRole("option", { name: /B500/ })).toBeInTheDocument());
    expect(listLots).toHaveBeenCalledWith({ variantId: "v-1", inventoryId: "w-1", includeEmpty: true }, expect.anything());
    expect(within(select).getAllByRole("option")[0]).toHaveTextContent("Sin lote");
    expect(within(select).getByRole("option", { name: /Z000/ })).toBeInTheDocument();
  });
});
