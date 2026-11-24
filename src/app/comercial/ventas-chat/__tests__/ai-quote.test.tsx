import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PedidoLinkSection from "@/components/ventas-chat/PedidoLinkSection";
import { quoteMessage } from "@/components/ventas-chat/quotes";
import * as crm from "@/services/crmService";
import * as panel from "@/services/crmOrderPanelService";
import type { Conversation, ConversationQuote } from "@/types/crm";
import type { AiCartResult, StorePolicy } from "@/types/crmOrderPanel";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/comercial/ventas-chat/bandeja",
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
const toastMock = { error: jest.fn(), success: jest.fn(), info: jest.fn() };
jest.mock("sonner", () => ({
  toast: {
    error: (m: string) => toastMock.error(m),
    success: (m: string) => toastMock.success(m),
    info: (m: string) => toastMock.info(m),
  },
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { company: { id: "co1", stores: [{ id: "st1", name: "Tienda Centro" }] } },
    selectedStoreId: "st1",
  }),
}));
jest.mock("@/hooks/useCrmMe", () => ({
  useCrmMe: () => ({
    level: "agent",
    isAdmin: false,
    isSupervisor: false,
    stores: [{ id: "st1", name: "Tienda Centro" }],
    fromServer: true,
  }),
}));
jest.mock("@/services/crmService", () => ({
  ...jest.requireActual("@/services/crmService"),
  getCrmSalesInventories: jest.fn(),
  getCrmSalesCatalog: jest.fn(),
  createChatQuote: jest.fn(),
  listConversationQuotes: jest.fn(),
  linkConversationQuote: jest.fn(),
  listConversationOrders: jest.fn(),
}));
jest.mock("@/services/crmOrderPanelService", () => ({
  getStorePolicy: jest.fn(),
  buildAiCart: jest.fn(),
  evaluatePromos: jest.fn(),
  listDiscountRequests: jest.fn(),
}));
const c = crm as jest.Mocked<typeof crm>;
const p = panel as jest.Mocked<typeof panel>;

const URL_LINK = "https://app.powip.test/c/tok";
const POLICY = {
  storeId: "st1",
  saved: true,
  shipCharge: 10,
  firstOffer: "dep",
  depositEnabled: true,
  depositAmount: 20,
  codFull: false,
  codAsk: "confirm",
  discountCap: 10,
  promoText: "",
  quantityPromos: [],
} as StorePolicy;

const reading = (over: Partial<AiCartResult> = {}, stock = 5) =>
  ({
    source: "ai",
    model: "m",
    warning: null,
    storeId: "st1",
    lines: [
      {
        productVariantId: "v1",
        name: "Polo básico",
        variant: "M · Negro",
        sku: "POL-M-N",
        quantity: 2,
        unitPrice: 50,
        stockAvailable: stock,
        evidence: "quiero dos en M",
      },
    ],
    ...over,
  }) as AiCartResult;

const created = {
  id: "l1",
  conversationId: "c1",
  quotationId: "q1",
  quotationNumber: "COT-0001",
  publicUrl: URL_LINK,
  createdByName: "Laura",
  createdAt: "2026-11-24T10:00:00.000Z",
} as ConversationQuote;

const inventory = (id: string) => ({ id, name: `Almacén ${id}`, isActive: true });

function setup(over: Partial<Conversation> = {}) {
  const conversation = {
    id: "c1",
    channel: "whatsapp",
    contactPhone: "51999111222",
    customerPhone: null,
    contactName: "Ana Pérez",
    ...over,
  } as unknown as Conversation;
  const onInsertMessage = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PedidoLinkSection conversation={conversation} client={null} onInsertMessage={onInsertMessage} />
    </QueryClientProvider>,
  );
  return { onInsertMessage };
}

async function quoteFromChat() {
  const button = await screen.findByRole("button", { name: "Armar pedido leyendo el chat" });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}

beforeAll(() => {
  global.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  jest.clearAllMocks();
  c.listConversationQuotes.mockResolvedValue([]);
  c.listConversationOrders.mockResolvedValue([]);
  c.getCrmSalesInventories.mockResolvedValue([inventory("inv1")] as never);
  c.getCrmSalesCatalog.mockResolvedValue([]);
  c.createChatQuote.mockReset().mockResolvedValue(created as never);
  c.linkConversationQuote.mockReset();
  p.getStorePolicy.mockResolvedValue(POLICY);
  p.listDiscountRequests.mockResolvedValue([]);
  p.evaluatePromos.mockResolvedValue({ suggestions: [], combos: [] } as never);
  p.buildAiCart.mockReset().mockResolvedValue(reading());
});

describe("Cierre automático «solo cotizar»", () => {
  it("un clic lee el chat, crea el POWIP Link y lo deja en la caja sin abrir el formulario", async () => {
    const { onInsertMessage } = setup();
    await quoteFromChat();
    await waitFor(() => expect(onInsertMessage).toHaveBeenCalledWith(quoteMessage(URL_LINK)));
    expect(p.buildAiCart).toHaveBeenCalledWith("c1", { storeId: "st1", inventoryId: "inv1" });
    expect(c.createChatQuote).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        storeId: "st1",
        inventoryId: "inv1",
        customerName: "Ana Pérez",
        customerPhone: "999111222",
        paymentType: "ADELANTO",
        suggestedDeposit: 20,
        lines: [expect.objectContaining({ productVariantId: "v1", quantity: 2, unitPrice: 50 })],
      }),
    );
    expect(toastMock.info).toHaveBeenCalledWith("Chat leído con IA.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("dice «reglas» y muestra el aviso cuando no leyó la IA", async () => {
    p.buildAiCart.mockResolvedValue(reading({ source: "mock", warning: "Revisa la talla." }));
    const { onInsertMessage } = setup();
    await quoteFromChat();
    await waitFor(() => expect(onInsertMessage).toHaveBeenCalled());
    expect(toastMock.info).toHaveBeenCalledWith("Chat leído con reglas. Revisa la talla.");
  });

  it("sin stock abre el formulario con lo leído, no cotiza y no vuelve a leer el chat", async () => {
    p.buildAiCart.mockResolvedValue(reading({}, 1));
    setup();
    await quoteFromChat();
    const dialog = within(await screen.findByRole("dialog"));
    expect((await dialog.findAllByText(/Polo básico/)).length).toBeGreaterThan(0);
    expect(toastMock.info).toHaveBeenCalledWith(expect.stringMatching(/IA\. Hay productos sin stock/));
    expect(c.createChatQuote).not.toHaveBeenCalled();
    expect(p.buildAiCart).toHaveBeenCalledTimes(1);
  });

  it("con dos almacenes pide elegir uno y recién ahí lee el chat", async () => {
    c.getCrmSalesInventories.mockResolvedValue([inventory("inv1"), inventory("inv2")] as never);
    setup();
    await quoteFromChat();
    const dialog = within(await screen.findByRole("dialog"));
    const select = dialog.getByLabelText("Almacén");
    await waitFor(() => expect(select).toBeEnabled());
    expect(p.buildAiCart).not.toHaveBeenCalled();
    fireEvent.change(select, { target: { value: "inv2" } });
    await waitFor(() =>
      expect(p.buildAiCart).toHaveBeenCalledWith("c1", { storeId: "st1", inventoryId: "inv2" }),
    );
  });

  it("sin teléfono avisa y no crea nada", async () => {
    setup({ channel: "instagram", contactPhone: null } as never);
    await quoteFromChat();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(toastMock.info).toHaveBeenCalledWith("Guarda el teléfono del cliente antes de armar el pedido.");
    expect(c.createChatQuote).not.toHaveBeenCalled();
  });

  it("si la lectura falla abre el formulario vacío y no insiste con la IA", async () => {
    p.buildAiCart.mockRejectedValue(new Error("sin servicio"));
    setup();
    await quoteFromChat();
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await waitFor(() => expect(toastMock.info).toHaveBeenCalled());
    expect(p.buildAiCart).toHaveBeenCalledTimes(1);
    expect(c.createChatQuote).not.toHaveBeenCalled();
  });

  it("si la cotización se creó pero no se vinculó, el segundo clic solo vincula", async () => {
    c.createChatQuote.mockRejectedValue({
      response: {
        data: {
          code: "QUOTE_CREATED_NOT_LINKED",
          quotationId: "q1",
          quotationNumber: "COT-0001",
          publicUrl: URL_LINK,
          message: "sin vínculo",
        },
      },
    });
    c.linkConversationQuote.mockResolvedValue(created as never);
    const { onInsertMessage } = setup();
    await quoteFromChat();
    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith(expect.stringContaining("COT-0001 se creó")));
    expect(onInsertMessage).not.toHaveBeenCalled();
    await quoteFromChat();
    await waitFor(() => expect(onInsertMessage).toHaveBeenCalledWith(quoteMessage(URL_LINK)));
    expect(c.createChatQuote).toHaveBeenCalledTimes(1);
    expect(p.buildAiCart).toHaveBeenCalledTimes(1);
  });
});
