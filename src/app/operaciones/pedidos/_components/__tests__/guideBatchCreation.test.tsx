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
let mockModalProps: {
  open: boolean;
  selectedOrders: { id: string }[];
  onConfirm: (guides: CreateGuideData[]) => Promise<boolean | void>;
};

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { post: jest.fn(), patch: jest.fn() } }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/hooks/useBusinessOrders", () => ({
  useBusinessOrders: () => ({ orders: mockOrders, loading: false, error: false, refetch: mockRefetch }),
}));
jest.mock("@/hooks/useInvalidateBusinessData", () => ({ useInvalidateBusinessData: () => mockInvalidateBusinessData }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: null }) }));
jest.mock("@/contexts/OperationsRoleContext", () => ({
  useOperationsRole: () => ({ can: () => true }),
  OPS_PERMISSIONS: { DISPATCH: "DISPATCH" },
}));
jest.mock("@/hooks/useUserAuditInfo", () => ({ useUserAuditInfo: () => () => ({ userId: "operator" }) }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), useSearchParams: () => new URLSearchParams() }));
jest.mock("../guideReviewReturn", () => ({ useGuideReviewReturn: () => ({ pending: null, clear: jest.fn() }) }));
jest.mock("../PorDespacharTab", () => ({
  PorDespacharTab: ({ sales, actions }: { sales: Sale[]; actions: PedidosActions }) => (
    <button onClick={() => actions.onOpenCreateGuide(sales)}>Armar guías</button>
  ),
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
jest.mock("@/components/modals/CancellationModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/CourierAssignmentModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/ReassignSellerModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/ventas/RescheduleDialog", () => ({ RescheduleDialog: () => null }));

import { PedidosContent } from "../PedidosContent";
import NuevaGuiaDialog from "../../../guias/_components/NuevaGuiaDialog";

const guides: CreateGuideData[] = [
  { storeId: "store-a", orderIds: ["order-1", "order-2"], deliveryZones: ["PROVINCIAS"], deliveryType: "COURIER", courierName: "Courier", courierId: "courier", orderCarrierCosts: { "order-1": 8, "order-2": 12 } },
  { storeId: "store-b", orderIds: ["order-3"], deliveryZones: ["PROVINCIAS"], deliveryType: "COURIER", courierName: "Courier", courierId: "courier", orderCarrierCosts: { "order-3": 9 } },
];

beforeEach(() => {
  jest.clearAllMocks();
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
