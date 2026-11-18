/**
 * Tests: Compras › Órdenes de compra (FEAT-24 H3-E).
 *
 * 1. Botones por rol: Administrador (todo), Operaciones (sin pago, anular ni Excel de costos), Ventas (solo ver).
 * 2. Sin la clave del monto (rol sin costos) se ve «••••».
 * 3. Anular pide motivo; si el servidor lo rechaza, el diálogo queda abierto con su mensaje (H0).
 * 4. El detalle de una compra con IMEI/serie muestra los códigos (H0).
 * 5. Un 403 que llegue igual se muestra con el mensaje del servidor.
 * 6. Cada recepción imprime las etiquetas de lo recibido (FEAT-24 H7, origen purchase_order).
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getTrackedPurchase } from "@/services/inventoryTrackingService";
import {
  cancelPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  listPurchaseSuppliers,
  placePurchaseOrder,
  type PurchaseOrder,
} from "@/services/purchasesService";
import { listWarehouses } from "@/services/warehousesService";
import PurchaseOrdersView from "../PurchaseOrdersView";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => "/compras" }));
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/services/purchasesService", () => ({
  listPurchaseOrders: jest.fn(),
  listPurchaseSuppliers: jest.fn(),
  getPurchaseOrder: jest.fn(),
  placePurchaseOrder: jest.fn(),
  cancelPurchaseOrder: jest.fn(),
}));
jest.mock("@/services/warehousesService", () => ({ listWarehouses: jest.fn() }));
jest.mock("@/services/inventoryTrackingService", () => ({
  ...jest.requireActual("@/services/inventoryTrackingService"),
  getTrackedPurchase: jest.fn(),
}));
jest.mock("@/components/labels/PrintLabelsDialog", () => ({
  PrintLabelsDialog: ({ source }: { source: { kind: string; purchaseOrderId?: string; receiptId?: string; title?: string } }) => (
    <div>
      etiquetas {source.kind} {source.purchaseOrderId} {source.receiptId} · {source.title}
    </div>
  ),
}));

function order(overrides: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    id: "oc-1",
    companyId: "c-1",
    number: "OC-0001",
    origin: "order",
    status: "PEDIDA",
    supplierId: "s-1",
    supplierName: "Textiles SAC",
    inventoryId: "w-1",
    storeId: null,
    pricesIncludeIgv: false,
    expenses: 0,
    subtotal: 100,
    igvAmount: 18,
    total: 118,
    document: "F001-1",
    notes: null,
    purchaseDate: "2026-11-17",
    receiptType: "FACTURA",
    paymentMethod: null,
    paymentStatus: "pendiente",
    paidAt: null,
    dueDate: null,
    orderedAt: null,
    receivedAt: null,
    hasTrackedUnits: false,
    cancelReason: null,
    cancelledBy: null,
    cancelledAt: null,
    userEmail: null,
    userName: null,
    createdAt: "2026-11-17T15:00:00Z",
    updatedAt: "2026-11-17T15:00:00Z",
    lines: [
      {
        id: "item-1",
        variantId: "v-1",
        sku: "POLO-M",
        productName: "Polo",
        attributes: { Talla: "M" },
        supplierId: "s-1",
        supplierName: "Textiles SAC",
        purchaseUnit: null,
        purchaseFactor: 1,
        purchaseQuantity: 10,
        quantity: 10,
        receivedQuantity: 0,
        returnedQuantity: 0,
        pendingQuantity: 10,
        unitPrice: 10,
        unitCostNet: 10,
        entryCost: 10,
      },
    ],
    ...overrides,
  };
}

function loginAs(role: string) {
  jest.mocked(useAuth).mockReturnValue({
    auth: { accessToken: "t", user: { id: "u-1", email: "ana@powip.test", role, permissions: [] }, company: { id: "c-1", stores: [] } },
  } as unknown as ReturnType<typeof useAuth>);
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PurchaseOrdersView />
    </QueryClientProvider>,
  );
}

function listing(items: PurchaseOrder[]) {
  jest.mocked(listPurchaseOrders).mockResolvedValue({ items, total: items.length, page: 1, limit: 20 });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(listPurchaseSuppliers).mockResolvedValue([]);
  jest.mocked(listWarehouses).mockResolvedValue({
    warehouses: [{ id: "w-1", name: "Almacén central", status: true, store_id: "st-1", company_id: "c-1", type: "PROPIO", is_main: true }],
    links: [],
  });
  jest.mocked(getPurchaseOrder).mockImplementation(async (id) => ({ ...order({ id }), receptions: [], supplierReturns: [] }));
});

describe("botones por rol (H3-D6)", () => {
  const rows = [order(), order({ id: "oc-2", number: "OC-0002", status: "BORRADOR" })];

  it("Administrador: nueva compra, Excel de costos, editar, recibir y anular", async () => {
    loginAs("ADMIN");
    listing(rows);
    setup();
    const pedida = (await screen.findByText("OC-0001")).closest("tr")!;
    expect(screen.getByRole("button", { name: /Nueva compra/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cargar costos por Excel/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Compra directa \(IMEI\/serie\)/ })).toHaveAttribute("href", "/registrar-compra");
    expect(within(pedida).getByRole("button", { name: "Recibir" })).toBeInTheDocument();
    expect(within(pedida).getByRole("button", { name: "Anular" })).toBeInTheDocument();
    expect(within(pedida).queryByTitle("Editar")).not.toBeInTheDocument();
    const borrador = screen.getByText("OC-0002").closest("tr")!;
    expect(within(borrador).getByTitle("Editar")).toBeInTheDocument();
    expect(within(borrador).queryByRole("button", { name: "Recibir" })).not.toBeInTheDocument();
    expect(within(pedida).getByTestId("total-oc-1")).toHaveTextContent(/118\.00/);
  });

  it("Operaciones: crea y recibe, pero no anula, no paga ni carga costos", async () => {
    loginAs("OPERACIONES");
    listing(rows);
    setup();
    const pedida = (await screen.findByText("OC-0001")).closest("tr")!;
    expect(screen.getByRole("button", { name: /Nueva compra/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Cargar costos por Excel/ })).not.toBeInTheDocument();
    expect(within(pedida).getByRole("button", { name: "Recibir" })).toBeInTheDocument();
    expect(within(pedida).queryByRole("button", { name: "Anular" })).not.toBeInTheDocument();
    fireEvent.click(within(pedida).getByTitle("Ver detalles"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Recibir" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Registrar pago" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Anular" })).not.toBeInTheDocument();
  });

  it("Ventas solo ve: sin botones de escritura y el total como «••••» si la API no lo manda", async () => {
    loginAs("VENTAS");
    const masked: Partial<PurchaseOrder> = { ...order() };
    delete masked.total;
    delete masked.subtotal;
    delete masked.igvAmount;
    listing([masked as PurchaseOrder]);
    setup();
    const row = (await screen.findByText("OC-0001")).closest("tr")!;
    expect(screen.queryByRole("button", { name: /Nueva compra/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Compra directa/ })).not.toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Recibir" })).not.toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Anular" })).not.toBeInTheDocument();
    expect(within(row).getByTestId("total-oc-1")).toHaveTextContent("••••");
  });
});

describe("anular (H0 + H3)", () => {
  it("pide motivo y, si el servidor lo rechaza, deja el diálogo abierto con su mensaje", async () => {
    loginAs("ADMINISTRADOR");
    listing([order({ status: "RECIBIDA" })]);
    jest.mocked(cancelPurchaseOrder).mockRejectedValue({ response: { status: 409, data: { message: "Falta stock de POLO-M para anular." } } });
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Anular" }));
    expect(screen.getByRole("button", { name: "Anular compra" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Motivo de la anulación"), { target: { value: "Error de carga" } });
    fireEvent.click(screen.getByRole("button", { name: "Anular compra" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Falta stock de POLO-M para anular.");
    expect(cancelPurchaseOrder).toHaveBeenCalledWith("oc-1", "Error de carga");
  });

  it("anulada con éxito avisa y refresca", async () => {
    loginAs("ADMIN");
    listing([order({ status: "BORRADOR" })]);
    jest.mocked(cancelPurchaseOrder).mockResolvedValue(order({ status: "ANULADA" }));
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Anular" }));
    expect(screen.getByText(/Todavía no se recibió nada/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Motivo de la anulación"), { target: { value: "El proveedor no tiene stock" } });
    fireEvent.click(screen.getByRole("button", { name: "Anular compra" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Compra anulada", expect.anything()));
    await waitFor(() => expect(listPurchaseOrders).toHaveBeenCalledTimes(2));
  });
});

describe("detalle", () => {
  it("una compra con IMEI/serie muestra los códigos de unidad", async () => {
    loginAs("ADMIN");
    const tracked = order({ id: "p", number: "COM-1", origin: "direct", status: "RECIBIDA", hasTrackedUnits: true });
    listing([tracked]);
    jest.mocked(getTrackedPurchase).mockResolvedValue({
      items: [{ id: "item-1", sku: "POLO-M", trackingMode: "IMEI", codes: ["001234567890123"] }],
    });
    setup();
    fireEvent.click(await screen.findByTitle("Ver detalles"));
    expect(await screen.findByText("001234567890123")).toBeInTheDocument();
    expect(getTrackedPurchase).toHaveBeenCalledWith("p", expect.anything());
  });

  it("cada recepción imprime las etiquetas de lo que entró (FEAT-24 H7)", async () => {
    loginAs("OPERACIONES");
    const received = order({ status: "RECIBIDA_PARCIAL" });
    listing([received]);
    const reception = (id: string, number: string, quantity: number) => ({
      id,
      number,
      inventoryId: "w-1",
      operationId: null,
      notes: null,
      userEmail: null,
      userName: "Ana",
      createdAt: "2026-11-17T16:00:00Z",
      lines: [{ id: `${id}-l`, itemId: "item-1", variantId: "v-1", quantity, movementId: null }],
    });
    jest.mocked(getPurchaseOrder).mockResolvedValue({
      ...received,
      receptions: [reception("rec-1", "REC-0001", 4), reception("rec-2", "REC-0002", 2)],
      supplierReturns: [],
    });
    setup();
    fireEvent.click(await screen.findByTitle("Ver detalles"));
    fireEvent.click(await screen.findByRole("button", { name: "Imprimir etiquetas de REC-0002" }));
    expect(screen.getByText("etiquetas purchase_order oc-1 rec-2 · OC-0001 · REC-0002")).toBeInTheDocument();
  });

  it("una compra anulada no ofrece imprimir etiquetas de sus recepciones", async () => {
    loginAs("ADMIN");
    const cancelled = order({ status: "ANULADA" });
    listing([cancelled]);
    jest.mocked(getPurchaseOrder).mockResolvedValue({
      ...cancelled,
      receptions: [
        { id: "rec-1", number: "REC-0001", inventoryId: "w-1", operationId: null, notes: null, userEmail: null, userName: null, createdAt: "2026-11-17T16:00:00Z", lines: [] },
      ],
      supplierReturns: [],
    });
    setup();
    fireEvent.click(await screen.findByTitle("Ver detalles"));
    expect(await screen.findByText("REC-0001")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Imprimir etiquetas/ })).not.toBeInTheDocument();
  });

  it("anulada muestra el motivo, quién y cuándo, o «Sin motivo registrado»", async () => {
    loginAs("ADMIN");
    const cancelled = order({ status: "ANULADA", cancelReason: "Error de carga", cancelledBy: "ana@x.pe", cancelledAt: "2026-10-21T17:47:00Z" });
    listing([cancelled]);
    jest.mocked(getPurchaseOrder).mockResolvedValue({ ...cancelled, receptions: [], supplierReturns: [] });
    setup();
    fireEvent.click(await screen.findByTitle("Ver detalles"));
    expect(await screen.findByText("Error de carga")).toBeInTheDocument();
    expect(screen.getByText(/ana@x\.pe/)).toBeInTheDocument();
  });

  it("un 403 que llega igual se muestra con el mensaje del servidor", async () => {
    loginAs("OPERACIONES");
    const user = userEvent.setup();
    listing([order({ status: "BORRADOR" })]);
    jest.mocked(getPurchaseOrder).mockResolvedValue({ ...order({ status: "BORRADOR" }), receptions: [], supplierReturns: [] });
    jest.mocked(placePurchaseOrder).mockRejectedValue({ response: { status: 403, data: { message: "Solo Administrador u Operaciones." } } });
    setup();
    await user.click(await screen.findByTitle("Ver detalles"));
    await user.click(await screen.findByRole("button", { name: "Emitir orden" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Solo Administrador u Operaciones."));
  });
});
