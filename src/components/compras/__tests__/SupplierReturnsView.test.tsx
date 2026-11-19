/**
 * Tests: Compras › Devoluciones a proveedor (FEAT-24 H3-E).
 *
 * 1. Botones por estado y rol: Operaciones envía y registra la NC; solo el Administrador anula.
 * 2. Registrar la nota de crédito manda su número.
 * 3. Nueva devolución: se elige una compra recibida y se devuelve hasta lo recibido sin devolver.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  cancelSupplierReturn,
  createSupplierReturn,
  listPurchaseOrders,
  listSupplierReturns,
  registerCreditNote,
  type PurchaseOrder,
  type SupplierReturn,
} from "@/services/purchasesService";
import SupplierReturnsView from "../SupplierReturnsView";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => "/compras/devoluciones" }));
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/services/purchasesService", () => ({
  listSupplierReturns: jest.fn(),
  listPurchaseOrders: jest.fn(),
  createSupplierReturn: jest.fn(),
  sendSupplierReturn: jest.fn(),
  registerCreditNote: jest.fn(),
  cancelSupplierReturn: jest.fn(),
}));
const pdfDownload = jest.fn().mockResolvedValue(undefined);
jest.mock("@/hooks/usePdfDownload", () => ({ usePdfDownload: () => pdfDownload }));
jest.mock("@/hooks/useCompanyWarehouses", () => ({ useCompanyWarehouses: () => ({ warehouses: [], nameOf: () => "Almacén central" }) }));

const base = {
  companyId: "c-1",
  purchaseOrderId: "oc-1",
  purchaseOrderNumber: "OC-0001",
  supplierId: "s-1",
  supplierName: "Textiles",
  inventoryId: "w-1",
  reason: "Costuras abiertas",
  creditNoteNumber: null,
  total: 23.6,
  userEmail: null,
  userName: null,
  sentAt: null,
  creditNoteAt: null,
  cancelledAt: null,
  cancelReason: null,
  createdAt: "2026-11-17T15:00:00Z",
  updatedAt: "2026-11-17T15:00:00Z",
  lines: [{ id: "l-1", itemId: "item-1", variantId: "v-1", sku: "POLO-M", productName: "Polo", quantity: 2, movementId: null, cancelMovementId: null }],
};
const draft: SupplierReturn = { ...base, id: "d-1", number: "DEV-0001", status: "borrador" };
const sent: SupplierReturn = { ...base, id: "d-2", number: "DEV-0002", status: "enviada" };

function loginAs(role: string) {
  jest.mocked(useAuth).mockReturnValue({
    auth: { accessToken: "t", user: { id: "u-1", role, permissions: [] }, company: { id: "c-1", stores: [] } },
  } as unknown as ReturnType<typeof useAuth>);
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SupplierReturnsView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(listSupplierReturns).mockResolvedValue([draft, sent]);
});

describe("Devoluciones a proveedor", () => {
  it("Operaciones envía y registra la NC, pero no anula", async () => {
    loginAs("OPERACIONES");
    setup();
    const draftRow = (await screen.findByText("DEV-0001")).closest("tr")!;
    const sentRow = screen.getByText("DEV-0002").closest("tr")!;
    expect(within(draftRow).getByRole("button", { name: "Marcar enviada" })).toBeInTheDocument();
    expect(within(sentRow).getByRole("button", { name: "Registrar nota de crédito" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anular" })).not.toBeInTheDocument();
  });

  it("Ventas solo ve", async () => {
    loginAs("VENTAS");
    setup();
    await screen.findByText("DEV-0001");
    expect(screen.queryByRole("button", { name: /Nueva devolución/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar enviada" })).not.toBeInTheDocument();
  });

  it("registrar la nota de crédito manda su número", async () => {
    loginAs("ADMIN");
    jest.mocked(registerCreditNote).mockResolvedValue({ ...sent, status: "nc_recibida", creditNoteNumber: "FC01-123" });
    setup();
    const sentRow = (await screen.findByText("DEV-0002")).closest("tr")!;
    expect(within(sentRow).getByRole("button", { name: "Anular" })).toBeInTheDocument();
    fireEvent.click(within(sentRow).getByRole("button", { name: "Registrar nota de crédito" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Registrar" })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Nota de crédito"), { target: { value: " FC01-123 " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Registrar" }));
    await waitFor(() => expect(registerCreditNote).toHaveBeenCalledWith("d-2", "FC01-123"));
  });

  it("nueva devolución desde una compra recibida, hasta lo recibido sin devolver", async () => {
    loginAs("OPERACIONES");
    const received = {
      id: "oc-1",
      number: "OC-0001",
      status: "RECIBIDA",
      supplierName: "Textiles",
      purchaseDate: "2026-11-10",
      createdAt: "2026-11-10T15:00:00Z",
      hasTrackedUnits: false,
      lines: [{ id: "item-1", variantId: "v-1", sku: "POLO-M", productName: "Polo", attributes: null, receivedQuantity: 10, returnedQuantity: 7 }],
    } as unknown as PurchaseOrder;
    jest.mocked(listPurchaseOrders).mockImplementation(async (filters) => ({
      items: filters?.status === "RECIBIDA" ? [received] : [],
      total: 1,
      page: 1,
      limit: 100,
    }));
    jest.mocked(createSupplierReturn).mockResolvedValue({ ...draft, id: "d-3", number: "DEV-0003" });
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Nueva devolución/ }));
    await screen.findByRole("option", { name: /OC-0001 · Textiles/ });
    fireEvent.change(screen.getByLabelText("Compra"), { target: { value: "oc-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    const quantity = await screen.findByLabelText("Devolver: Polo");
    fireEvent.change(quantity, { target: { value: "4" } });
    expect(screen.getByText("Puedes devolver hasta 3.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear devolución" })).toBeDisabled();
    fireEvent.change(quantity, { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Costuras abiertas" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear devolución" }));
    await waitFor(() =>
      expect(createSupplierReturn).toHaveBeenCalledWith({
        purchaseOrderId: "oc-1",
        reason: "Costuras abiertas",
        lines: [{ itemId: "item-1", quantity: 3 }],
      }),
    );
  });

  it("cada devolución descarga su PDF con el encabezado común (FEAT-24 H10)", async () => {
    loginAs("VENTAS");
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "PDF de la devolución DEV-0002" }));
    await waitFor(() =>
      expect(pdfDownload).toHaveBeenCalledWith(expect.objectContaining({ title: "Devolución a proveedor", number: "DEV-0002", signatures: ["Entrega", "Recibe (proveedor)"] })),
    );
    const spec = pdfDownload.mock.calls[0][0];
    expect(spec.meta).toEqual(expect.arrayContaining([["Sale de", "Almacén central"], ["Compra", "OC-0001"]]));
    // Ventas no ve costos: la API no los manda y el PDF imprime «••••».
    expect(spec.tables[0].rows[0]).toEqual(["POLO-M", "Polo", "2", "••••", "••••"]);
  });

  it("anular una devolución de un mes cerrado muestra el 423 claro (FEAT-24 H10)", async () => {
    loginAs("ADMIN");
    jest.mocked(cancelSupplierReturn).mockRejectedValue({ response: { status: 423, data: { code: "PERIODO_CERRADO", period: "2026-10", message: "El periodo 2026-10 está cerrado." } } });
    setup();
    const sentRow = (await screen.findByText("DEV-0002")).closest("tr")!;
    fireEvent.click(within(sentRow).getByRole("button", { name: "Anular" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Motivo (opcional)"), { target: { value: "Se envió por error" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Anular devolución" }));
    expect(await within(dialog).findByText(/Octubre 2026 está cerrado\./)).toBeInTheDocument();
  });
});
