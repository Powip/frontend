import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as tools from "@/services/crmSalesToolsService";
import VentasView from "@/components/ventas-chat/VentasView";
import type { SalesBoardRow } from "@/types/crmSalesTools";

const access = { isAdmin: true };
jest.mock("@/hooks/useCrmMe", () => ({ useCrmMe: () => access }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      accessToken: "t",
      user: { id: "u1", name: "Jairo", surname: "R" },
      company: { id: "co1", stores: [{ id: "st1", name: "Kunca COD" }] },
    },
  }),
}));
jest.mock("@/hooks/usePdfDownload", () => ({ usePdfDownload: () => jest.fn() }));
jest.mock("@/components/modals/ImportSalesModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/services/crmSalesToolsService", () => ({
  ...jest.requireActual("@/services/crmSalesToolsService"),
  getSalesBoard: jest.fn(),
  refreshQuote: jest.fn(),
}));
const t = tools as jest.Mocked<typeof tools>;

const row = (over: Partial<SalesBoardRow> = {}): SalesBoardRow => ({
  kind: "order",
  id: "o1",
  coreId: "core-1",
  number: "PED-1",
  conversationId: "c1",
  contactName: "Ana",
  channel: "whatsapp",
  sellerId: "u1",
  sellerName: "Rosa",
  status: null,
  total: 100,
  paid: 30,
  publicUrl: null,
  orderId: "o1",
  createdAt: "2026-11-20T15:00:00.000Z",
  bucket: "pending",
  ...over,
});

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <VentasView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  access.isAdmin = true;
  t.getSalesBoard.mockImplementation(async (status) =>
    status === "all"
      ? [row(), row({ id: "o2", bucket: "pending" }), row({ id: "o3", bucket: "cancelled" }), row({ id: "o4", bucket: "done" })]
      : [row()],
  );
});

describe("Ventas · mockup 152 (V1, V3, V4, R5)", () => {
  it("muestra contadores por pestaña, origen y saldo", async () => {
    wrap();
    expect(await screen.findByTestId("count-pending")).toHaveTextContent("2");
    expect(screen.getByTestId("count-cancelled")).toHaveTextContent("1");
    expect(screen.getByTestId("count-all")).toHaveTextContent("4");
    expect((await screen.findAllByText("WhatsApp")).some((el) => el.tagName === "TD")).toBe(true);
    expect(screen.getByTestId("row-balance")).toHaveTextContent("S/ 70.00");
  });

  it("el administrador importa Excel a la tienda", async () => {
    wrap();
    expect(await screen.findByRole("button", { name: /Importar Excel a Kunca COD/ })).toBeInTheDocument();
  });

  it("R5: la vendedora no ve Importar Excel", async () => {
    access.isAdmin = false;
    wrap();
    await screen.findByTestId("count-pending");
    expect(screen.queryByRole("button", { name: /Importar Excel/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Nueva venta/ })).toBeInTheDocument();
  });
});
