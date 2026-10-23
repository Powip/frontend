import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

jest.mock("axios", () => ({
  default: { get: jest.fn(), patch: jest.fn(), post: jest.fn() },
  get: jest.fn(),
  patch: jest.fn(),
  post: jest.fn(),
}));

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: jest.requireMock("axios") }));
jest.mock("@/contexts/BusinessScopeContext", () => ({ useBusinessScope: () => ({ scopeKey: "company-1:business:store-1,store-2", storeIds: ["store-1", "store-2"] }) }));
// Referencia estable: después de una acción, la vista recarga invalidando las consultas del negocio.
const mockInvalidate = jest.fn();
jest.mock("@/hooks/useInvalidateBusinessData", () => ({ useInvalidateBusinessData: () => mockInvalidate }));
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

jest.mock("@/hooks/useBusinessOrders", () => ({
  useBusinessOrders: jest.fn(),
}));
jest.mock("@/hooks/useBusinessOrdersCount", () => ({
  useBusinessOrdersCount: () => ({ count: 0, loading: false, error: false, retry: jest.fn(), refetch: jest.fn() }),
}));
// El listado nuevo recibe una página del servidor. Los fixtures siguen siendo
// compartidos con los casos de impresión y estados de esta suite.
jest.mock("@/hooks/useBusinessSalesPage", () => ({
  useBusinessSalesPage: (_storeIds: string[], query: import("@/services/businessSalesService").BusinessSalesQuery) => {
    const React = jest.requireActual("react") as typeof import("react");
    const fixture = jest.requireMock("@/hooks/useBusinessOrders").useBusinessOrders();
    const data = React.useMemo(() => {
      const commercial = fixture.orders.filter((order: OrderHeader) => order.status !== "INCOMPLETE");
      const operational = commercial.filter((order: BusinessSalesOrder) => order.salesOperationalEligible !== false);
      const rows = (query.tab === "todas" ? commercial : operational).filter((order: OrderHeader) =>
        query.tab === "pendientes" ? order.status === "PENDIENTE" : query.tab === "anuladas" ? order.status === "ANULADO" : true,
      ).sort((a: OrderHeader, b: OrderHeader) => b.created_at.localeCompare(a.created_at));
      return {
        data: rows.slice((query.page - 1) * query.limit, query.page * query.limit),
        total: rows.length, page: query.page, totalPages: Math.max(1, Math.ceil(rows.length / query.limit)),
        counts: { pendientes: operational.filter((order: OrderHeader) => order.status === "PENDIENTE").length, anuladas: commercial.filter((order: OrderHeader) => order.status === "ANULADO").length, todas: commercial.length, pendientesAntiguos: 0 },
        metadata: { couriers: [], statuses: [...new Set(commercial.map((order: OrderHeader) => order.status))], channels: [], products: [] },
        kpis: { pendientes: operational.filter((order: OrderHeader) => order.status === "PENDIENTE").length, anuladas: 0, amounts: [] },
      };
    }, [fixture.orders, query.tab, query.page, query.limit]);
    return { data, isFetching: false, isDebouncing: false, isError: false, refetch: fixture.refetch };
  },
}));
// Hoy fijo en 09-26: los pedidos del 09-01 y 09-02 entran en la ventana de 30 días.
jest.mock("@/lib/peruDate", () => ({
  ...jest.requireActual("@/lib/peruDate"),
  todayInPeru: () => "2026-09-26",
}));

jest.mock("@/utils/bulk-receipt-printer", () => ({
  ...jest.requireActual("@/utils/bulk-receipt-printer"),
  buildReceiptsDocument: jest.fn(async () => "<!DOCTYPE html><html><body>ETIQUETAS</body></html>"),
  openPrintWindow: jest.fn(() => ({ close: jest.fn() })),
  printReceipts: jest.fn(async () => {}),
}));

jest.mock("@/components/modals/CustomerServiceModal", () => ({
  __esModule: true,
  default: ({ open, orderId }: { open: boolean; orderId: string }) => open ? <div data-testid="order-detail">{orderId}</div> : null,
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
  default: ({ open, onConfirm }: { open: boolean; onConfirm: (reason: string, notes: string) => void }) => open ? <button onClick={() => onConfirm("OTHER", "Cliente canceló")}>Confirmar anulación normal</button> : null,
}));
jest.mock("@/components/registrar-venta/SaleUnitLifecycleModal", () => ({
  __esModule: true,
  default: ({ action, orderId }: { action: string; orderId: string }) => <div data-testid="lifecycle-flow">{action}:{orderId}</div>,
}));
jest.mock("@/components/ventas/StatusSelect", () => ({
  StatusSelect: ({ status, onStatusChange }: { status: string; onStatusChange: (status: string) => void }) => <button onClick={() => onStatusChange("ANULADO")}>Anular {status}</button>,
}));
jest.mock("@/components/modals/ReassignSellerModal", () => ({
  __esModule: true,
  default: () => null,
}));

import axios from "axios";
import { toast } from "sonner";
import { openPrintWindow, printReceipts } from "@/utils/bulk-receipt-printer";
import { useAuth } from "@/contexts/AuthContext";
import { useBusinessOrders } from "@/hooks/useBusinessOrders";
import type { OrderHeader } from "@/interfaces/IOrder";
import type { BusinessSalesOrder } from "@/services/businessSalesService";
import VentasPage from "../page";

const mockedAxios = axios as unknown as { get: jest.Mock; patch: jest.Mock; post: jest.Mock };
const mockUseAuth = jest.mocked(useAuth);
const mockUseOrdersByStore = jest.mocked(useBusinessOrders);
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
    orders: ORDERS,
    loading: false,
    error: false,
    retry: jest.fn(),
    refetch,
  } as unknown as ReturnType<typeof useBusinessOrders>);
  mockedAxios.get.mockImplementation(async (url: string) => {
    const match = url.match(/order-header\/(?:manual\/)?(.+)\/receipt$/);
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
  const view = render(<VentasPage />);
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
  return { dialog, print, printButton, view };
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
    expect(mockInvalidate).not.toHaveBeenCalled();

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
    expect(mockInvalidate).toHaveBeenCalled();
    // Una sola recarga: la invalidación ya refresca cada consulta activa de la vista
    expect(refetch).not.toHaveBeenCalled();
  });
});


it("blocks preparation/label printing for a selected sale whose units are still pending", async () => {
  const prior = mockUseOrdersByStore.getMockImplementation()!();
  mockUseOrdersByStore.mockReturnValue({ ...prior, orders: ORDERS.map((order) => ({ ...order, unitAssignmentStatus: "PENDING", unitCatalogValidated: true, stockVersion: 2, confirmedStockVersion: null })) });
  render(<VentasPage />);
  await screen.findByText("ORD-001");
  fireEvent.click(within(screen.getByRole("tabpanel")).getAllByRole("checkbox")[0]);
  fireEvent.click(screen.getByRole("button", { name: /Imprimir seleccionados \(2\)/ }));
  expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/pendiente de confirmación/));
  expect(screen.queryByTitle("Vista previa de etiquetas")).not.toBeInTheDocument();
  expect(mockedAxios.patch).not.toHaveBeenCalled();
});

it("confirmed tracked preparation uses the authenticated status route", async () => {
  const prior = mockUseOrdersByStore.getMockImplementation()!();
  mockUseOrdersByStore.mockReturnValue({ ...prior, orders: ORDERS.map((order) => ({ ...order, unitAssignmentStatus: "CONFIRMED", unitCatalogValidated: true, stockVersion: 2, confirmedStockVersion: 2 })) });
  const { printButton } = await openPreviewForAllPendientes();
  expect(mockedAxios.get).toHaveBeenCalledWith("http://ventas/order-header/manual/o-1/receipt");
  expect(mockedAxios.get).toHaveBeenCalledWith("http://ventas/order-header/manual/o-2/receipt");
  fireEvent.click(printButton);
  fireEvent.click(within(await confirmStep()).getByRole("button", { name: "Sí, marcar como PREPARADO" }));
  await waitFor(() => expect(mockedAxios.patch).toHaveBeenCalledTimes(2));
  expect(mockedAxios.patch).toHaveBeenCalledWith("http://ventas/order-header/manual/o-1/status", expect.objectContaining({ status: "PREPARADO" }));
  expect(mockedAxios.patch).toHaveBeenCalledWith("http://ventas/order-header/manual/o-2/status", expect.objectContaining({ status: "PREPARADO" }));
});

it.each(['company', 'user'])('hides an existing private print preview when %s changes', async (changed) => {
  const { view } = await openPreviewForAllPendientes();
  const prior = mockUseAuth.getMockImplementation()!();
  const company = prior.auth?.company;
  if (!company) throw new Error("The authenticated fixture requires a company");
  mockUseAuth.mockReturnValue({ ...prior, auth: { ...prior.auth!,
    company: { ...company, id: changed === 'company' ? 'company-2' : 'company-1' },
    user: { ...prior.auth!.user, id: changed === 'user' ? 'user-2' : 'user-1' },
  } });
  view.rerender(<VentasPage />);
  expect(screen.queryByTitle('Vista previa de etiquetas')).not.toBeInTheDocument();
  expect(mockedAxios.patch).not.toHaveBeenCalled();
});


describe("Ventas — anulación de pedido en envío", () => {
  async function cancelInTransit(unitAssignmentStatus: "CONFIRMED" | "NONE") {
    const order = { ...ORDERS[0], status: "EN_ENVIO" as const, unitAssignmentStatus, unitCatalogValidated: true, stockVersion: 1, confirmedStockVersion: 1 };
    mockUseOrdersByStore.mockReturnValue({ orders: [order], loading: false, error: false, retry: jest.fn(), refetch } as unknown as ReturnType<typeof useBusinessOrders>);
    render(<VentasPage />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Todas/i }), { button: 0, ctrlKey: false });
    const cancel = await screen.findByRole("button", { name: "Anular EN_ENVIO" });
    await act(async () => { fireEvent.click(cancel); });
  }
  test("tracked order opens physical return and cannot be cancelled by a generic patch", async () => {
    await cancelInTransit("CONFIRMED");
    expect(await screen.findByTestId("lifecycle-flow")).toHaveTextContent("return:o-1");
    expect(mockedAxios.patch).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Confirmar anulación normal" })).not.toBeInTheDocument();
  });
  test("NONE retains its existing cancellation path", async () => {
    await cancelInTransit("NONE");
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar anulación normal" }));
    await waitFor(() => expect(mockedAxios.patch).toHaveBeenCalledWith("http://ventas/order-header/o-1", expect.objectContaining({ status: "ANULADO", cancellationReason: "OTHER", notes: "Cliente canceló" })));
    expect(screen.queryByTestId("lifecycle-flow")).not.toBeInTheDocument();
  });
});


function customerServiceOrders(): BusinessSalesOrder[] {
  const orders: BusinessSalesOrder[] = [
    { ...makeOrder("angela", "ORD-152907", "2026-09-23T10:00:00.000Z"), subEstadoCc: "entrega_lima", canalOrigen: "manual", salesOperationalEligible: false },
    { ...makeOrder("elisa", "ORD-152728", "2026-09-24T10:00:00.000Z"), storeId: "store-2", externalSource: "shopify", subEstadoCc: "por_confirmar", canalOrigen: "shopify_cod", stockVersion: 0, salesOperationalEligible: false },
  ];
  return orders.map((order) => ({ ...order, items: [{
    id: `item-${order.id}`, productVariantId: "variant-1", sku: "SKU-CC", productName: "Producto Blumie", attributes: {},
    quantity: 1, unitPrice: "100.00", subtotal: "100.00", discountType: "NONE", discountAmount: "0.00",
    created_at: order.created_at, updated_at: order.updated_at,
  }] }));
}

function useFixtureOrders(orders: BusinessSalesOrder[]) {
  mockUseOrdersByStore.mockReturnValue({ orders, loading: false, error: false, retry: jest.fn(), refetch } as unknown as ReturnType<typeof useBusinessOrders>);
}

async function openAllSales() {
  fireEvent.mouseDown(screen.getByRole("tab", { name: /Todas las Ventas/ }), { button: 0, ctrlKey: false });
  return screen.getByRole("tabpanel");
}

describe("Ventas — pedidos que siguen en Atención", () => {
  it("cierra una vista previa existente si los pedidos pasan a Atención antes de imprimir o preparar", async () => {
    const { view } = await openPreviewForAllPendientes();
    useFixtureOrders(ORDERS.map((order) => ({ ...order, subEstadoCc: "entrega_lima", salesOperationalEligible: false })));
    view.rerender(<VentasPage />);
    expect(screen.queryByTitle("Vista previa de etiquetas")).not.toBeInTheDocument();
    expect(mockedAxios.patch).not.toHaveBeenCalled();
  });

  it("cierra el detalle con acciones si una venta abierta pasa a ser informativa", async () => {
    const view = render(<VentasPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Ver detalle del pedido ORD-001" }));
    expect(await screen.findByTestId("order-detail")).toHaveTextContent("o-1");
    useFixtureOrders(ORDERS.map((order) => ({ ...order, subEstadoCc: "entrega_lima", salesOperationalEligible: false })));
    view.rerender(<VentasPage />);
    expect(screen.queryByTestId("order-detail")).not.toBeInTheDocument();
    expect(mockedAxios.patch).not.toHaveBeenCalled();
  });

  it("muestra Angela y Elisa en Todas, con montos/productos y sin acciones operativas; seleccionar todos imprime solo las ventas habilitadas", async () => {
    useFixtureOrders([...ORDERS, ...customerServiceOrders()]);
    render(<VentasPage />);
    await screen.findByText("ORD-001");
    expect(screen.queryByText("ORD-152907")).not.toBeInTheDocument();
    expect(screen.queryByText("ORD-152728")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Todas las Ventas/ })).toHaveTextContent("4");
    const panel = await openAllSales();
    expect(await within(panel).findByText("ORD-152907")).toBeInTheDocument();
    expect(within(panel).getByText("ORD-152728")).toBeInTheDocument();
    expect(within(panel).getByText("Incluye los pedidos que están en Atención al cliente.")).toBeInTheDocument();
    for (const [number, label] of [["ORD-152907", "Por coordinar"], ["ORD-152728", "Por confirmar"]]) {
      const row = within(panel).getByText(number).closest("tr")!;
      expect(within(row).getByText(`En Atención · ${label}`)).toBeInTheDocument();
      expect(within(row).getByRole("checkbox")).toBeDisabled();
      expect(within(row).getByRole("link", { name: "Atención al cliente" })).toHaveAttribute("href", "/atencion-cliente");
      expect(within(row).queryByRole("button", { name: /Anular|Ver detalle|Editar|Gestión de Pagos|Enviar a CC Lima|Reasignar vendedor/ })).not.toBeInTheDocument();
      expect(within(row).getByText("Moneda no informada 100.00")).toBeInTheDocument();
      expect(within(row).getByRole("button", { name: "1 items" })).toBeInTheDocument();
      fireEvent.click(within(row).getByRole("button", { name: "Ver más detalles" }));
      const details = row.nextElementSibling as HTMLElement;
      expect(within(details).queryByRole("textbox")).not.toBeInTheDocument();
    }
    fireEvent.click(within(panel).getAllByRole("checkbox")[0]);
    expect(within(panel).getByRole("button", { name: /Imprimir seleccionados \(2\)/ })).toBeEnabled();
    for (const number of ["ORD-152907", "ORD-152728"]) {
      expect(within(within(panel).getByText(number).closest("tr")!).getByRole("checkbox")).not.toBeChecked();
    }
    fireEvent.click(within(panel).getByRole("button", { name: /Imprimir seleccionados \(2\)/ }));
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledTimes(2));
    expect(mockedAxios.get.mock.calls.map(([url]) => url)).toEqual([
      "http://ventas/order-header/o-2/receipt", "http://ventas/order-header/o-1/receipt",
    ]);
    expect(mockedAxios.patch).not.toHaveBeenCalled();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("un usuario solo de Ventas ve el estado CC sin un acceso a Atención que su rol no permite", async () => {
    const prior = mockUseAuth.getMockImplementation()!();
    mockUseAuth.mockReturnValue({ ...prior, hasPermission: () => false });
    useFixtureOrders(customerServiceOrders());
    render(<VentasPage />);
    const panel = await openAllSales();
    await within(panel).findByText("ORD-152907");
    expect(within(panel).getByText("En Atención · Por coordinar")).toBeInTheDocument();
    expect(within(panel).queryByRole("link", { name: "Atención al cliente" })).not.toBeInTheDocument();
    expect(within(panel).getAllByRole("checkbox").every((checkbox) => checkbox.hasAttribute("disabled"))).toBe(true);
    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(mockedAxios.patch).not.toHaveBeenCalled();
  });

  it("respeta la bandera operativa del servidor para Shopify ya comprometido aunque conserve un subestado CC", async () => {
    useFixtureOrders([{ ...customerServiceOrders()[1], salesOperationalEligible: true, stockVersion: 1 }]);
    render(<VentasPage />);
    const panel = await openAllSales();
    const row = (await within(panel).findByText("ORD-152728")).closest("tr")!;
    expect(within(row).getByRole("checkbox")).toBeEnabled();
    expect(within(row).getByRole("button", { name: "Anular PENDIENTE" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Ver detalle del pedido ORD-152728" })).toBeInTheDocument();
    expect(within(row).queryByText(/En Atención/)).not.toBeInTheDocument();
    fireEvent.click(within(row).getByRole("checkbox"));
    fireEvent.click(within(panel).getByRole("button", { name: /Imprimir seleccionados \(1\)/ }));
    await waitFor(() => expect(mockedAxios.get).toHaveBeenCalledWith("http://ventas/order-header/elisa/receipt"));
  });
});


describe("Ventas — impresión genérica pendiente de terminar", () => {
  it.each(["Atención", "otra página"] as const)("descarta recibos si cambia a %s mientras se genera la impresión", async (change) => {
    const orders: BusinessSalesOrder[] = Array.from({ length: 12 }, (_, index) => ({
      ...makeOrder(`race-${index}`, `ORD-RACE-${index}`, `2026-09-${String(index + 1).padStart(2, "0")}T10:00:00.000Z`),
      salesOperationalEligible: true,
    }));
    useFixtureOrders(orders);
    let release!: () => void;
    const generating = new Promise<void>((resolve) => { release = resolve; });
    const printNow = jest.fn();
    const printMock = jest.mocked(printReceipts);
    printMock.mockImplementationOnce(async (_receipts, _company, printWindow, isCurrent) => {
      await generating;
      // The real helper checks this callback again after building the document
      // and in window.onload. Reproduce that delayed boundary here.
      if (!isCurrent?.()) { printWindow?.close(); return; }
      printNow();
    });
    const view = render(<VentasPage />);
    try {
      const panel = await openAllSales();
      const row = (await within(panel).findByText("ORD-RACE-11")).closest("tr")!;
      fireEvent.click(within(row).getByRole("checkbox"));
      fireEvent.click(within(panel).getByRole("button", { name: /Imprimir seleccionados \(1\)/ }));
      await waitFor(() => expect(printMock).toHaveBeenCalledTimes(1));
      const isCurrent = printMock.mock.calls[0][3]!;
      const printWindow = jest.mocked(openPrintWindow).mock.results.at(-1)!.value as Window;
      expect(isCurrent()).toBe(true);

      if (change === "Atención") {
        useFixtureOrders(orders.map((order) => order.id === "race-11"
          ? { ...order, salesOperationalEligible: false, subEstadoCc: "por_confirmar" }
          : order));
        view.rerender(<VentasPage />);
        expect(screen.getByText("En Atención · Por confirmar")).toBeInTheDocument();
      } else {
        fireEvent.click(screen.getByRole("button", { name: "2" }));
        await screen.findByText("ORD-RACE-0");
      }
      expect(isCurrent()).toBe(false);
      await act(async () => { release(); });
      await waitFor(() => expect(printWindow.close).toHaveBeenCalled());
      expect(printNow).not.toHaveBeenCalled();
      expect(mockedAxios.patch).not.toHaveBeenCalled();
      expect(mockedAxios.post).not.toHaveBeenCalled();
    } finally {
      release();
      printMock.mockReset().mockResolvedValue(undefined);
    }
  });
});
