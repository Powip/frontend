import { render, screen, waitFor, within } from "@testing-library/react";
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
  getShalomLabelPdfUrl: jest.fn(),
  getShalomTicketPdfUrl: jest.fn(),
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
    auth: { accessToken: "token", company: { id: "company-1" } },
    selectedStoreId: "store-1",
  }),
}));

jest.mock("axios", () => {
  const get = jest.fn();
  return { __esModule: true, default: { get, patch: jest.fn() }, get };
});

import axios from "axios";
import CourierTrackingView from "../CourierTrackingView";

const mockedGet = (axios as unknown as { get: jest.Mock }).get;

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
