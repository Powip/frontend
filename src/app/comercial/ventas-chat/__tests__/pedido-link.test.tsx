import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PedidoLinkSection from "@/components/ventas-chat/PedidoLinkSection";
import { appendLine, quoteMessage } from "@/components/ventas-chat/quotes";
import * as crm from "@/services/crmService";
import * as qs from "@/services/quotationService";
import type { Conversation, ConversationQuote } from "@/types/crm";
import type { Quotation } from "@/types/quotations";

const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: jest.fn() }),
  usePathname: () => "/comercial/ventas-chat/bandeja",
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
const toastMock = { error: jest.fn(), success: jest.fn() };
jest.mock("sonner", () => ({ toast: { error: (m: string) => toastMock.error(m), success: (m: string) => toastMock.success(m) } }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { company: { id: "co1", stores: [{ id: "st1", name: "Tienda Centro" }] } },
    selectedStoreId: "st1",
  }),
}));
jest.mock("@/services/crmService", () => ({
  ...jest.requireActual("@/services/crmService"),
  listConversationQuotes: jest.fn(),
  linkConversationQuote: jest.fn(),
  listConversationOrders: jest.fn(),
  linkConversationOrder: jest.fn(),
}));
jest.mock("@/services/quotationService", () => ({
  ...jest.requireActual("@/services/quotationService"),
  createQuotation: jest.fn(),
  getQuotation: jest.fn(),
  getQuotationCatalog: jest.fn(),
  getQuotationInventories: jest.fn(),
}));
const c = crm as jest.Mocked<typeof crm>;
const q = qs as jest.Mocked<typeof qs>;

const conv = {
  id: "c1",
  channel: "whatsapp",
  contactPhone: "51999111222",
  customerPhone: null,
  contactName: "Ana Pérez",
} as unknown as Conversation;

const CATALOG = [
  {
    productVariantId: "v1",
    name: "Polo básico",
    variant: "M · Negro",
    sku: "POL-M-N",
    unitPrice: 50,
    stockAvailable: 5,
  },
  { productVariantId: "v2", name: "Gorra", unitPrice: 30, stockAvailable: 0 },
];

function quotation(over: Partial<Quotation> = {}): Quotation {
  return {
    id: "q1",
    number: "COT-0001",
    storeId: "st1",
    customerName: "Ana Pérez",
    customerPhone: "51999111222",
    status: "PREVENTA",
    paymentType: "COMPLETO",
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    lines: [],
    payments: [],
    total: 100,
    pendingBalance: 100,
    approvedDeposit: 0,
    publicToken: "tok",
    publicUrl: "https://app.powip.test/c/tok",
    customerConfirmed: false,
    createdAt: "2026-11-19T10:00:00.000Z",
    ...over,
  };
}

function link(id: string, quotationId: string, over: Partial<ConversationQuote> = {}): ConversationQuote {
  return {
    id,
    conversationId: "c1",
    quotationId,
    quotationNumber: `COT-${quotationId}`,
    publicUrl: `https://app.powip.test/c/saved-${quotationId}`,
    createdByName: "Laura",
    createdAt: "2026-11-19T10:00:00.000Z",
    ...over,
  };
}

function setup(props: { client?: never; onInsertMessage?: jest.Mock } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onInsertMessage = props.onInsertMessage ?? jest.fn();
  render(
    <QueryClientProvider client={qc}>
      <PedidoLinkSection conversation={conv} client={null} onInsertMessage={onInsertMessage} />
    </QueryClientProvider>,
  );
  return { onInsertMessage };
}

beforeEach(() => {
  jest.clearAllMocks();
  c.listConversationQuotes.mockResolvedValue([]);
  c.listConversationOrders.mockResolvedValue([]);
  q.getQuotationInventories.mockResolvedValue([{ id: "inv1", name: "Almacén 1", isActive: true }]);
  q.getQuotationCatalog.mockResolvedValue(CATALOG);
});

describe("Armar pedido (POWIP Link)", () => {
  async function openAndAdd() {
    fireEvent.click(await screen.findByRole("button", { name: /Armar pedido/ }));
    const items = await screen.findAllByTestId("catalog-item");
    expect(within(items[0]).getByText(/S\/50\.00/)).toBeInTheDocument();
    expect(within(items[0]).getByText(/Stock 5/)).toBeInTheDocument();
    expect(within(items[1]).getByText(/Sin stock/)).toBeInTheDocument();
    expect(within(items[1]).getByRole("button")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Agregar Polo básico M · Negro" }));
  }

  it("elige almacén solo, busca, cambia cantidad, guarda y deja el enlace sin enviar", async () => {
    q.createQuotation.mockResolvedValue(quotation());
    c.linkConversationQuote.mockResolvedValue(link("l1", "q1"));
    const { onInsertMessage } = setup();
    await openAndAdd();

    expect(q.getQuotationCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: "st1", inventoryId: "inv1", page: 1, limit: 30 }),
      expect.anything(),
    );
    expect(screen.getByTestId("armar-total")).toHaveTextContent("S/50.00");
    fireEvent.change(screen.getByLabelText("Cantidad Polo básico"), { target: { value: "2" } });
    expect(screen.getByTestId("armar-total")).toHaveTextContent("S/100.00");

    fireEvent.click(screen.getByRole("button", { name: /Crear POWIP Link/ }));
    await waitFor(() => expect(c.linkConversationQuote).toHaveBeenCalled());

    expect(q.createQuotation).toHaveBeenCalledTimes(1);
    expect(q.createQuotation).toHaveBeenCalledWith({
      storeId: "st1",
      inventoryId: "inv1",
      customerName: "Ana Pérez",
      customerPhone: "999111222",
      paymentType: "COMPLETO",
      suggestedDeposit: undefined,
      validityHours: 24,
      internalNote: "Armado desde el chat de ventas",
      lines: [
        {
          productVariantId: "v1",
          sku: "POL-M-N",
          name: "Polo básico",
          variant: "M · Negro",
          quantity: 2,
          unitPrice: 50,
          isManual: false,
          isPack: false,
          isGift: false,
          imageUrl: undefined,
        },
      ],
    });
    expect(c.linkConversationQuote).toHaveBeenCalledWith("c1", {
      quotationId: "q1",
      quotationNumber: "COT-0001",
      publicUrl: "https://app.powip.test/c/tok",
    });
    expect(onInsertMessage).toHaveBeenCalledWith(quoteMessage("https://app.powip.test/c/tok"));
    expect(onInsertMessage.mock.calls[0][0]).toBe(
      "Te dejo tu pedido para confirmar y pagar: https://app.powip.test/c/tok",
    );
    await waitFor(() => expect(screen.queryByText("Crear POWIP Link")).not.toBeInTheDocument());
  });

  it("adelanto sin monto sugiere el 30 % del total", async () => {
    q.createQuotation.mockResolvedValue(quotation({ paymentType: "ADELANTO" }));
    c.linkConversationQuote.mockResolvedValue(link("l1", "q1"));
    setup();
    await openAndAdd();
    fireEvent.change(screen.getByLabelText("Tipo de pago"), { target: { value: "ADELANTO" } });
    fireEvent.click(screen.getByRole("button", { name: /Crear POWIP Link/ }));
    await waitFor(() => expect(q.createQuotation).toHaveBeenCalled());
    expect(q.createQuotation.mock.calls[0][0]).toMatchObject({
      paymentType: "ADELANTO",
      suggestedDeposit: 15,
    });
  });

  it("un error de Core se muestra y no pierde el carrito ni vincula", async () => {
    q.createQuotation.mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: "Sin stock suficiente de Polo básico" } },
    });
    const { onInsertMessage } = setup();
    await openAndAdd();
    fireEvent.click(screen.getByRole("button", { name: /Crear POWIP Link/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Sin stock suficiente de Polo básico");
    expect(screen.getAllByTestId("cart-line")).toHaveLength(1);
    expect(c.linkConversationQuote).not.toHaveBeenCalled();
    expect(onInsertMessage).not.toHaveBeenCalled();
  });

  it("si falla el vínculo reintenta solo el vínculo, sin crear otra cotización", async () => {
    q.createQuotation.mockResolvedValue(quotation());
    c.linkConversationQuote
      .mockRejectedValueOnce(new Error("ms-crm caído"))
      .mockResolvedValueOnce(link("l1", "q1"));
    const { onInsertMessage } = setup();
    await openAndAdd();
    fireEvent.click(screen.getByRole("button", { name: /Crear POWIP Link/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("COT-0001 se creó");
    fireEvent.click(screen.getByRole("button", { name: /Crear POWIP Link/ }));
    await waitFor(() => expect(onInsertMessage).toHaveBeenCalled());
    expect(q.createQuotation).toHaveBeenCalledTimes(1);
    expect(c.linkConversationQuote).toHaveBeenCalledTimes(2);
  });
});

describe("POWIP Links enviados", () => {
  it("muestra número, total, estado, pagos y copia el enlace", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    c.listConversationQuotes.mockResolvedValue([link("l1", "q1"), link("l2", "q2"), link("l3", "q3")]);
    q.getQuotation.mockImplementation(async (id: string) => {
      if (id === "q1")
        return quotation({
          id: "q1",
          number: "COT-0001",
          payments: [
            { id: "p1", amount: 40, method: "YAPE_QR", status: "PENDIENTE", createdAt: "2026-11-19" },
          ],
        });
      if (id === "q2")
        return quotation({
          id: "q2",
          number: "COT-0002",
          status: "VENCIDA",
          expiresAt: "2026-01-01T00:00:00.000Z",
        });
      return quotation({ id: "q3", number: "COT-0003", status: "CONVERTIDA" });
    });
    setup();
    const rows = await screen.findAllByTestId("quote-row");
    await waitFor(() => expect(within(rows[0]).getByText("Pendiente")).toBeInTheDocument());
    expect(within(rows[0]).getByText(/Total S\/100\.00/)).toBeInTheDocument();
    expect(within(rows[0]).getByText(/S\/40\.00 · Yape · por revisar/)).toBeInTheDocument();
    await waitFor(() => expect(within(rows[1]).getByText("Vencida")).toBeInTheDocument());
    await waitFor(() =>
      expect(within(rows[2]).getByText("Convertida en pedido")).toBeInTheDocument(),
    );

    fireEvent.click(within(rows[0]).getByRole("button", { name: /Copiar enlace/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://app.powip.test/c/tok"));
    fireEvent.click(within(rows[0]).getByRole("button", { name: /Abrir cotización/ }));
    expect(push).toHaveBeenCalledWith("/cotizaciones?quotationId=q1");
  });

  it("«Poner en el mensaje» deja el enlace en la caja", async () => {
    c.listConversationQuotes.mockResolvedValue([link("l1", "q1")]);
    q.getQuotation.mockResolvedValue(quotation());
    const { onInsertMessage } = setup();
    const row = await screen.findByTestId("quote-row");
    await screen.findByText("Pendiente");
    fireEvent.click(within(row).getByRole("button", { name: /Poner en el mensaje/ }));
    expect(onInsertMessage).toHaveBeenCalledWith(quoteMessage("https://app.powip.test/c/tok"));
  });

  it("si Core no responde muestra el número y el enlace guardados", async () => {
    c.listConversationQuotes.mockResolvedValue([link("l9", "q9")]);
    q.getQuotation.mockRejectedValue(new Error("Core caído"));
    const { onInsertMessage } = setup();
    const row = await screen.findByTestId("quote-row");
    expect(within(row).getByText("COT-q9")).toBeInTheDocument();
    await screen.findByText(/No se pudo cargar la cotización/);
    fireEvent.click(within(row).getByRole("button", { name: /Poner en el mensaje/ }));
    expect(onInsertMessage).toHaveBeenCalledWith(quoteMessage("https://app.powip.test/c/saved-q9"));
  });

  it("vincula el pedido una sola vez cuando la cotización está convertida", async () => {
    c.listConversationQuotes.mockResolvedValue([link("l1", "q7")]);
    c.linkConversationOrder.mockResolvedValue({
      id: "o1",
      conversationId: "c1",
      orderId: "ord-77",
      orderNumber: "ORD-77",
      createdByUserId: null,
      createdByName: null,
      createdAt: "2026-11-19T10:00:00.000Z",
    });
    q.getQuotation.mockResolvedValue(
      quotation({ id: "q7", status: "CONVERTIDA", orderId: "ord-77", orderNumber: "ORD-77" }),
    );
    setup();
    await waitFor(() => expect(c.linkConversationOrder).toHaveBeenCalledTimes(1));
    expect(c.linkConversationOrder).toHaveBeenCalledWith("c1", {
      orderId: "ord-77",
      orderNumber: "ORD-77",
    });
    await screen.findByText("Pedido ORD-77");
    await new Promise((r) => setTimeout(r, 50));
    expect(c.linkConversationOrder).toHaveBeenCalledTimes(1);
  });

  it("no vincula si el pedido ya aparece en la conversación", async () => {
    c.listConversationQuotes.mockResolvedValue([link("l1", "q8")]);
    c.listConversationOrders.mockResolvedValue([
      {
        id: "o2",
        conversationId: "c1",
        orderId: "ord-88",
        orderNumber: "ORD-88",
        createdByUserId: null,
        createdByName: null,
        createdAt: "2026-11-19T10:00:00.000Z",
      },
    ]);
    q.getQuotation.mockResolvedValue(
      quotation({ id: "q8", status: "CONVERTIDA", orderId: "ord-88", orderNumber: "ORD-88" }),
    );
    setup();
    await screen.findByText("Pedido ORD-88");
    await new Promise((r) => setTimeout(r, 50));
    expect(c.linkConversationOrder).not.toHaveBeenCalled();
  });
});

describe("appendLine", () => {
  it("añade en línea nueva si ya hay texto", () => {
    expect(appendLine("Hola Ana  ", "enlace")).toBe("Hola Ana\nenlace");
    expect(appendLine("   ", "enlace")).toBe("enlace");
  });
});
