import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Bandeja from "@/components/ventas-chat/Bandeja";

/** El panel derecho abre en «Pedido»: los datos del cliente están en la pestaña «Cliente». */
async function openClientTab() {
  const aside = within(await screen.findByRole("complementary", { name: "Cliente y pedido" }));
  fireEvent.click(await aside.findByRole("tab", { name: "Cliente" }));
}
import { applyCrmEvent } from "@/lib/crmSse";
import * as svc from "@/services/crmService";
import type { Conversation, Message } from "@/types/crm";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      accessToken: "t",
      user: { id: "u1", name: "Jairo", surname: "R" },
      company: { id: "co1" },
    },
  }),
}));
let mockParams = new URLSearchParams();
const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
  usePathname: () => "/comercial/ventas-chat/bandeja",
  useSearchParams: () => mockParams,
}));
jest.mock("@/services/clients.service", () => ({
  fetchClientByPhone: jest.fn(),
  createClient: jest.fn(),
}));
// The resend button has its own test; here it would consume the mocked HTTP calls.
jest.mock("@/components/facturacion/ReenviarPdfWhatsAppButton", () => ({ ReenviarPdfWhatsAppButton: () => null }));
jest.mock("@/components/modals/PaymentVerificationModal", () => ({
  __esModule: true,
  default: ({ orderId }: { orderId: string }) => <div data-testid="pay-modal">{orderId}</div>,
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/services/crmCallsService", () => ({
  listCalls: jest.fn().mockResolvedValue([]),
  getCallStats: jest.fn(),
  createCall: jest.fn(),
  deleteCall: jest.fn(),
}));
jest.mock("@/services/crmService", () => ({
  ...jest.requireActual("@/services/crmService"),
  listConversations: jest.fn(),
  getConversation: jest.fn(),
  listMessages: jest.fn(),
  sendMessage: jest.fn(),
  markConversationRead: jest.fn(),
  updateConversation: jest.fn(),
  listConversationOrders: jest.fn(),
  listConversationQuotes: jest.fn(),
  listPipelines: jest.fn(),
  listTasks: jest.fn(),
}));
const s = svc as jest.Mocked<typeof svc>;
import { fetchClientByPhone } from "@/services/clients.service";
import axiosAuth from "@/lib/axiosAuth";
const fetchClient = fetchClientByPhone as jest.Mock;
const http = axiosAuth as unknown as { get: jest.Mock };

const FUTURE = new Date(Date.now() + 3 * 3600_000).toISOString();
const PAST = new Date(Date.now() - 3600_000).toISOString();

const conv = (over: Partial<Conversation> = {}): Conversation => ({
  id: "c1",
  channel: "whatsapp",
  contactPhone: "51999111222",
  customerPhone: null,
  contactName: "Ana Pérez",
  status: "open",
  assignedUserId: null,
  assignedUserName: null,
  clientId: null,
  unreadCount: 0,
  lastMessageAt: new Date().toISOString(),
  lastMessagePreview: "Hola, precio?",
  lastMessageDirection: "in",
  lastInboundAt: new Date().toISOString(),
  windowExpiresAt: FUTURE,
  createdAt: new Date().toISOString(),
  pipelineId: null,
  stageId: null,
  stageChangedAt: null,
  lostReason: null,
  marketingOptOut: false,
  pauEnabled: false,
  pauHelpReason: null,
  scriptStep: null,
  resumeAt: null,
  resumeNote: null,
  tags: [],
  ...over,
});
const msg = (over: Partial<Message> = {}): Message => ({
  id: "m1",
  conversationId: "c1",
  direction: "in",
  type: "text",
  body: "Hola, precio?",
  status: "received",
  senderKind: "customer",
  senderUserId: null,
  senderName: null,
  errorMessage: null,
  createdAt: new Date().toISOString(),
  ...over,
});

let qc: QueryClient;
function setup(c: Conversation = conv(), messages: Message[] = [msg()]) {
  s.listConversations.mockResolvedValue({ items: [c], total: 1, page: 1, limit: 30 });
  s.getConversation.mockResolvedValue(c);
  s.listMessages.mockResolvedValue({ items: messages, hasMore: false });
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Bandeja />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = new URLSearchParams();
  s.listConversationOrders.mockResolvedValue([]);
  s.listConversationQuotes.mockResolvedValue([]);
  s.listPipelines.mockResolvedValue([]);
  s.listTasks.mockResolvedValue([]);
  fetchClient.mockResolvedValue(null);
  s.updateConversation.mockResolvedValue(conv());
  // SSE: conexión que nunca responde (el test inyecta eventos con applyCrmEvent)
  global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
});

describe("Bandeja", () => {
  it("lista conversaciones con nombre, vista previa y no leídos", async () => {
    setup(conv({ unreadCount: 2 }));
    expect(await screen.findByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText("Hola, precio?")).toBeInTheDocument();
    expect(screen.getByLabelText("2 sin leer")).toBeInTheDocument();
    expect(screen.getByText("Reconectando…")).toBeInTheDocument();
  });

  it("muestra aviso claro si ms-crm no responde", async () => {
    s.listConversations.mockRejectedValue(new (jest.requireActual("axios").AxiosError)("Network Error"));
    qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
        <Bandeja />
      </QueryClientProvider>,
    );
    expect(
      await screen.findByText("No se pudo conectar con el servicio de chat"),
    ).toBeInTheDocument();
  });

  it("al abrir una conversación con no leídos llama a read", async () => {
    s.markConversationRead.mockResolvedValue(conv());
    setup(conv({ unreadCount: 2 }));
    fireEvent.click(await screen.findByText("Ana Pérez"));
    await waitFor(() => expect(s.markConversationRead).toHaveBeenCalledWith("c1"));
  });

  it("Enter envía el mensaje al endpoint y Shift+Enter no", async () => {
    s.sendMessage.mockResolvedValue(
      msg({ id: "m2", direction: "out", body: "Cuesta S/ 50", status: "sent", senderKind: "agent" }),
    );
    setup();
    fireEvent.click(await screen.findByText("Ana Pérez"));
    const box = await screen.findByLabelText("Mensaje");
    fireEvent.change(box, { target: { value: "Cuesta S/ 50" } });
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(s.sendMessage).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(s.sendMessage).toHaveBeenCalledWith("c1", "Cuesta S/ 50"));
    expect(await screen.findByText("Cuesta S/ 50")).toBeInTheDocument();
    expect(screen.getByText("Enviado")).toBeInTheDocument();
  });

  it("marca el mensaje como fallido con su motivo si el envío falla", async () => {
    s.sendMessage.mockRejectedValue(new Error("WhatsApp rechazó el mensaje"));
    setup();
    fireEvent.click(await screen.findByText("Ana Pérez"));
    const box = await screen.findByLabelText("Mensaje");
    fireEvent.change(box, { target: { value: "hola" } });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(await screen.findByText("WhatsApp rechazó el mensaje")).toBeInTheDocument();
    expect(screen.getByText("Falló")).toBeInTheDocument();
  });

  it("bloquea la caja cuando pasó la ventana de 24 h", async () => {
    setup(conv({ windowExpiresAt: PAST }));
    fireEvent.click(await screen.findByText("Ana Pérez"));
    const box = await screen.findByLabelText("Mensaje");
    expect(box).toBeDisabled();
    expect(screen.getByText(/Pasaron más de 24 h desde el último mensaje del cliente/)).toBeInTheDocument();
    expect(screen.getByLabelText("Enviar mensaje")).toBeDisabled();
  });

  it("bloquea la caja si windowExpiresAt es null", async () => {
    setup(conv({ windowExpiresAt: null }));
    fireEvent.click(await screen.findByText("Ana Pérez"));
    expect(await screen.findByLabelText("Mensaje")).toBeDisabled();
  });

  it("un evento message.created añade el mensaje sin recargar", async () => {
    setup();
    fireEvent.click(await screen.findByText("Ana Pérez"));
    await screen.findByLabelText("Mensaje");
    await waitFor(() => expect(s.listMessages).toHaveBeenCalled());
    await screen.findAllByText("Hola, precio?");
    act(() => {
      applyCrmEvent(qc, {
        type: "message.created",
        data: {
          conversation: conv(),
          message: msg({ id: "m9", body: "Mensaje en vivo", type: "text" }),
        },
      });
    });
    expect(await screen.findByText("Mensaje en vivo")).toBeInTheDocument();
  });

  it("mensajes sin texto muestran [tipo]", async () => {
    setup(conv(), [msg({ id: "m3", body: null, type: "image" })]);
    fireEvent.click(await screen.findByText("Ana Pérez"));
    expect(await screen.findByText("[image]")).toBeInTheDocument();
  });

  it("Tomar asigna al usuario actual", async () => {
    s.updateConversation.mockResolvedValue(conv({ assignedUserId: "u1", assignedUserName: "Jairo R" }));
    setup();
    fireEvent.click(await screen.findByText("Ana Pérez"));
    fireEvent.click(await screen.findByRole("button", { name: "Tomar" }));
    await waitFor(() =>
      expect(s.updateConversation).toHaveBeenCalledWith("c1", { assignedUserId: "u1" }),
    );
  });

  it("abre la conversación indicada en ?c= y actualiza la URL al elegir otra", async () => {
    mockParams = new URLSearchParams("c=c1");
    setup();
    expect(await screen.findByLabelText("Mensaje")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Ana Pérez")[0]);
    expect(mockReplace).toHaveBeenCalledWith("/comercial/ventas-chat/bandeja?c=c1", {
      scroll: false,
    });
  });

  it("al elegir una conversación sin ?c= escribe el parámetro", async () => {
    setup();
    fireEvent.click(await screen.findByText("Ana Pérez"));
    expect(mockReplace).toHaveBeenCalledWith("/comercial/ventas-chat/bandeja?c=c1", {
      scroll: false,
    });
  });

  it("pinta los mensajes de sistema centrados y sin burbuja", async () => {
    setup(conv(), [
      msg({
        id: "s1",
        direction: "out",
        senderKind: "system",
        type: "system",
        senderName: "Sistema",
        body: "Pedido ORD-7 creado desde el chat",
      }),
    ]);
    fireEvent.click(await screen.findByText("Ana Pérez"));
    const sys = await screen.findByTestId("system-message");
    expect(sys).toHaveTextContent("Pedido ORD-7 creado desde el chat");
    expect(sys.className).toContain("text-center");
    expect(sys.className).not.toContain("bg-primary");
  });

  it("pinta como burbuja saliente el mensaje real enviado por un seguimiento, con etiqueta «Automático»", async () => {
    setup(conv(), [
      msg({
        id: "a1",
        direction: "out",
        senderKind: "system",
        type: "text",
        status: "sent",
        senderName: "Seguimiento +2 h",
        body: "Ana, ¿te ayudo a separarla?",
      }),
      msg({
        id: "a2",
        direction: "out",
        senderKind: "system",
        type: "template",
        status: "sent",
        senderName: "Difusión de noviembre",
        body: "Hola Ana, llegó lo nuevo.",
      }),
    ]);
    fireEvent.click(await screen.findByText("Ana Pérez"));
    expect(await screen.findByText("Ana, ¿te ayudo a separarla?")).toBeInTheDocument();
    expect(screen.queryByTestId("system-message")).not.toBeInTheDocument();
    expect(screen.getByText("Automático · Seguimiento +2 h")).toBeInTheDocument();
    expect(screen.getByText("Automático · Difusión de noviembre")).toBeInTheDocument();
    const bubble = screen.getByText("Ana, ¿te ayudo a separarla?").closest("div");
    expect(bubble?.className).toContain("bg-crm-bubble-out");
  });
});

describe("Panel Cliente y pedido", () => {
  const client = {
    id: "cl1",
    companyId: "co1",
    fullName: "Ana Pérez Rojas",
    phoneNumber: "999111222",
    documentType: "DNI",
    documentNumber: "12345678",
    clientType: "TRADICIONAL",
    province: "Lima",
    city: "Lima",
    district: "Miraflores",
    address: "Av. Larco 100",
    isActive: true,
  };
  const link = {
    id: "l1",
    conversationId: "c1",
    orderId: "o1",
    orderNumber: "ORD-100",
    createdByUserId: "u1",
    createdByName: "Jairo R",
    createdAt: new Date().toISOString(),
  };

  it("cliente encontrado: muestra sus datos y guarda el vínculo", async () => {
    fetchClient.mockResolvedValue(client);
    setup();
    fireEvent.click(await screen.findByText("Ana Pérez"));
    await openClientTab();
    const [card] = await screen.findAllByTestId("client-card");
    expect(card).toHaveTextContent("Ana Pérez Rojas");
    expect(card).toHaveTextContent("DNI 12345678");
    expect(card).toHaveTextContent("Miraflores · Av. Larco 100");
    expect(fetchClient).toHaveBeenCalledWith("co1", "999111222");
    await waitFor(() =>
      expect(s.updateConversation).toHaveBeenCalledWith("c1", { clientId: "cl1" }),
    );
  });

  it("no vuelve a vincular si la conversación ya apunta al cliente", async () => {
    fetchClient.mockResolvedValue(client);
    setup(conv({ clientId: "cl1" }));
    fireEvent.click(await screen.findByText("Ana Pérez"));
    await openClientTab();
    await screen.findAllByTestId("client-card");
    expect(s.updateConversation).not.toHaveBeenCalled();
  });

  it("cliente no encontrado: aviso y botón Crear cliente", async () => {
    fetchClient.mockResolvedValue(null);
    setup();
    fireEvent.click(await screen.findByText("Ana Pérez"));
    await openClientTab();
    expect(
      (await screen.findAllByText("Este número no está en Clientes")).length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: /Crear cliente/ })[0]);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre completo/)).toHaveValue("Ana Pérez");
    expect(s.updateConversation).not.toHaveBeenCalled();
  });

  it("lista los pedidos con estado, total y saldo, y abre Pagos y el pedido", async () => {
    s.listConversationOrders.mockResolvedValue([link]);
    http.get.mockResolvedValue({
      data: {
        id: "o1",
        orderNumber: "ORD-100",
        status: "PENDIENTE",
        grandTotal: "150.00",
        currency: "PEN",
        payments: [
          { status: "PAID", amount: "50" },
          { status: "PENDING", amount: "30" },
        ],
      },
    });
    setup();
    fireEvent.click(await screen.findByText("Ana Pérez"));
    const [row] = await screen.findAllByTestId("order-row");
    await waitFor(() => expect(row).toHaveTextContent("Saldo S/ 100.00"));
    expect(row).toHaveTextContent("ORD-100");
    expect(row).toHaveTextContent("Total S/ 150.00");
    // La barra de Pau también hace un GET (settings): se busca la llamada del pedido.
    expect(http.get.mock.calls.some((c) => /\/order-header\/o1$/.test(String(c[0])))).toBe(true);
    fireEvent.click(screen.getAllByRole("button", { name: "Pagos" })[0]);
    expect(await screen.findByTestId("pay-modal")).toHaveTextContent("o1");
    fireEvent.click(screen.getAllByRole("button", { name: /Abrir pedido/ })[0]);
    expect(mockPush).toHaveBeenCalledWith("/registrar-venta?orderId=o1");
  });

  it("si Core no responde muestra igual el número guardado", async () => {
    s.listConversationOrders.mockResolvedValue([link]);
    http.get.mockRejectedValue(new Error("down"));
    setup();
    fireEvent.click(await screen.findByText("Ana Pérez"));
    const [row] = await screen.findAllByTestId("order-row");
    expect(row).toHaveTextContent("ORD-100");
    await waitFor(() =>
      expect(row).toHaveTextContent("No se pudo cargar el detalle del pedido."),
    );
  });

  it("sin pedidos muestra el estado vacío", async () => {
    setup();
    fireEvent.click(await screen.findByText("Ana Pérez"));
    expect(
      (await screen.findAllByText("Aún no hay pedidos creados desde este chat.")).length,
    ).toBeGreaterThan(0);
  });

  it("Registrar venta completa arma la URL de registrar-venta con returnTo a la bandeja", async () => {
    setup();
    fireEvent.click(await screen.findByText("Ana Pérez"));
    fireEvent.click((await screen.findAllByRole("button", { name: /Registrar venta completa/ }))[0]);
    const url = new URL(mockPush.mock.calls[0][0], "http://x");
    expect(url.pathname).toBe("/registrar-venta");
    expect(url.searchParams.get("crmConversationId")).toBe("c1");
    expect(url.searchParams.get("crmPhone")).toBe("51999111222");
    expect(url.searchParams.get("returnTo")).toBe("/comercial/ventas-chat/bandeja?c=c1");
  });
});

describe("Bandeja · canales Messenger e Instagram", () => {
  const IG_ID = "17841400000000";
  const ig = (over: Partial<Conversation> = {}) =>
    conv({ channel: "instagram", contactPhone: IG_ID, contactName: "Luz Mora", customerPhone: null, ...over });

  it("cada fila muestra el canal y el filtro de canal envía channel", async () => {
    setup(ig());
    expect(await screen.findByText("Luz Mora")).toBeInTheDocument();
    expect(screen.getByTestId("channel-badge")).toHaveTextContent("Instagram");
    expect(s.listConversations.mock.calls[0][0]).not.toHaveProperty("channel");
    const canal = screen.getByRole("combobox", { name: "Canal" });
    expect(canal).toHaveValue("all");
    fireEvent.change(canal, { target: { value: "messenger" } });
    await waitFor(() =>
      expect(s.listConversations).toHaveBeenLastCalledWith(
        expect.objectContaining({ channel: "messenger" }),
        expect.anything(),
      ),
    );
    fireEvent.change(canal, { target: { value: "all" } });
    await waitFor(() => expect(s.listConversations.mock.calls.at(-1)?.[0]).not.toHaveProperty("channel"));
  });

  it("el filtro Comentarios pide solo chats nacidos de un comentario, de cualquier red", async () => {
    setup(ig());
    expect(await screen.findByText("Luz Mora")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Canal" }), { target: { value: "comments" } });
    await waitFor(() =>
      expect(s.listConversations).toHaveBeenLastCalledWith(
        expect.objectContaining({ comments: true }),
        expect.anything(),
      ),
    );
    expect(s.listConversations.mock.calls.at(-1)?.[0]).not.toHaveProperty("channel");
  });

  it("un chat de Instagram no muestra el identificador como teléfono y pide el número", async () => {
    setup(ig());
    fireEvent.click(await screen.findByText("Luz Mora"));
    await openClientTab();
    expect(await screen.findByText(/Pide el número al cliente para vincularlo/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(IG_ID);
    await waitFor(() => expect(s.listConversationOrders).toHaveBeenCalled());
    expect(fetchClient).not.toHaveBeenCalled();
    expect(screen.queryByText("Este número no está en Clientes")).not.toBeInTheDocument();
  });

  it("al guardar el teléfono lo manda como customerPhone y busca al cliente con ese número", async () => {
    s.updateConversation.mockResolvedValue(ig({ customerPhone: "+51 999 111 222" }));
    setup(ig());
    fireEvent.click(await screen.findByText("Luz Mora"));
    await openClientTab();
    fireEvent.change(await screen.findByLabelText("Teléfono del cliente"), {
      target: { value: "+51 999 111 222" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(s.updateConversation).toHaveBeenCalledWith("c1", { customerPhone: "+51 999 111 222" }),
    );
    await waitFor(() => expect(fetchClient).toHaveBeenCalledWith("co1", "999111222"));
    expect(document.body.textContent).not.toContain(IG_ID);
  });

  it("«Registrar venta completa» usa el teléfono guardado, no el identificador", async () => {
    setup(ig({ customerPhone: "988777666" }));
    fireEvent.click(await screen.findByText("Luz Mora"));
    fireEvent.click(await screen.findByRole("button", { name: /Registrar venta completa/ }));
    const url = new URL(mockPush.mock.calls[0][0], "http://x");
    expect(url.searchParams.get("crmPhone")).toBe("988777666");
  });

  it("con la ventana de 7 días vencida avisa del plazo de Messenger e Instagram", async () => {
    setup(ig({ windowExpiresAt: PAST }));
    fireEvent.click(await screen.findByText("Luz Mora"));
    expect(await screen.findByText(/Pasaron 7 días desde el último mensaje del cliente/)).toBeInTheDocument();
    expect(screen.queryByText(/Pasaron más de 24 h/)).not.toBeInTheDocument();
    expect(await screen.findByLabelText("Mensaje")).toBeDisabled();
  });

  it("con teléfono guardado «Llamar» es un enlace tel:", async () => {
    setup(ig({ customerPhone: "988777666" }));
    fireEvent.click(await screen.findByText("Luz Mora"));
    const link = await screen.findByRole("link", { name: /Llamar por teléfono/ });
    expect(link).toHaveAttribute("href", "tel:+51988777666");
  });

  it("sin teléfono guardado «Llamar» está desactivado", async () => {
    setup(ig());
    fireEvent.click(await screen.findByText("Luz Mora"));
    const btn = await screen.findByRole("button", { name: /Llamar por teléfono/ });
    expect(btn).toBeDisabled();
    expect(screen.queryByRole("link", { name: /Llamar por teléfono/ })).not.toBeInTheDocument();
  });
});
