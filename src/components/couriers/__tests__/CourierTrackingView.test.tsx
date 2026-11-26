import { render as renderRTL, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("xlsx", () => ({
  utils: {
    json_to_sheet: jest.fn(() => ({})),
    book_new: jest.fn(() => ({})),
    book_append_sheet: jest.fn(),
  },
  write: jest.fn(() => new ArrayBuffer(0)),
}));

jest.mock("file-saver", () => ({ saveAs: jest.fn() }));

jest.mock(
  "lucide-react",
  () =>
    new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === "__esModule") return true;
          return () => null;
        },
      },
    ),
);

jest.mock("sonner", () => ({
  toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

jest.mock("@/components/ui/calendar", () => ({ Calendar: () => null }));

jest.mock("@/components/ui/pagination", () => ({ Pagination: () => null }));

jest.mock("@/components/modals/CustomerServiceModal", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/modals/ShalomDocumentModal", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/tracking/ShalomOrderTrackingView", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/tracking/AliclikOrderTrackingView", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/tracking/EvaOrderTrackingView", () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock("@/components/couriers/OlvaOrderTrackingView", () => ({
  __esModule: true,
  default: ({ orders }: { orders: { orderNumber: string }[] }) => (
    <div data-testid="olva-tracking-panel">{orders.map((o) => o.orderNumber).join(",")}</div>
  ),
}));

jest.mock("@/components/tracking/useShalomLiveStatus", () => ({
  useShalomLiveStatuses: () => ({
    liveStatuses: {},
    loadingLiveStatuses: false,
  }),
  SHALOM_STEP_STYLES: {},
  SHALOM_STEP_ICONS: {},
}));

jest.mock("@/services/shalomService", () => ({
  getShalomConfig: jest.fn(() => Promise.resolve(null)),
  quoteShalom: jest.fn(),
  trackShalomGuide: jest.fn(),
  updateGuideQuote: jest.fn(),
}));

jest.mock("@/services/evaService", () => ({
  getEvaCredentials: jest.fn(() => Promise.resolve(null)),
}));

jest.mock("@/services/aliclikService", () => ({
  getAliclikCredentials: jest.fn(() => Promise.resolve(null)),
}));

jest.mock("@/services/courierService", () => ({
  fetchCouriers: jest.fn(() => Promise.resolve([{ name: "Olva" }])),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      accessToken: "token",
      user: { id: "user-1" },
      company: { id: "company-1", stores: [{ id: "store-1", name: "Tienda Test" }] },
    },
    selectedStoreId: "store-1",
  }),
}));

jest.mock("axios", () => {
  const get = jest.fn();
  return { __esModule: true, default: { get, patch: jest.fn() }, get };
});

import axios from "axios";
import { fetchCouriers } from "@/services/courierService";
import CourierTrackingView from "../CourierTrackingView";

const mockedGet = (axios as unknown as { get: jest.Mock }).get;
const mockedPatch = (axios as unknown as { patch: jest.Mock }).patch;

function order(id: string, orderNumber: string, createdAt: string, updatedAt: string) {
  return {
    id,
    orderNumber,
    status: "EN_ENVIO",
    courier: "Olva",
    guideNumber: `G-${id}`,
    deliveryType: "DOMICILIO",
    created_at: createdAt,
    updated_at: updatedAt,
    grandTotal: 0,
    payments: [],
    items: [],
    customer: { fullName: `Cliente ${orderNumber}` },
  };
}

const orders = [
  order("o-old-sale", "PED-VENTA-ANTIGUA", "2026-09-01T12:00:00", "2026-09-25T12:00:00"),
  order("o-mid-sale", "PED-VENTA-MEDIA", "2026-09-10T12:00:00", "2026-09-26T12:00:00"),
  order("o-new-sale", "PED-VENTA-RECIENTE", "2026-09-15T12:00:00", "2026-09-11T12:00:00"),
];

const guides = [
  {
    id: "g-1",
    guideNumber: "G-1",
    courierName: "Olva",
    status: "EN_TRANSITO",
    created_at: "2026-09-20T12:00:00",
    orders: [{ id: "o-old-sale", orderNumber: "PED-VENTA-ANTIGUA", customerName: "" }],
  },
  {
    id: "g-2",
    guideNumber: "G-2",
    courierName: "Olva",
    status: "EN_TRANSITO",
    created_at: "2026-09-12T12:00:00",
    orders: [{ id: "o-mid-sale", orderNumber: "PED-VENTA-MEDIA", customerName: "" }],
  },
];

const EXPECTED_ORDER = ["PED-VENTA-ANTIGUA", "PED-VENTA-MEDIA", "PED-VENTA-RECIENTE"];

function renderedOrderNumbers(): string[] {
  const panel = screen.getByRole("tabpanel");
  return within(panel)
    .getAllByRole("row")
    .map((row) => within(row).queryAllByRole("cell")[0]?.textContent ?? "")
    .filter((text) => text.startsWith("PED-"));
}

beforeEach(() => {
  mockedPatch.mockReset();
  mockedPatch.mockResolvedValue({ data: {} });
  mockedGet.mockReset();
  mockedGet.mockImplementation((url: string) => {
    if (url.includes("/shipping-guides/store/")) {
      return Promise.resolve({ data: guides });
    }
    if (url.includes("/order-header/store/")) {
      return Promise.resolve({ data: orders });
    }
    return Promise.resolve({ data: [] });
  });
});

describe("CourierTrackingView — orden por fecha de despacho", () => {
  it("ordena la tabla «Todos» por fecha de despacho descendente, no por fecha de venta", async () => {
    render(<CourierTrackingView />);

    await waitFor(() => {
      expect(renderedOrderNumbers()).toHaveLength(3);
    });

    expect(renderedOrderNumbers()).toEqual(EXPECTED_ORDER);
  });

  it("ordena la pestaña individual del courier por fecha de despacho descendente", async () => {
    const user = userEvent.setup();
    render(<CourierTrackingView />);

    const olvaTab = await screen.findByRole("tab", { name: "Olva" });
    await user.click(olvaTab);

    await waitFor(() => {
      expect(screen.getByRole("tabpanel")).toHaveTextContent("PED-VENTA-RECIENTE");
    });
    expect(olvaTab).toHaveAttribute("aria-selected", "true");

    expect(renderedOrderNumbers()).toEqual(EXPECTED_ORDER);
  });
});

describe("CourierTrackingView — costo de envío editable", () => {
  const costInput = (orderNumber: string) =>
    screen.getByRole("textbox", { name: `Costo de envío del pedido ${orderNumber}` }) as HTMLInputElement;

  it("permite cargar el costo desde la tabla «Todos» y lo guarda solo en esa venta", async () => {
    const user = userEvent.setup();
    render(<CourierTrackingView />);
    await waitFor(() => expect(renderedOrderNumbers()).toHaveLength(3));

    await user.type(costInput("PED-VENTA-MEDIA"), "12.5");
    await user.tab();

    await waitFor(() => expect(mockedPatch).toHaveBeenCalledTimes(1));
    expect(mockedPatch).toHaveBeenCalledWith(expect.stringMatching(/\/order-header\/o-mid-sale$/), {
      carrierShippingCost: 12.5,
    });
    expect(costInput("PED-VENTA-ANTIGUA").value).toBe("");
    expect(costInput("PED-VENTA-RECIENTE").value).toBe("");
  });

  it("el costo cargado en «Todos» aparece también en la pestaña del courier", async () => {
    const user = userEvent.setup();
    render(<CourierTrackingView />);
    await waitFor(() => expect(renderedOrderNumbers()).toHaveLength(3));

    await user.type(costInput("PED-VENTA-MEDIA"), "12.5");
    await user.tab();
    await waitFor(() => expect(mockedPatch).toHaveBeenCalledTimes(1));

    await user.click(await screen.findByRole("tab", { name: "Olva" }));
    await waitFor(() => expect(screen.getByRole("tabpanel")).toHaveTextContent("PED-VENTA-MEDIA"));

    expect(costInput("PED-VENTA-MEDIA").value).toBe("12.50");
  });

  it("permite cargar el costo desde la pestaña del courier y se ve en «Todos»", async () => {
    const user = userEvent.setup();
    render(<CourierTrackingView />);

    await user.click(await screen.findByRole("tab", { name: "Olva" }));
    await waitFor(() => expect(screen.getByRole("tabpanel")).toHaveTextContent("PED-VENTA-RECIENTE"));

    await user.type(costInput("PED-VENTA-RECIENTE"), "9");
    await user.tab();
    await waitFor(() => expect(mockedPatch).toHaveBeenCalledTimes(1));
    expect(mockedPatch).toHaveBeenCalledWith(expect.stringMatching(/\/order-header\/o-new-sale$/), {
      carrierShippingCost: 9,
    });

    await user.click(screen.getByRole("tab", { name: "Todos" }));
    await waitFor(() => expect(renderedOrderNumbers()).toHaveLength(3));

    expect(costInput("PED-VENTA-RECIENTE").value).toBe("9.00");
  });
});

describe("CourierTrackingView — N° externo (FEAT-31)", () => {
  const withExternal = [
    { ...order("o-ext", "PED-EXT", "2026-09-15T12:00:00", "2026-09-26T12:00:00"), externalOrderNumber: "AGPE923190" },
    order("o-plain", "PED-PLAIN", "2026-09-10T12:00:00", "2026-09-25T12:00:00"),
  ];

  function serve(list: unknown[]) {
    mockedGet.mockImplementation((url: string) => {
      if (url.includes("/shipping-guides/store/")) return Promise.resolve({ data: [] });
      if (url.includes("/order-header/store/")) return Promise.resolve({ data: list });
      return Promise.resolve({ data: [] });
    });
  }

  it("con un pedido que trae N° externo muestra la columna junto a N° Pedido", async () => {
    serve(withExternal);
    render(<CourierTrackingView />);
    await waitFor(() => expect(renderedOrderNumbers()).toHaveLength(2));

    const panel = within(screen.getByRole("tabpanel"));
    const headers = panel.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers.slice(0, 2)).toEqual(["N° Pedido", "N° Externo"]);
    expect(panel.getByText("AGPE923190")).toBeInTheDocument();
  });

  it("un N° externo largo se recorta al ancho de la columna fija, en «Todos» y en la pestaña del courier", async () => {
    const user = userEvent.setup();
    serve([{ ...order("o-ext", "PED-EXT", "2026-09-15T12:00:00", "2026-09-26T12:00:00"), externalOrderNumber: "PEDIDO-WEB-000123" }]);
    render(<CourierTrackingView />);
    await waitFor(() => expect(renderedOrderNumbers()).toHaveLength(1));

    // jsdom no calcula layout: se fijan las clases que evitan correr las columnas fijas siguientes.
    expect(screen.getByText("PEDIDO-WEB-000123").closest("td")).toHaveClass("truncate", "max-w-28");

    await user.click(await screen.findByRole("tab", { name: "Olva" }));
    await waitFor(() => expect(screen.getByRole("tabpanel")).toHaveTextContent("PED-EXT"));
    expect(screen.getByText("PEDIDO-WEB-000123").closest("td")).toHaveClass("truncate", "max-w-28");
  });

  it("sin ningún N° externo no dibuja la columna", async () => {
    render(<CourierTrackingView />);
    await waitFor(() => expect(renderedOrderNumbers()).toHaveLength(3));

    expect(within(screen.getByRole("tabpanel")).queryByRole("columnheader", { name: "N° Externo" })).not.toBeInTheDocument();
  });

  it("la pestaña de un courier también muestra la columna y busca por N° externo", async () => {
    const user = userEvent.setup();
    serve(withExternal);
    render(<CourierTrackingView />);

    await user.click(await screen.findByRole("tab", { name: "Olva" }));
    await waitFor(() => expect(screen.getByRole("tabpanel")).toHaveTextContent("PED-EXT"));

    const panel = within(screen.getByRole("tabpanel"));
    expect(panel.getAllByRole("columnheader").map((h) => h.textContent).slice(0, 2)).toEqual(["N° Pedido", "N° Externo"]);
    expect(panel.getByText("AGPE923190")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Buscar por pedido, N° externo o cliente..."), "AGPE");
    await waitFor(() => expect(renderedOrderNumbers()).toEqual(["PED-EXT"]));
  });

  it("la búsqueda encuentra el pedido por su N° externo", async () => {
    const user = userEvent.setup();
    serve(withExternal);
    render(<CourierTrackingView />);
    await waitFor(() => expect(renderedOrderNumbers()).toHaveLength(2));

    await user.type(screen.getByPlaceholderText("Buscar por pedido, N° externo, cliente o courier..."), "AGPE");

    await waitFor(() => expect(renderedOrderNumbers()).toEqual(["PED-EXT"]));
  });
});

// Exercise the shared business query with an isolated cache per render.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
jest.mock("@/lib/axiosAuth", () => { const mod = jest.requireMock("axios"); return { __esModule: true, default: mod.__esModule ? mod.default : mod }; });
jest.mock("@/contexts/BusinessScopeContext", () => ({
  useBusinessScope: () => {
    const { auth, selectedStoreId } = jest.requireMock("@/contexts/AuthContext").useAuth();
    const storeIds = auth?.company?.stores?.length ? auth.company.stores.map((store: { id: string }) => store.id) : selectedStoreId ? [selectedStoreId] : [];
    return { storeIds, scope: "business", canFetch: !!auth?.accessToken && storeIds.length > 0 };
  },
}));
function render(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return renderRTL(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

jest.mock("@/components/modals/PaymentVerificationModal", () => ({
  __esModule: true,
  default: ({ orderNumber, onPaymentUpdated }: { orderNumber: string; onPaymentUpdated?: () => void }) => {
    const React = jest.requireActual("react");
    return React.createElement(
      "div",
      { role: "dialog", "aria-label": `Pagos ${orderNumber}` },
      React.createElement("button", { onClick: onPaymentUpdated }, "simular comprobante subido"),
    );
  },
}));

describe("CourierTrackingView — columna Clave según saldo y comprobante", () => {
  const keyInput = (orderNumber: string) =>
    screen.getAllByLabelText(`Clave del pedido ${orderNumber}`)[0] as HTMLInputElement;
  const lockedKey = (orderNumber: string) =>
    screen.queryAllByLabelText(`Clave bloqueada del pedido ${orderNumber}: saldo pendiente. Subir comprobante`)[0];

  function useOrders(list: unknown[]) {
    mockedGet.mockImplementation((url: string) => {
      if (url.includes("/shipping-guides/store/")) return Promise.resolve({ data: guides });
      if (url.includes("/order-header/store/")) return Promise.resolve({ data: list });
      return Promise.resolve({ data: [] });
    });
  }
  const base = (id: string, num: string) => order(id, num, "2026-09-10T12:00:00", "2026-09-26T12:00:00");

  it("con saldo y sin comprobante la clave queda bloqueada y su valor no está en el DOM", async () => {
    useOrders([{ ...base("o-debt", "PED-CON-SALDO"), grandTotal: 45, shippingKey: "7391" }]);
    render(<CourierTrackingView />);
    await waitFor(() => expect(renderedOrderNumbers()).toHaveLength(1));

    expect(lockedKey("PED-CON-SALDO")).toBeTruthy();
    expect(lockedKey("PED-CON-SALDO")).toHaveTextContent("Bloqueado: saldo pendiente");
    expect(screen.queryAllByLabelText("Clave del pedido PED-CON-SALDO")).toHaveLength(0);
    expect(document.body.innerHTML).not.toContain("7391");
    expect(mockedPatch).not.toHaveBeenCalled();
  });

  it("con la clave oculta por la API (shippingKey null, hasShippingKey true) sigue bloqueada", async () => {
    useOrders([{ ...base("o-hidden", "PED-OCULTA"), grandTotal: 45, shippingKey: null, hasShippingKey: true }]);
    render(<CourierTrackingView />);
    await waitFor(() => expect(renderedOrderNumbers()).toHaveLength(1));

    expect(lockedKey("PED-OCULTA")).toHaveTextContent("Bloqueado: saldo pendiente");
    expect(screen.queryAllByLabelText("Clave del pedido PED-OCULTA")).toHaveLength(0);
    expect(mockedPatch).not.toHaveBeenCalled();
  });

  it("con saldo parcial pagado y sin comprobante sigue bloqueada", async () => {
    useOrders([
      {
        ...base("o-part", "PED-PARCIAL"),
        grandTotal: 45,
        shippingKey: "7391",
        payments: [{ id: "p1", status: "PAID", amount: 20, paymentProofUrl: null }],
      },
    ]);
    render(<CourierTrackingView />);
    await waitFor(() => expect(renderedOrderNumbers()).toHaveLength(1));

    expect(lockedKey("PED-PARCIAL")).toBeTruthy();
    expect(document.body.innerHTML).not.toContain("7391");
  });

  it("con saldo y comprobante subido la clave se ve y se edita", async () => {
    const user = userEvent.setup();
    useOrders([
      {
        ...base("o-proof", "PED-COMPROBANTE"),
        grandTotal: 45,
        shippingKey: "1111",
        payments: [{ id: "p1", status: "PENDING", amount: 45, paymentProofUrl: "https://x/voucher.png" }],
      },
    ]);
    render(<CourierTrackingView />);
    await waitFor(() => expect(renderedOrderNumbers()).toHaveLength(1));

    expect(lockedKey("PED-COMPROBANTE")).toBeUndefined();
    const input = keyInput("PED-COMPROBANTE");
    expect(input.type).toBe("text");
    expect(input.value).toBe("1111");

    await user.clear(input);
    await user.type(input, "4547");
    await user.tab();

    await waitFor(() => expect(mockedPatch).toHaveBeenCalledTimes(1));
    expect(mockedPatch).toHaveBeenCalledWith(expect.stringMatching(/\/order-header\/o-proof$/), {
      shippingKey: "4547",
    });
  });

  it("sin saldo la clave se ve en claro", async () => {
    useOrders([{ ...base("o-paid", "PED-PAGADO"), shippingKey: "4545" }]);
    render(<CourierTrackingView />);
    await waitFor(() => expect(renderedOrderNumbers()).toHaveLength(1));

    expect(lockedKey("PED-PAGADO")).toBeUndefined();
    expect(keyInput("PED-PAGADO").value).toBe("4545");
  });

  it("sin clave el campo queda en blanco, sin placeholder y editable, aun con saldo", async () => {
    const user = userEvent.setup();
    useOrders([{ ...base("o-nokey", "PED-SIN-CLAVE"), grandTotal: 45 }]);
    render(<CourierTrackingView />);
    await waitFor(() => expect(renderedOrderNumbers()).toHaveLength(1));

    expect(lockedKey("PED-SIN-CLAVE")).toBeUndefined();
    const input = keyInput("PED-SIN-CLAVE");
    expect(input.value).toBe("");
    expect(input).not.toHaveAttribute("placeholder", "Clave...");
    expect(screen.queryAllByPlaceholderText("Clave...")).toHaveLength(0);

    await user.type(input, "8821");
    await user.tab();

    await waitFor(() => expect(mockedPatch).toHaveBeenCalledTimes(1));
    expect(mockedPatch).toHaveBeenCalledWith(expect.stringMatching(/\/order-header\/o-nokey$/), {
      shippingKey: "8821",
    });
  });

  it("al subir el comprobante la clave se desbloquea", async () => {
    const user = userEvent.setup();
    const debt = { ...base("o-debt", "PED-CON-SALDO"), grandTotal: 45, shippingKey: "7391" };
    useOrders([debt]);
    render(<CourierTrackingView />);
    await waitFor(() => expect(renderedOrderNumbers()).toHaveLength(1));

    await user.click(lockedKey("PED-CON-SALDO") as HTMLElement);
    expect(screen.getByRole("dialog", { name: "Pagos PED-CON-SALDO" })).toBeInTheDocument();

    useOrders([
      { ...debt, payments: [{ id: "p1", status: "PENDING", amount: 45, paymentProofUrl: "https://x/voucher.png" }] },
    ]);
    await user.click(screen.getByRole("button", { name: "simular comprobante subido" }));

    await waitFor(() => expect(keyInput("PED-CON-SALDO").value).toBe("7391"));
    expect(lockedKey("PED-CON-SALDO")).toBeUndefined();
  });
});

describe("CourierTrackingView — Olva integrado (FEAT-35)", () => {
  const olvaOrder = {
    ...order("o-olva", "PED-OLVA-1", "2026-09-18T12:00:00", "2026-09-18T12:00:00"),
    courier: "Olva Courier",
    olvaShipmentId: "0b1f6a52-5d0e-4c8b-9c5e-3a1d2e4f5a6b",
    olvaStatus: "IN_TRANSIT",
    externalTrackingNumber: "1234567-26",
  };

  beforeEach(() => {
    (fetchCouriers as jest.Mock).mockResolvedValue([{ name: "Olva" }, { name: "Olva Courier" }]);
    mockedGet.mockImplementation((url: string) => {
      if (url.includes("/shipping-guides/store/")) return Promise.resolve({ data: guides });
      if (url.includes("/order-header/store/")) {
        return Promise.resolve({ data: [...orders, olvaOrder] });
      }
      return Promise.resolve({ data: [] });
    });
  });

  afterEach(() => {
    (fetchCouriers as jest.Mock).mockImplementation(() => Promise.resolve([{ name: "Olva" }]));
  });

  it("«Todos» muestra el estado de Olva guardado en el pedido", async () => {
    render(<CourierTrackingView />);

    await waitFor(() => expect(renderedOrderNumbers()).toContain("PED-OLVA-1"));
    const row = screen
      .getAllByRole("row")
      .find((r) => within(r).queryAllByRole("cell")[0]?.textContent === "PED-OLVA-1");
    expect(row && within(row).getByText("En tránsito")).toBeInTheDocument();
  });

  it("la pestaña de Olva Courier suma el panel de Olva con sus pedidos; la de un Olva manual no", async () => {
    const user = userEvent.setup();
    render(<CourierTrackingView />);

    await user.click(await screen.findByRole("tab", { name: "Olva Courier" }));
    expect(await screen.findByTestId("olva-tracking-panel")).toHaveTextContent("PED-OLVA-1");

    await user.click(screen.getByRole("tab", { name: "Olva" }));
    await waitFor(() =>
      expect(screen.getByRole("tabpanel")).toHaveTextContent("PED-VENTA-RECIENTE"),
    );
    expect(screen.queryByTestId("olva-tracking-panel")).not.toBeInTheDocument();
  });
});
