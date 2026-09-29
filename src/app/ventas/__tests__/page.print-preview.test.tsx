import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("axios", () => ({
  default: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
  get: jest.fn(),
  patch: jest.fn(),
  post: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/ventas",
}));

jest.mock("@/services/atencionClienteService", () => ({
  enviarPedidoALima: jest.fn(),
  reassignSeller: jest.fn(),
}));

jest.mock("@/hooks/useOrdersByStore", () => ({
  useOrdersByStore: jest.fn(),
}));

jest.mock("@/utils/bulk-receipt-printer", () => ({
  ...jest.requireActual("@/utils/bulk-receipt-printer"),
  buildReceiptsDocument: jest.fn(async () => "<!DOCTYPE html><html><body>ETIQUETAS</body></html>"),
}));

jest.mock("@/components/modals/CustomerServiceModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/modals/CommentsTimelineModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/modals/PaymentVerificationModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/modals/ImportSalesModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/modals/CreateGuideModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/modals/CancellationModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/modals/ReassignSellerModal", () => ({
  __esModule: true,
  default: () => null,
}));

import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { useOrdersByStore } from "@/hooks/useOrdersByStore";
import type { OrderHeader } from "@/interfaces/IOrder";
import VentasPage from "../page";

const mockedAxios = axios as unknown as { get: jest.Mock; patch: jest.Mock; post: jest.Mock };
const mockUseAuth = jest.mocked(useAuth);
const mockUseOrdersByStore = jest.mocked(useOrdersByStore);
const refetch = jest.fn();

process.env.NEXT_PUBLIC_API_VENTAS = "http://ventas";

function makeOrder(id: string, orderNumber: string, createdAt: string): OrderHeader {
  return {
    id,
    receiptType: "BOLETA",
    orderType: "VENTA",
    orderNumber,
    storeId: "store-1",
    customer: {
      id: `client-${id}`,
      companyId: "company-1",
      fullName: `Cliente ${orderNumber}`,
      phoneNumber: "999111222",
      clientType: "TRADICIONAL",
      province: "Lima",
      city: "Lima",
      district: "Miraflores",
      address: "Av. Test 123",
      isActive: true,
    },
    salesChannel: "WHATSAPP",
    closingChannel: "WHATSAPP",
    deliveryType: "DOMICILIO",
    courierId: null,
    courier: null,
    subtotal: "100.00",
    taxTotal: "0.00",
    shippingTotal: "0.00",
    discountTotal: "0.00",
    grandTotal: "100.00",
    status: "PENDIENTE",
    salesRegion: "LIMA",
    cancellationReason: null,
    notes: null,
    items: [],
    payments: [],
    created_at: createdAt,
    updated_at: createdAt,
  } as OrderHeader;
}

const ORDERS = [
  makeOrder("o-1", "ORD-001", "2026-09-01T10:00:00.000Z"),
  makeOrder("o-2", "ORD-002", "2026-09-02T10:00:00.000Z"),
];

let openSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({
    auth: {
      user: { id: "user-1", name: "Ana", surname: "Vendedora", email: "ana@powip.com", role: "ADMIN", permissions: [] },
      company: { id: "company-1", name: "Powip Test", stores: [] },
      accessToken: "fake-token",
      subscription: null,
      exp: 9999999999,
    },
    loading: false,
    selectedStoreId: "store-1",
    hasPermission: jest.fn().mockReturnValue(true),
  } as unknown as ReturnType<typeof useAuth>);
  mockUseOrdersByStore.mockReturnValue({
    data: ORDERS,
    refetch,
  } as unknown as ReturnType<typeof useOrdersByStore>);
  mockedAxios.get.mockImplementation(async (url: string) => {
    const match = url.match(/order-header\/(.+)\/receipt$/);
    if (match) {
      return { data: { orderId: match[1], orderNumber: match[1], customer: { fullName: "x" } } };
    }
    return { data: [] };
  });
  mockedAxios.patch.mockResolvedValue({ data: {} });
  openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
});

afterEach(() => {
  openSpy.mockRestore();
});

const CONFIRM_STEP = { name: "Confirmar cambio de estado" };

async function confirmStep() {
  await screen.findByRole("region", CONFIRM_STEP);
  return screen.getByRole("dialog");
}

async function openPreviewForAllPendientes() {
  render(<VentasPage />);
  await screen.findByText("ORD-001");
  const pendientesPanel = screen.getByRole("tabpanel");
  fireEvent.click(within(pendientesPanel).getAllByRole("checkbox")[0]);
  fireEvent.click(screen.getByRole("button", { name: /Imprimir seleccionados \(2\)/ }));
  const dialog = await screen.findByRole("dialog");
  const frame = (await within(dialog).findByTitle("Vista previa de etiquetas")) as HTMLIFrameElement;
  fireEvent.load(frame);
  const frameWindow = frame.contentWindow as Window;
  jest.spyOn(frameWindow, "focus").mockImplementation(() => {});
  const print = jest.spyOn(frameWindow, "print").mockImplementation(() => {});
  const printButton = within(dialog).getByRole("button", { name: /Imprimir \/ Guardar PDF/ });
  await waitFor(() => expect(printButton).toBeEnabled());
  return { dialog, print, printButton };
}

describe("VentasPage — imprimir seleccionados en Ventas pendientes", () => {
  it("abre la vista previa en la app sin ventana emergente y en el orden de la tabla", async () => {
    await openPreviewForAllPendientes();

    expect(openSpy).not.toHaveBeenCalled();
    const receiptCalls = mockedAxios.get.mock.calls
      .map(([url]) => url as string)
      .filter((url) => url.endsWith("/receipt"));
    expect(receiptCalls).toEqual([
      "http://ventas/order-header/o-2/receipt",
      "http://ventas/order-header/o-1/receipt",
    ]);
    expect(mockedAxios.patch).not.toHaveBeenCalled();
  });

  it("cerrar la vista previa no cambia estados", async () => {
    const { dialog } = await openPreviewForAllPendientes();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockedAxios.patch).not.toHaveBeenCalled();
  });

  it("imprimir y cancelar la confirmación no cambia estados", async () => {
    const { print, printButton, dialog } = await openPreviewForAllPendientes();

    fireEvent.click(printButton);
    expect(print).toHaveBeenCalledTimes(1);
    fireEvent.click(
      within(await confirmStep()).getByRole("button", {
        name: "Volver",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("region", CONFIRM_STEP)).not.toBeInTheDocument());
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockedAxios.patch).not.toHaveBeenCalled();
  });

  it("solo la confirmación explícita pasa los pedidos seleccionados a PREPARADO", async () => {
    const { printButton } = await openPreviewForAllPendientes();

    fireEvent.click(printButton);
    expect(mockedAxios.patch).not.toHaveBeenCalled();

    fireEvent.click(
      within(await confirmStep()).getByRole("button", {
        name: "Sí, marcar como PREPARADO",
      }),
    );

    await waitFor(() => expect(mockedAxios.patch).toHaveBeenCalledTimes(2));
    expect(mockedAxios.patch).toHaveBeenCalledWith(
      "http://ventas/order-header/o-2",
      expect.objectContaining({ status: "PREPARADO", userId: "user-1" }),
    );
    expect(mockedAxios.patch).toHaveBeenCalledWith(
      "http://ventas/order-header/o-1",
      expect.objectContaining({ status: "PREPARADO", userId: "user-1" }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(refetch).toHaveBeenCalled();
  });
});
