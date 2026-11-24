import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ChatBanners from "@/components/ventas-chat/ChatBanners";
import { CallBubble, isCallNote } from "@/components/ventas-chat/CallBubble";
import ConversationPills from "@/components/ventas-chat/ConversationPills";
import SendLinkButton from "@/components/ventas-chat/SendLinkButton";
import { appendLine, quoteMessage } from "@/components/ventas-chat/quotes";
import axiosAuth from "@/lib/axiosAuth";
import * as crm from "@/services/crmService";
import * as content from "@/services/crmContentService";
import * as quotations from "@/services/quotationService";
import type { Conversation, Message } from "@/types/crm";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/services/crmService", () => ({
  ...jest.requireActual("@/services/crmService"),
  listPipelines: jest.fn(),
  listConversationOrders: jest.fn(),
  listConversationQuotes: jest.fn(),
  updateConversation: jest.fn(),
}));
jest.mock("@/services/crmContentService", () => ({
  ...jest.requireActual("@/services/crmContentService"),
  getScript: jest.fn(),
}));
jest.mock("@/services/quotationService", () => ({
  ...jest.requireActual("@/services/quotationService"),
  getQuotation: jest.fn(),
}));
const c = crm as jest.Mocked<typeof crm>;
const get = axiosAuth.get as jest.Mock;

const HOUR = 3_600_000;
const at = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();
const LINK = "https://app.powip.test/c/tok";

const conv = (over: Partial<Conversation> = {}) =>
  ({
    id: "c1",
    channel: "whatsapp",
    status: "open",
    contactName: "Ana",
    contactPhone: "51999111222",
    pipelineId: "p1",
    stageId: "s1",
    lastInboundAt: at(-1),
    windowExpiresAt: at(4.5),
    hotAt: null,
    lostReason: null,
    ...over,
  }) as Conversation;

const wrap = (ui: React.ReactElement) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {ui}
    </QueryClientProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  c.listPipelines.mockResolvedValue([
    {
      id: "p1",
      name: "Ventas",
      isDefault: true,
      stages: [
        { id: "s1", name: "Nuevo", kind: "open" },
        { id: "s9", name: "Perdido", kind: "lost" },
      ],
    },
  ] as never);
  c.listConversationOrders.mockResolvedValue([]);
  c.listConversationQuotes.mockResolvedValue([]);
  c.updateConversation.mockResolvedValue(conv());
  (content.getScript as jest.Mock).mockResolvedValue({ steps: [], closingRules: { promo: "2x1 en polos", lastUnits: 3 } });
  (quotations.getQuotation as jest.Mock).mockResolvedValue(undefined);
});

function banners(over: Partial<Conversation>, props: Partial<React.ComponentProps<typeof ChatBanners>> = {}) {
  const onInsert = jest.fn();
  wrap(<ChatBanners conversation={conv(over)} windowOpen canCall={false} onInsert={onInsert} {...props} />);
  return { onInsert };
}

describe("Avisos del chat", () => {
  it("ventana abierta dice las horas y la promo se ofrece en la caja", async () => {
    const { onInsert } = banners({});
    expect(screen.getByTestId("window-banner")).toHaveTextContent("quedan 5 h");
    fireEvent.click(await screen.findByRole("button", { name: "Ofrecer" }));
    expect(onInsert).toHaveBeenCalledWith("2x1 en polos");
  });

  it("ventana cerrada: plantilla, y llamar solo si el cliente aceptó", async () => {
    banners({}, { windowOpen: false, canCall: true });
    expect(screen.getByTestId("window-closed-banner")).toHaveTextContent("plantilla o llamarlo (aceptó llamadas).");
    await waitFor(() => expect(content.getScript).not.toHaveBeenCalled());
  });

  it("ventana cerrada sin permiso no menciona la llamada", () => {
    banners({}, { windowOpen: false });
    expect(screen.getByTestId("window-closed-banner")).not.toHaveTextContent("llamarlo");
  });

  it("Instagram pasadas las 24 h avisa «agente humano»", () => {
    banners({ channel: "instagram", lastInboundAt: at(-30), windowExpiresAt: at(100) });
    expect(screen.getByTestId("human-agent-banner")).toBeInTheDocument();
  });

  it("comentario público recomienda responder por privado", () => {
    banners({ channel: "instagram" }, { lastInbound: { type: "comment" as never } });
    expect(screen.getByTestId("comment-banner")).toHaveTextContent("Comentario público en Instagram");
  });

  it("perdido muestra el motivo y «Reabrir» lo devuelve a la primera etapa abierta", async () => {
    banners({ stageId: "s9", status: "closed", lostReason: "Precio" });
    expect(await screen.findByTestId("lost-banner")).toHaveTextContent("Perdido · Precio");
    fireEvent.click(screen.getByRole("button", { name: "Reabrir" }));
    await waitFor(() => expect(c.updateConversation).toHaveBeenCalledWith("c1", { status: "open", stageId: "s1" }));
  });

  it("con pedido dice el número, y «Entregado» cuando Ventas lo entregó", async () => {
    c.listConversationOrders.mockResolvedValue([{ id: "o", orderId: "o1", orderNumber: "PED-7" }] as never);
    get.mockResolvedValue({ data: { orderNumber: "PED-7", status: "ENTREGADO" } });
    banners({});
    expect(await screen.findByText("Entregado · pedido PED-7")).toBeInTheDocument();
  });
});

describe("Enviar POWIP Link", () => {
  function sendLink(over: Partial<Conversation> = {}) {
    const onInsert = jest.fn();
    wrap(<SendLinkButton conversation={conv(over)} onInsert={onInsert} disabled={false} />);
    return { onInsert };
  }

  it("sin link pide armar el pedido", async () => {
    sendLink();
    expect(await screen.findByTestId("send-link")).toBeDisabled();
    expect(screen.getByText(/Arma el pedido en el panel/)).toBeInTheDocument();
  });

  it("con link vivo muestra el total y deja el mensaje en la caja", async () => {
    c.listConversationQuotes.mockResolvedValue([{ id: "l1", quotationId: "q1", publicUrl: LINK, orderId: null }] as never);
    (quotations.getQuotation as jest.Mock).mockResolvedValue({ status: "PREVENTA", expiresAt: at(5), total: 89, lines: [] });
    const { onInsert } = sendLink();
    const button = await screen.findByText(/Enviar POWIP Link · S\/ ?89\.00/);
    fireEvent.click(button);
    expect(onInsert).toHaveBeenCalledWith(quoteMessage(LINK));
  });

  it("no repite el link si ya está en la caja", () => {
    const msg = quoteMessage(LINK);
    expect(appendLine(msg, msg)).toBe(msg);
    expect(appendLine("Hola", msg)).toBe(`Hola\n${msg}`);
  });

  it("desaparece si ya hay pedido", async () => {
    c.listConversationOrders.mockResolvedValue([{ id: "o", orderId: "o1", orderNumber: "PED-7" }] as never);
    sendLink();
    await waitFor(() => expect(screen.queryByTestId("send-link")).not.toBeInTheDocument());
  });
});

describe("Lista de chats", () => {
  it("con señal de compra dice «Listo para comprar», etapa y temperatura", async () => {
    wrap(<ConversationPills conversation={conv({ hotAt: at(-1) })} />);
    expect(screen.getByText(/Listo para comprar/)).toBeInTheDocument();
    expect(screen.getByText("Caliente")).toBeInTheDocument();
    expect(await screen.findByText("Nuevo")).toBeInTheDocument();
  });

  it("sin señal solo dice la temperatura", () => {
    wrap(<ConversationPills conversation={conv()} />);
    expect(screen.queryByText(/Listo para comprar/)).not.toBeInTheDocument();
    expect(screen.getByText("Tibio")).toBeInTheDocument();
  });
});

describe("Burbuja de llamada", () => {
  const note = (body: string) =>
    ({ id: "m1", senderKind: "system", type: "system", body, senderName: "Laura", createdAt: at(0) }) as Message;

  it("separa duración, resultado y resumen", () => {
    render(<CallBubble message={note("Llamada hecha: Vendió · 3 min · Quiere talla M · delivery")} />);
    const bubble = screen.getByTestId("call-bubble");
    expect(bubble).toHaveTextContent("Llamada de Laura · 3 min · Vendió");
    expect(bubble).toHaveTextContent("Quiere talla M · delivery");
  });

  it("sin duración no toma el resumen como tiempo", () => {
    render(<CallBubble message={note("Llamada recibida: No contestó · Reintentar")} />);
    expect(screen.getByTestId("call-bubble")).toHaveTextContent("Llamada de Laura · No contestó");
    expect(screen.getByText("Reintentar")).toBeInTheDocument();
  });

  it("solo las notas del sistema con ese formato son llamadas", () => {
    expect(isCallNote(note("Llamada hecha: Vendió"))).toBe(true);
    expect(isCallNote(note("Etapa cambiada"))).toBe(false);
    expect(isCallNote({ ...note("Llamada hecha: Vendió"), senderKind: "customer" })).toBe(false);
  });
});
