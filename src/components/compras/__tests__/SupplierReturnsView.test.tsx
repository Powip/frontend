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
});
