/**
 * Finanzas › Pagos por validar (FEAT-33 B1/A9): una sola cola de pagos del negocio, con filtro
 * Todos / POWIP Live y Link / Otros orígenes. Las filas Live se validan con el validador Yape
 * (operación, plazo, «Revisar y validar» y «Rechazar comprobante»); las demás siguen como hoy.
 */
import {
  fireEvent,
  render as rtlRender,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

let scopedStoreIds = ["store-1"];
let mockSearch = "";
jest.mock("@/contexts/BusinessScopeContext", () => ({
  useBusinessScope: () => ({
    storeIds: scopedStoreIds,
    scope: "business",
    canFetch: true,
    scopeKey: `company-1:business:${scopedStoreIds.join(",")}`,
  }),
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: jest.requireMock("axios"),
}));
function render(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

// ── Mocks de infraestructura ─────────────────────────────────────────────────

jest.mock("axios", () => ({
  default: {
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
  },
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
  usePathname: () => "/finanzas",
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

jest.mock("@/components/modals/CustomerServiceModal", () => ({
  __esModule: true,
  default: () => null,
}));
// The resend button has its own test; here it would consume the mocked HTTP calls.
jest.mock("@/components/facturacion/ReenviarPdfWhatsAppButton", () => ({ ReenviarPdfWhatsAppButton: () => null }));
jest.mock("@/components/modals/CommentsTimelineModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/modals/PaymentVerificationModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/utils/bulk-receipt-printer", () => ({
  openPrintWindow: jest.fn(),
  printReceipts: jest.fn(),
}));

// ── Imports bajo prueba (después de los mocks) ────────────────────────────────

import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import FinanzasPage from "../page";
import type { OrderHeader } from "@/interfaces/IOrder";

const mockedAxios = axios as unknown as {
  get: jest.Mock;
  patch: jest.Mock;
  post: jest.Mock;
};
const mockUseAuth = jest.mocked(useAuth);

// ── Fixtures ─────────────────────────────────────────────────────────────────

process.env.NEXT_PUBLIC_API_VENTAS = "http://ventas";
process.env.NEXT_PUBLIC_API_COURIER = "http://courier";

const MOCK_AUTH = {
  auth: {
    user: {
      id: "user-1",
      name: "Ana",
      surname: "Vendedora",
      email: "ana@powip.com",
      role: "ADMIN",
      permissions: [],
    },
    company: {
      id: "company-1",
      name: "Powip Test",
      stores: [{ id: "store-1", name: "Tienda Test" }],
    },
    accessToken: "fake-token",
    subscription: null,
    exp: 9999999999,
  },
  loading: false,
  login: jest.fn(),
  logout: jest.fn(),
  updateCompany: jest.fn(),
  selectedStoreId: "store-1",
  setSelectedStore: jest.fn(),
  inventories: [],
  refreshInventories: jest.fn(),
  hasPermission: jest.fn().mockReturnValue(true),
};

function makeOrderHeader(overrides: Partial<OrderHeader> = {}): OrderHeader {
  return {
    id: "order-1",
    receiptType: "BOLETA",
    orderType: "VENTA",
    orderNumber: "ORD-001",
    storeId: "store-1",
    customer: {
      id: "client-1",
      companyId: "company-1",
      fullName: "Juan Pérez",
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
    // Default 'PREPARADO': no está en la denylist
    // (PAGOS_PENDIENTES_EXCLUDED_STATUSES), así que por defecto la orden entra
    // en "Pagos Pendientes" y no interfiere con el resto de asserts. Los tests
    // que prueban el filtro de status pasan su propio `status` via overrides.
    status: "PREPARADO",
    salesRegion: "LIMA",
    cancellationReason: null,
    notes: null,
    items: [],
    payments: [
      {
        id: "payment-1",
        paymentMethod: "EFECTIVO",
        amount: "100.00",
        externalReference: null,
        paymentProofUrl: null,
        status: "PENDING",
        notes: null,
        paymentDate: "2026-08-01T00:00:00.000Z",
        created_at: "2026-08-01T00:00:00.000Z",
        updated_at: "2026-08-01T00:00:00.000Z",
      },
    ],
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  scopedStoreIds = ["store-1"];
  mockSearch = "";
  crmAllowed = true;
  mockUseAuth.mockReturnValue(
    MOCK_AUTH as unknown as ReturnType<typeof useAuth>,
  );
});

const liveOrder = (overrides: Partial<OrderHeader> = {}) =>
  makeOrderHeader({
    id: "order-live",
    orderNumber: "ORD-153866",
    externalSource: "POWIP_LIVE",
    closingChannel: "TIKTOK",
    currency: "PEN",
    grandTotal: "199.00",
    customer: { ...makeOrderHeader().customer, fullName: "Rosa Quispe" },
    payments: [
      {
        ...makeOrderHeader().payments[0],
        paymentMethod: "YAPE",
        amount: "199.00",
      },
    ],
    ...overrides,
  } as Partial<OrderHeader>);
const manualOrder = () =>
  makeOrderHeader({
    id: "order-manual",
    orderNumber: "ORD-153900",
    customer: { ...makeOrderHeader().customer, fullName: "Juan Manual" },
  });
const review = {
  checkoutId: "checkout-1",
  orderId: "order-live",
  orderNumber: "ORD-153866",
  status: "PENDING",
  method: "yape",
  quote: { subtotal: 191, shipping: 8, total: 199 },
  customer: { name: "Rosa Quispe", phone: "987654321" },
  createdAt: "2026-11-24T12:00:00Z",
  manualPayment: {
    status: "UNDER_REVIEW",
    operationNumber: "01234567",
    reviewDeadlineAt: "2026-11-24T10:00:00Z",
    overdue: true,
    hasProof: false,
  },
};
// Acceso al CRM de la empresa: sin él, Finanzas no pide la cola del CRM ni muestra «CRM · Pau».
let crmAllowed = true;
function mockQueue(orders: OrderHeader[], reviews: unknown[] = []) {
  mockedAxios.get.mockImplementation((url: string) => {
    if (url.includes("/crm/access"))
      return Promise.resolve({ data: { allowed: crmAllowed, level: null, crm: crmAllowed, pau: crmAllowed, until: null, source: null } });
    if (url.includes("/yape/reviews"))
      return Promise.resolve({
        data: { reviews, serverNow: "2026-11-24T12:00:00Z" },
      });
    if (url.includes("/leads-cod")) return Promise.resolve({ data: [] });
    if (url.includes("/order-header/store/"))
      return Promise.resolve({ data: orders });
    if (url.includes("/shipping-guides/store/"))
      return Promise.resolve({ data: [] });
    return Promise.reject(new Error(`URL no mockeada en el test: ${url}`));
  });
}
const asReviewer = () =>
  mockUseAuth.mockReturnValue({
    ...MOCK_AUTH,
    auth: {
      ...MOCK_AUTH.auth,
      user: {
        ...MOCK_AUTH.auth.user,
        role: "FINANZAS",
        permissions: ["VIEW_FINANCES", "APPROVE_PAYMENTS"],
      },
    },
  } as unknown as ReturnType<typeof useAuth>);
const rowOf = (orderNumber: string) =>
  screen.getByText(orderNumber).closest("tr") as HTMLElement;

describe("Finanzas › Pagos por validar (FEAT-33 B1)", () => {
  it("is one queue: no separate POWIP Live tab", async () => {
    mockQueue([liveOrder(), manualOrder()]);
    render(<FinanzasPage />);
    expect(
      await screen.findByRole("tab", { name: "Pagos por validar (2)" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.queryByRole("tab", { name: /Validación de pagos/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /Pagos Pendientes/ }),
    ).not.toBeInTheDocument();
  });

  it("filters by origin and names it on each row", async () => {
    mockQueue([
      liveOrder(),
      liveOrder({
        id: "order-link",
        orderNumber: "ORD-153870",
        closingChannel: "POWIP_LINK",
      } as Partial<OrderHeader>),
      manualOrder(),
    ]);
    render(<FinanzasPage />);
    await screen.findByText("ORD-153866");
    expect(
      within(rowOf("ORD-153866")).getByText("POWIP Live"),
    ).toBeInTheDocument();
    expect(
      within(rowOf("ORD-153870")).getByText("POWIP Link"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "POWIP Live y Link" }));
    expect(
      screen.getByRole("button", { name: "POWIP Live y Link" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("ORD-153900")).not.toBeInTheDocument();
    expect(screen.getByText("ORD-153870")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Otros orígenes" }));
    expect(screen.getByText("ORD-153900")).toBeInTheDocument();
    expect(screen.queryByText("ORD-153866")).not.toBeInTheDocument();
  });

  it("CRM · Pau: lists Pau-validated receipts, also under Todos, and the boss accepts there", async () => {
    asReviewer();
    const pauReceipt = {
      id: "rcpt-1",
      conversationId: "conv-1",
      orderId: null,
      orderNumber: null,
      quotationId: null,
      status: "porval",
      method: "YAPE",
      methodLabel: "Yape",
      amount: 129,
      operationNumber: "00123456",
      mime: "image/png",
      fileName: "yape.png",
      hasFile: true,
      destination: "local",
      coreError: null,
      uploadedByName: "Pau",
      reviewedByName: null,
      reviewNote: null,
      reviewedAt: null,
      createdAt: "2026-11-25T15:00:00Z",
      validatedBy: "pau",
      pauChecks: {
        read: { isReceipt: true, amount: 129, date: "2026-11-25", destination: "*** 321", holder: null, operationNumber: "00123456", method: "Yape" },
        expected: 129,
        isReceipt: true,
        amountMatch: true,
        dateRecent: true,
        destinationOk: true,
        operationUnique: true,
        passed: true,
        failed: [],
      },
      pauSale: { id: "sale-1", items: "2 polos negros talla M", total: 129, customerName: "Ana Pérez", district: "Surco", status: "por_validar" },
    };
    mockQueue([manualOrder()]);
    const base = mockedAxios.get.getMockImplementation()!;
    mockedAxios.get.mockImplementation((url: string, config?: { params?: Record<string, string> }) =>
      url.includes("/receipts/queue")
        ? (expect(config?.params).toEqual({ status: "porval", validatedBy: "pau" }), Promise.resolve({ data: { items: [pauReceipt] } }))
        : base(url, config),
    );
    mockedAxios.patch.mockResolvedValue({ data: { ...pauReceipt, status: "aprobado" } });
    render(<FinanzasPage />);
    expect(await screen.findByRole("tab", { name: "Pagos por validar (2)" })).toBeInTheDocument();
    // «Todos» también trae las ventas de Pau.
    expect(await screen.findByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText("ORD-153900")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "CRM · Pau" }));
    expect(screen.getByRole("button", { name: "CRM · Pau" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("ORD-153900")).not.toBeInTheDocument();
    // La venta del chat es una fila de la misma tabla, sin apartado propio.
    expect(screen.getAllByRole("table")).toHaveLength(1);
    const card = screen.getByText("Ana Pérez").closest("tr") as HTMLElement;
    expect(within(card).getByText("CRM · Pau")).toBeInTheDocument();
    expect(within(card).getByText("Validado por Pau")).toBeInTheDocument();
    expect(within(card).getByText("5 de 5 controles de Pau")).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Aceptar pago" }));
    await waitFor(() =>
      expect(mockedAxios.patch).toHaveBeenCalledWith(expect.stringContaining("/receipts/rcpt-1/review"), { approve: true }),
    );
  });

  it("without CRM access: does not ask the CRM queue, shows no CRM warning and no «CRM · Pau» filter", async () => {
    asReviewer();
    crmAllowed = false;
    mockQueue([manualOrder()]);
    render(<FinanzasPage />);
    expect(await screen.findByText("ORD-153900")).toBeInTheDocument();
    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining("/crm/access")),
    );
    expect(mockedAxios.get).not.toHaveBeenCalledWith(expect.stringContaining("/receipts/queue"), expect.anything());
    expect(screen.queryByText("No se pudieron cargar los comprobantes del CRM.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "CRM · Pau" })).not.toBeInTheDocument();
  });

  it("with CRM access: a failed CRM queue shows the warning", async () => {
    asReviewer();
    mockQueue([manualOrder()]);
    render(<FinanzasPage />);
    expect(await screen.findByText("No se pudieron cargar los comprobantes del CRM.")).toBeInTheDocument();
  });

  it("CRM · Pau: rejecting sends the reason", async () => {
    asReviewer();
    mockQueue([]);
    const base = mockedAxios.get.getMockImplementation()!;
    mockedAxios.get.mockImplementation((url: string, config?: unknown) =>
      url.includes("/receipts/queue")
        ? Promise.resolve({ data: { items: [{ id: "rcpt-2", amount: 129, methodLabel: "Yape", hasFile: false, operationNumber: null, pauChecks: null, pauSale: null, validatedBy: "pau" }] } })
        : base(url, config),
    );
    mockedAxios.patch.mockResolvedValue({ data: {} });
    mockSearch = "origen=pau";
    render(<FinanzasPage />);
    const card = (await screen.findByText("Cliente del chat")).closest("tr") as HTMLElement;
    fireEvent.click(within(card).getByRole("button", { name: "Rechazar" }));
    const dialog = await screen.findByRole("dialog", { name: "Rechazar comprobante" });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Monto distinto" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Rechazar y avisar" }));
    await waitFor(() =>
      expect(mockedAxios.patch).toHaveBeenCalledWith(expect.stringContaining("/receipts/rcpt-2/review"), { approve: false, reason: "monto" }),
    );
  });

  it("a chat sale with its order and its CRM receipt is one row and counts once", async () => {
    asReviewer();
    const pauOrder = makeOrderHeader({
      id: "order-pau",
      orderNumber: "ORD-000012",
      externalSource: "crm_pau",
      status: "INCOMPLETE",
    } as Partial<OrderHeader>);
    mockQueue([pauOrder, manualOrder()]);
    const base = mockedAxios.get.getMockImplementation()!;
    mockedAxios.get.mockImplementation((url: string, config?: unknown) =>
      url.includes("/receipts/queue")
        ? Promise.resolve({ data: { items: [{ id: "rcpt-3", orderId: "order-pau", amount: 100, methodLabel: "Yape", hasFile: false, pauChecks: null, pauSale: null, validatedBy: "pau" }] } })
        : base(url, config),
    );
    render(<FinanzasPage />);
    expect(await screen.findByRole("tab", { name: "Pagos por validar (2)" })).toBeInTheDocument();
    expect(await screen.findByText("Validado por Pau")).toBeInTheDocument();
    expect(screen.getAllByText("ORD-000012")).toHaveLength(1);
    expect(within(rowOf("ORD-000012")).getByText("CRM · Pau")).toBeInTheDocument();
    // Con pedido en el Core, el pago de Pau se aprueba en «Gestionar Pagos» (el modal lo manda al CRM, 4b34f994);
    // «Aceptar pago» en la fila queda solo para el comprobante de Pau sin pedido.
    expect(within(rowOf("ORD-000012")).getByRole("button", { name: /Gestionar Pagos/ })).toBeInTheDocument();
    expect(within(rowOf("ORD-000012")).queryByRole("button", { name: "Aceptar pago" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Otros orígenes" }));
    expect(screen.queryByText("ORD-000012")).not.toBeInTheDocument();
    expect(screen.getByText("ORD-153900")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "CRM · Pau" }));
    expect(screen.getByText("ORD-000012")).toBeInTheDocument();
    expect(screen.queryByText("ORD-153900")).not.toBeInTheDocument();
  });

  it("opens already filtered from the Live console link", async () => {
    mockSearch = "tab=pagos&origen=live";
    mockQueue([liveOrder(), manualOrder()]);
    render(<FinanzasPage />);
    await screen.findByText("ORD-153866");
    expect(
      screen.getByRole("button", { name: "POWIP Live y Link" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("ORD-153900")).not.toBeInTheDocument();
  });

  it("a Live row shows the operation and the overdue deadline, and validates with the Yape validator", async () => {
    asReviewer();
    mockQueue([liveOrder(), manualOrder()], [review]);
    render(<FinanzasPage />);
    await screen.findByText("Operación 01234567");
    const live = rowOf("ORD-153866");
    expect(
      within(live).getByText("Plazo vencido · requiere una decisión"),
    ).toBeInTheDocument();
    expect(
      within(rowOf("ORD-153900")).getByRole("button", {
        name: /Gestionar Pagos/,
      }),
    ).toBeInTheDocument();
    expect(
      within(rowOf("ORD-153900")).queryByRole("button", {
        name: "Revisar y validar",
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      within(live).getByRole("button", { name: "Revisar y validar" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Validar pago Yape" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    fireEvent.click(
      within(rowOf("ORD-153866")).getByRole("button", {
        name: "Rechazar comprobante",
      }),
    );
    expect(
      await screen.findByLabelText("Motivo del rechazo"),
    ).toBeInTheDocument();
  });

  it("asks for the Live queue only when the user can validate", async () => {
    mockQueue([liveOrder()]);
    render(<FinanzasPage />);
    await screen.findByText("ORD-153866");
    expect(mockedAxios.get).not.toHaveBeenCalledWith(
      expect.stringContaining("/yape/reviews"),
      expect.anything(),
    );
  });
});
