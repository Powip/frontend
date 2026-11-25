import React from "react";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import OrderChatConversation, { authorOf, bandejaHref } from "@/components/orders/OrderChatConversation";
import * as crm from "@/services/crmService";
import * as panel from "@/services/crmOrderPanelService";
import type { Conversation, Message } from "@/types/crm";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("@/services/crmService", () => ({
  ...jest.requireActual("@/services/crmService"),
  getOrderConversation: jest.fn(),
  listAllMessages: jest.fn(),
  getMessageMedia: jest.fn(),
}));
jest.mock("@/services/crmOrderPanelService", () => ({
  ...jest.requireActual("@/services/crmOrderPanelService"),
  listReceipts: jest.fn(),
}));
const c = crm as jest.Mocked<typeof crm>;
const p = panel as jest.Mocked<typeof panel>;

const conv = { id: "conv-1", channel: "whatsapp", contactName: "Rosa Díaz", contactPhone: "51999111222", assignedUserName: "Lucía" } as Conversation;

const msg = (over: Partial<Message>): Message =>
  ({
    id: Math.random().toString(36),
    conversationId: "conv-1",
    direction: "in",
    type: "text",
    body: "hola",
    status: "received",
    senderKind: "customer",
    senderName: null,
    mediaMime: null,
    mediaUrl: null,
    createdAt: "2026-11-25T15:00:00.000Z",
    ...over,
  }) as Message;

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <OrderChatConversation orderId="order-1" />
    </QueryClientProvider>,
  );
}

function axiosError(status: number) {
  return new AxiosError("fail", String(status), undefined, undefined, {
    status,
    statusText: "",
    data: {},
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

beforeEach(() => {
  jest.resetAllMocks();
  p.listReceipts.mockResolvedValue([]);
});

describe("pestaña Conversación del detalle de la venta", () => {
  it("muestra el chat con cliente, Pau y la vendedora, cada uno con su autor y hora", async () => {
    c.getOrderConversation.mockResolvedValue(conv);
    c.listAllMessages.mockResolvedValue({
      hasMore: false,
      items: [
        msg({ body: "Quiero el polo negro" }),
        msg({ direction: "out", senderKind: "pau", body: "Tenemos talla M y L", status: "read" }),
        msg({ direction: "out", senderKind: "agent", senderName: "Lucía", body: "Te confirmo el envío", status: "read" }),
      ],
    });
    renderTab();
    expect(await screen.findByText("Quiero el polo negro")).toBeInTheDocument();
    const bubbles = screen.getAllByTestId("order-chat-message");
    expect(bubbles.map((b) => b.getAttribute("data-author"))).toEqual(["customer", "pau", "agent"]);
    expect(bubbles[0]).toHaveTextContent("Rosa Díaz");
    expect(bubbles[1]).toHaveTextContent("Pau");
    expect(bubbles[2]).toHaveTextContent("Lucía");
    expect(screen.getByRole("link", { name: /Abrir en Ventas por chat/ })).toHaveAttribute("href", bandejaHref("conv-1"));
    expect(c.getOrderConversation).toHaveBeenCalledWith("order-1");
  });

  it("lista los comprobantes del chat con su estado", async () => {
    c.getOrderConversation.mockResolvedValue(conv);
    c.listAllMessages.mockResolvedValue({ hasMore: false, items: [msg({})] });
    p.listReceipts.mockResolvedValue([
      { id: "r1", status: "aprobado", methodLabel: "Yape", amount: 89.9, operationNumber: "123", mime: "image/jpeg", hasFile: true, uploadedByName: "Lucía", reviewedByName: null, createdAt: "2026-11-25T15:05:00.000Z" } as never,
    ]);
    renderTab();
    const row = await screen.findByTestId("order-chat-receipt");
    expect(row).toHaveTextContent("Yape · S/ 89.90");
    expect(row).toHaveTextContent("Aprobado");
  });

  it("venta sin chat: aviso tranquilo, sin error", async () => {
    c.getOrderConversation.mockResolvedValue(null);
    renderTab();
    expect(await screen.findByText("Esta venta no vino de un chat")).toBeInTheDocument();
    expect(c.listAllMessages).not.toHaveBeenCalled();
  });

  it("usuario sin acceso al CRM (403): no ve mensajes ni error", async () => {
    c.getOrderConversation.mockRejectedValue(axiosError(403));
    renderTab();
    expect(await screen.findByText("Sin acceso a Ventas por chat")).toBeInTheDocument();
    expect(c.listAllMessages).not.toHaveBeenCalled();
  });

  it("imagen del cliente se ve sin el botón de usar como comprobante", async () => {
    c.getOrderConversation.mockResolvedValue(conv);
    c.getMessageMedia.mockResolvedValue(new Blob(["x"], { type: "image/jpeg" }));
    global.URL.createObjectURL = jest.fn(() => "blob:x");
    global.URL.revokeObjectURL = jest.fn();
    c.listAllMessages.mockResolvedValue({
      hasMore: false,
      items: [msg({ type: "image", body: null, mediaMime: "image/jpeg", mediaUrl: "/crm/conversations/conv-1/messages/m1/media" })],
    });
    renderTab();
    expect(await screen.findByTestId("wa-image")).toBeInTheDocument();
    expect(screen.queryByText(/Usar como comprobante/)).not.toBeInTheDocument();
  });
});

describe("autor del mensaje", () => {
  it("distingue cliente, Pau, vendedora y automático", () => {
    expect(authorOf(msg({}), "Rosa").label).toBe("Rosa");
    expect(authorOf(msg({ direction: "out", senderKind: "pau" }), "Rosa").label).toBe("Pau");
    expect(authorOf(msg({ direction: "out", senderKind: "agent", senderName: "Lucía" }), "Rosa").label).toBe("Lucía");
    expect(authorOf(msg({ direction: "out", senderKind: "agent" }), "Rosa").label).toBe("Vendedora");
    expect(authorOf(msg({ direction: "out", senderKind: "system" }), "Rosa").kind).toBe("auto");
  });
});
