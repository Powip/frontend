import type { ReactNode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import axios from "@/lib/axiosAuth";
import { toast } from "sonner";
import type { CreateGuideData } from "@/components/modals/CreateGuideModal";
import type { OrderHeader } from "@/interfaces/IOrder";
import type { PedidosActions, Sale } from "../types";

const mockRefetch = jest.fn();
const mockInvalidateBusinessData = jest.fn();
let mockOrders: OrderHeader[] = [];
let mockAuth: { company: { id: string }; user: { id: string } } | null = null;
let mockActions: PedidosActions;
let mockModalProps: {
  open: boolean;
  selectedOrders: { id: string }[];
  onConfirm: (guides: CreateGuideData[]) => Promise<boolean | void>;
};

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
jest.mock("@/hooks/useBusinessOrders", () => ({
  useBusinessOrders: () => ({ orders: mockOrders, loading: false, error: false, refetch: mockRefetch }),
}));
jest.mock("@/hooks/useInvalidateBusinessData", () => ({ useInvalidateBusinessData: () => mockInvalidateBusinessData }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("@/contexts/OperationsRoleContext", () => ({
  useOperationsRole: () => ({ can: () => true }),
  OPS_PERMISSIONS: { DISPATCH: "DISPATCH" },
}));
jest.mock("@/hooks/useUserAuditInfo", () => ({ useUserAuditInfo: () => () => ({ userId: "operator" }) }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), useSearchParams: () => new URLSearchParams() }));
jest.mock("../guideReviewReturn", () => ({ useGuideReviewReturn: () => ({ pending: null, clear: jest.fn() }) }));
jest.mock("../PorDespacharTab", () => ({
  PorDespacharTab: ({ sales, actions }: { sales: Sale[]; actions: PedidosActions }) => {
    mockActions = actions;
    return <button onClick={() => actions.onOpenCreateGuide(sales)}>Armar guías</button>;
  },
}));
jest.mock("../EnCaminoTab", () => ({ EnCaminoTab: () => null }));
jest.mock("../AtencionTab", () => ({ AtencionTab: () => null }));
jest.mock("../HistorialTab", () => ({ HistorialTab: () => null }));
jest.mock("../AnuladosTab", () => ({ AnuladosTab: () => null }));
jest.mock("@/components/orders/OrderDetailModal", () => ({ OrderDetailModalProvider: ({ children }: { children: ReactNode }) => children }));
jest.mock("@/app/operaciones/_shared/GlobalScanner", () => ({ GlobalScanner: () => null }));
jest.mock("@/utils/exportSalesExcel", () => ({ exportSalesToExcel: jest.fn() }));
jest.mock("@/utils/bulk-receipt-printer", () => ({ openPrintWindow: jest.fn(), printReceipts: jest.fn() }));
jest.mock("@/components/modals/CreateGuideModal", () => ({
  __esModule: true,
  default: (props: typeof mockModalProps) => {
    mockModalProps = props;
    return props.open ? <div data-testid="guide-selection">{props.selectedOrders.map((order) => order.id).join(",")}</div> : null;
  },
}));
jest.mock("@/components/modals/GuideDetailsModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/AddToExistingGuideModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/PaymentVerificationModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/CancellationModal", () => ({ __esModule: true, default: ({ open, onConfirm }: { open: boolean; onConfirm: (reason: string, notes: string) => void }) => open ? <button onClick={() => onConfirm("OTHER", "Cliente canceló")}>Confirmar anulación normal</button> : null }));
jest.mock("@/components/modals/CourierAssignmentModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/ReassignSellerModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/ventas/RescheduleDialog", () => ({ RescheduleDialog: () => null }));

jest.mock("@/components/registrar-venta/SaleUnitLifecycleModal", () => ({
  __esModule: true,
  default: ({ action, orderId }: { action: string; orderId: string }) => <div data-testid="lifecycle-flow">{action}:{orderId}</div>,
}));

import { PedidosContent } from "../PedidosContent";
import NuevaGuiaDialog from "../../../guias/_components/NuevaGuiaDialog";
import { openPrintWindow, printReceipts } from "@/utils/bulk-receipt-printer";

const guides: CreateGuideData[] = [
  { storeId: "store-a", orderIds: ["order-1", "order-2"], deliveryZones: ["PROVINCIAS"], deliveryType: "COURIER", courierName: "Courier", courierId: "courier", orderCarrierCosts: { "order-1": 8, "order-2": 12 } },
  { storeId: "store-b", orderIds: ["order-3"], deliveryZones: ["PROVINCIAS"], deliveryType: "COURIER", courierName: "Courier", courierId: "courier", orderCarrierCosts: { "order-3": 9 } },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth = null;
  mockRefetch.mockResolvedValue({});
  mockInvalidateBusinessData.mockResolvedValue([]);
  mockOrders = [1, 2, 3].map((n): OrderHeader => ({
    id: `order-${n}`,
    receiptType: "BOLETA",
    orderType: "VENTA",
    orderNumber: `ORD-${n}`,
    storeId: n < 3 ? "store-a" : "store-b",
    created_at: "2026-10-13T10:00:00Z",
    updated_at: "2026-10-13T10:00:00Z",
    status: "PREPARADO",
    deliveryType: "DOMICILIO",
    courier: null,
    courierId: null,
    salesChannel: "WHATSAPP",
    closingChannel: "WHATSAPP",
    salesRegion: "PROVINCIA",
    subtotal: "100",
    taxTotal: "0",
    shippingTotal: "0",
    discountTotal: "0",
    grandTotal: "100",
    cancellationReason: null,
    notes: null,
    customer: {
      id: `customer-${n}`,
      companyId: "company",
      fullName: `Cliente ${n}`,
      clientType: "TRADICIONAL",
      province: "Junín",
      city: "Huancayo",
      district: "Huancayo",
      address: "Calle Prueba 123",
      zone: "PROVINCIAS",
      isActive: true,
    },
    payments: [],
    items: [],
  }));
  jest.mocked(axios.post).mockReset();
  jest.mocked(axios.patch).mockReset().mockResolvedValue({ data: {} });
});

describe.each(["Pedidos", "Nueva guía"])("%s — creación por grupos", (entry) => {
  function setup() {
    if (entry === "Pedidos") {
      render(<PedidosContent />);
      fireEvent.click(screen.getByRole("button", { name: "Armar guías" }));
    } else {
      render(<NuevaGuiaDialog open onOpenChange={jest.fn()} />);
      fireEvent.click(screen.getAllByRole("checkbox")[0]);
      fireEvent.click(screen.getByRole("button", { name: "Generar guía (3)" }));
    }
  }

  it("crea cada grupo, conserva el flujo de estados e informa el total de guías", async () => {
    jest.mocked(axios.post)
      .mockResolvedValueOnce({ data: { id: "guide-1", guideNumber: "GUIA-1" } })
      .mockResolvedValueOnce({ data: { id: "guide-2", guideNumber: "GUIA-2" } });
    setup();

    await act(async () => { await mockModalProps.onConfirm(guides); });

    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.post).toHaveBeenNthCalledWith(1, expect.stringContaining("/shipping-guides"), guides[0]);
    expect(axios.post).toHaveBeenNthCalledWith(2, expect.stringContaining("/shipping-guides"), guides[1]);
    for (const n of [1, 2, 3]) {
      const patches = jest.mocked(axios.patch).mock.calls.filter(([url]) => url.endsWith(`/order-${n}`));
      expect(patches.map(([, data]) => data)).toEqual([
        expect.objectContaining({ status: "LLAMADO" }),
        expect.objectContaining({ status: "ASIGNADO_A_GUIA" }),
      ]);
      expect(patches[1][1]).toMatchObject({ guideNumber: n < 3 ? "GUIA-1" : "GUIA-2", courier: "Courier", courierId: "courier", carrierShippingCost: [8, 12, 9][n - 1] });
    }
    if (entry === "Pedidos") {
      expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining("/order-1"), expect.objectContaining({ carrierShippingCost: 8, userId: "operator" }));
    }
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("2 guías creadas con 3 pedido(s)"));
    expect(screen.queryByTestId("guide-selection")).not.toBeInTheDocument();
    expect(mockRefetch).toHaveBeenCalled();
  });

  it("tras fallar un POST, permite reintentar sólo el grupo que falta", async () => {
    jest.mocked(axios.post)
      .mockResolvedValueOnce({ data: { id: "guide-1", guideNumber: "GUIA-1" } })
      .mockRejectedValueOnce(new Error("fallo de courier"))
      .mockResolvedValueOnce({ data: { id: "guide-2", guideNumber: "GUIA-2" } });
    setup();

    await act(async () => { expect(await mockModalProps.onConfirm(guides)).toBe(false); });

    expect(screen.getByTestId("guide-selection")).toHaveTextContent(/^order-3$/);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Guías creadas: GUIA-1"));
    expect(mockInvalidateBusinessData).toHaveBeenCalled();
    await act(async () => { await mockModalProps.onConfirm([guides[1]]); });
    expect(jest.mocked(axios.post).mock.calls.map(([, data]) => data)).toEqual([guides[0], guides[1], guides[1]]);
  });

  it("asigna una guía conjunta sin alterar tiendas, almacenes ni costos no editados", async () => {
    mockOrders[1].carrierShippingCost = 25;
    jest.mocked(axios.post).mockResolvedValueOnce({ data: { id: "joint-guide", guideNumber: "GUIA-CONJUNTA" } });
    setup();
    const jointGuide: CreateGuideData = {
      ...guides[0],
      orderIds: ["order-1", "order-2", "order-3"],
      orderCarrierCosts: { "order-1": 0, "order-3": 9 },
    };

    await act(async () => { await mockModalProps.onConfirm([jointGuide]); });

    expect(axios.post).toHaveBeenCalledTimes(1);
    for (const n of [1, 2, 3]) {
      const patches = jest.mocked(axios.patch).mock.calls.filter(([url]) => url.endsWith(`/order-${n}`));
      const payload = patches[patches.length - 1][1];
      expect(payload).toMatchObject({ guideNumber: "GUIA-CONJUNTA", status: "ASIGNADO_A_GUIA" });
      expect(payload).not.toHaveProperty("storeId");
      expect(payload).not.toHaveProperty("inventoryId");
      expect(payload).not.toHaveProperty("stockStoreId");
      if (n === 2) expect(payload).not.toHaveProperty("carrierShippingCost");
      else expect(payload).toMatchObject({ carrierShippingCost: n === 1 ? 0 : 9 });
    }
  });

  it("retira todo el grupo ya persistido incluso si falla el primer PATCH", async () => {
    jest.mocked(axios.post).mockResolvedValueOnce({ data: { id: "guide-1", guideNumber: "GUIA-1" } });
    jest.mocked(axios.patch).mockRejectedValueOnce(new Error("fallo de ventas"));
    setup();

    await act(async () => { expect(await mockModalProps.onConfirm(guides)).toBe(false); });

    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("guide-selection")).toHaveTextContent(/^order-3$/);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("No se completó la actualización de los pedidos de GUIA-1"));
    expect(mockInvalidateBusinessData).toHaveBeenCalled();
  });

  it("conserva todos los pedidos si no se llegó a crear ninguna guía", async () => {
    jest.mocked(axios.post).mockRejectedValueOnce({ response: { data: { message: "Courier no disponible" } } });
    setup();

    await act(async () => { expect(await mockModalProps.onConfirm(guides)).toBe(false); });

    expect(screen.getByTestId("guide-selection")).toHaveTextContent("order-1,order-2,order-3");
    expect(toast.error).toHaveBeenCalledWith("Courier no disponible");
    expect(axios.patch).not.toHaveBeenCalled();
  });
});


describe("Pedidos terminal unit lifecycle routing", () => {
  it("opens reactivation selection for serialized orders without posting a generic status", async () => {
    mockOrders[0] = { ...mockOrders[0], status: "ANULADO", unitAssignmentStatus: "CONFIRMED", unitCatalogValidated: true };
    render(<PedidosContent />);
    await act(async () => { await mockActions.onChangeStatus("order-1", "PENDIENTE"); });
    expect(screen.getByTestId("lifecycle-flow")).toHaveTextContent("reactivate:order-1");
    expect(axios.patch).not.toHaveBeenCalled();
  });
  it("preserves the existing normal reactivation without consulting unit context", async () => {
    mockOrders[0] = { ...mockOrders[0], status: "ANULADO", unitAssignmentStatus: "NONE", unitCatalogValidated: true };
    render(<PedidosContent />);
    await act(async () => { await mockActions.onChangeStatus("order-1", "PENDIENTE"); });
    expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining("/order-header/order-1"), expect.objectContaining({ status: "PENDIENTE" }));
    expect(axios.get).not.toHaveBeenCalled(); expect(screen.queryByTestId("lifecycle-flow")).not.toBeInTheDocument();
  });
  it("silently classifies historical NONE and continues its original reactivation", async () => {
    mockOrders[0] = { ...mockOrders[0], status: "ANULADO", unitAssignmentStatus: "PENDING_SELECTION", unitCatalogValidated: false };
    jest.mocked(axios.get).mockResolvedValue({ data: { orderId: "order-1", status: "ANULADO", items: [{ trackingMode: "NONE" }], canReactivate: false } });
    render(<PedidosContent />);
    await act(async () => { await mockActions.onChangeStatus("order-1", "PENDIENTE"); });
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/unit-lifecycle/context"), expect.anything());
    expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining("/order-header/manual/order-1/status"), expect.objectContaining({ status: "PENDIENTE" }));
    expect(screen.queryByTestId("lifecycle-flow")).not.toBeInTheDocument();
  });
  it("opens full return for a delivered serialized order and never falls through to cancellation", async () => {
    mockOrders[0] = { ...mockOrders[0], status: "ENTREGADO", unitAssignmentStatus: "CONFIRMED", unitCatalogValidated: true };
    render(<PedidosContent />);
    await act(async () => { await mockActions.onChangeStatus("order-1", "ANULADO"); });
    expect(screen.getByTestId("lifecycle-flow")).toHaveTextContent("return:order-1");
    expect(axios.patch).not.toHaveBeenCalled();
  });
});


test("serialized bulk reactivation directs to individual selection without making any status write", async () => {
  mockOrders[0] = { ...mockOrders[0], status: "ANULADO", unitAssignmentStatus: "CONFIRMED", unitCatalogValidated: true };
  render(<PedidosContent />);
  await act(async () => { await mockActions.onBulkStatusChange(["order-1"], "PENDIENTE"); });
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("individualmente"));
  expect(axios.patch).not.toHaveBeenCalled();
});
test("normal bulk reactivation preserves its status mutation and does not fetch unit context", async () => {
  mockOrders[0] = { ...mockOrders[0], status: "ANULADO", unitAssignmentStatus: "NONE", unitCatalogValidated: true };
  render(<PedidosContent />);
  await act(async () => { await mockActions.onBulkStatusChange(["order-1"], "PENDIENTE"); });
  expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining("/order-header/order-1"), expect.objectContaining({ status: "PENDIENTE" }));
  expect(axios.get).not.toHaveBeenCalled();
});


test("Pedidos serialized merma directs to available inventory units without cancelling or writing stock", async () => {
  mockOrders[0] = { ...mockOrders[0], status: "ENTREGADO", unitAssignmentStatus: "CONFIRMED", unitCatalogValidated: true };
  render(<PedidosContent />);
  await act(async () => { await mockActions.onMarkAsLoss(mockOrders[0] as unknown as Sale); });
  expect(axios.patch).not.toHaveBeenCalled(); expect(axios.post).not.toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("confirma primero su devolución completa"), expect.objectContaining({ action: expect.objectContaining({ label: "Abrir inventario", onClick: expect.any(Function) }) }));
});
test("Pedidos normal merma retains the existing cancellation payload without unit movement fields", async () => {
  mockOrders[0] = { ...mockOrders[0], status: "ENTREGADO", unitAssignmentStatus: "NONE", unitCatalogValidated: true };
  render(<PedidosContent />);
  await act(async () => { await mockActions.onMarkAsLoss(mockOrders[0] as unknown as Sale); });
  expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining("/order-header/order-1"), { status: "ANULADO", cancellationReason: "OTHER", notes: "Devolución del courier — mercadería registrada como merma", userId: "operator" });
  expect(axios.post).not.toHaveBeenCalled();
});

describe("Pedidos — receipt batch identity and scope", () => {
  const printWindow = { close: jest.fn() } as unknown as Window;
  beforeEach(() => {
    mockAuth = { company: { id: "company-1" }, user: { id: "user-1" } };
    jest.mocked(openPrintWindow).mockReturnValue(printWindow);
    jest.mocked(printReceipts).mockResolvedValue(undefined);
  });
  it("prints confirmed tracked and NONE receipts through their corresponding routes", async () => {
    const selected = mockOrders.slice(0, 2).map((order, i) => ({ ...order, unitAssignmentStatus: i === 0 ? "CONFIRMED" : "NONE", unitCatalogValidated: true, stockVersion: 1, confirmedStockVersion: 1 }));
    jest.mocked(axios.get).mockImplementation(async (url) => ({ data: { orderId: url.match(/order-header\/(?:manual\/)?([^/]+)\/receipt/)![1], orderNumber: "ORD", customer: { fullName: "Cliente" } } }));
    render(<PedidosContent />);
    await act(async () => { await mockActions.onBulkPrint(selected as unknown as Sale[]); });
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/manual/order-1/receipt"));
    expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/order-header\/order-2\/receipt$/));
    expect(jest.mocked(printReceipts).mock.calls[0][0].map(receipt => receipt.orderId)).toEqual(["order-1", "order-2"]);
  });
  it("never prints a fulfilled response belonging to another order", async () => {
    const errors = jest.spyOn(console, "error").mockImplementation(() => {});
    jest.mocked(axios.get).mockResolvedValue({ data: { orderId: "other-order" } });
    render(<PedidosContent />);
    await act(async () => { await mockActions.onBulkPrint([mockOrders[0]] as unknown as Sale[]); });
    expect(printReceipts).not.toHaveBeenCalled();
    expect(printWindow.close).toHaveBeenCalled();
    errors.mockRestore();
  });
  it("discards an in-flight batch on a user change", async () => {
    let resolveReceipt!: (value: any) => void;
    jest.mocked(axios.get).mockReturnValue(new Promise(resolve => { resolveReceipt = resolve; }));
    const view = render(<PedidosContent />);
    let work: unknown;
    act(() => { work = mockActions.onBulkPrint([mockOrders[0]] as unknown as Sale[]); });
    mockAuth = { company: { id: "company-1" }, user: { id: "user-2" } };
    view.rerender(<PedidosContent />);
    await act(async () => { resolveReceipt({ data: { orderId: "order-1" } }); await work; });
    expect(printReceipts).not.toHaveBeenCalled();
    expect(printWindow.close).toHaveBeenCalled();
    expect(axios.patch).not.toHaveBeenCalled();
  });
});


describe("Pedidos — anulación en envío conserva la reserva hasta retorno físico", () => {
  test.each(["status", "cancel", "return"])("%s action opens physical return without writing status", async (entry) => {
    mockOrders[0] = { ...mockOrders[0], status: "EN_ENVIO", unitAssignmentStatus: "CONFIRMED", unitCatalogValidated: true };
    render(<PedidosContent />);
    await act(async () => {
      if (entry === "status") await mockActions.onChangeStatus("order-1", "ANULADO");
      else if (entry === "cancel") mockActions.onCancel(mockOrders[0] as unknown as Sale);
      else await mockActions.onReturnToStock(mockOrders[0] as unknown as Sale);
    });
    expect(await screen.findByTestId("lifecycle-flow")).toHaveTextContent("return:order-1");
    expect(screen.queryByRole("button", { name: "Confirmar anulación normal" })).not.toBeInTheDocument();
    expect(axios.patch).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
  });
  test("UNKNOWN consults context before opening a return from the direct cancel action", async () => {
    mockOrders[0] = { ...mockOrders[0], status: "EN_ENVIO", unitAssignmentStatus: "PENDING_SELECTION", unitCatalogValidated: false };
    jest.mocked(axios.get).mockResolvedValue({ data: { orderId: "order-1", status: "EN_ENVIO", items: [{ trackingMode: "SERIAL" }] } });
    render(<PedidosContent />);
    await act(async () => { mockActions.onCancel(mockOrders[0] as unknown as Sale); });
    expect(await screen.findByTestId("lifecycle-flow")).toHaveTextContent("return:order-1");
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining("/unit-lifecycle/context"), expect.anything());
    expect(axios.patch).not.toHaveBeenCalled();
  });
  test("NONE keeps its cancellation modal and exact legacy payload", async () => {
    mockOrders[0] = { ...mockOrders[0], status: "EN_ENVIO", unitAssignmentStatus: "NONE", unitCatalogValidated: true };
    render(<PedidosContent />);
    await act(async () => { mockActions.onCancel(mockOrders[0] as unknown as Sale); });
    await act(async () => { fireEvent.click(await screen.findByRole("button", { name: "Confirmar anulación normal" })); });
    expect(axios.patch).toHaveBeenCalledWith(expect.stringMatching(/\/order-header\/order-1$/), { status: "ANULADO", cancellationReason: "OTHER", notes: "Cliente canceló", userId: "operator" });
    expect(axios.get).not.toHaveBeenCalled();
    expect(screen.queryByTestId("lifecycle-flow")).not.toBeInTheDocument();
  });
});
