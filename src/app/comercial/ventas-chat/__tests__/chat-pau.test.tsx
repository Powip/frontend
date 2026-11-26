import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Bandeja from "@/components/ventas-chat/Bandeja";
import * as svc from "@/services/crmService";
import type { Conversation, Message, PauSettings } from "@/types/crm";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { accessToken: "t", user: { id: "u1", name: "Jairo", surname: "R" }, company: { id: "co1" } },
  }),
}));
let mockParams = new URLSearchParams("c=c1");
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => "/comercial/ventas-chat/bandeja",
  useSearchParams: () => mockParams,
}));
jest.mock("@/services/clients.service", () => ({
  fetchClientByPhone: jest.fn(),
  createClient: jest.fn(),
}));
jest.mock("@/components/modals/PaymentVerificationModal", () => ({
  __esModule: true,
  default: () => <div />,
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
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
  getPauSettings: jest.fn(),
  suggestPauReply: jest.fn(),
}));
const s = svc as jest.Mocked<typeof svc>;
import { fetchClientByPhone } from "@/services/clients.service";
const fetchClient = fetchClientByPhone as jest.Mock;

const FUTURE = new Date(Date.now() + 3 * 3600_000).toISOString();

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
  pauEnabled: true,
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
const settings = (mode: PauSettings["mode"]): PauSettings => ({
  mode,
  instructions: "",
  knowledge: "",
  monthlyTokenCap: null,
  hasProvider: true,
});

function setup(c: Conversation, mode: PauSettings["mode"], messages: Message[] = [msg()]) {
  s.getPauSettings.mockResolvedValue(settings(mode));
  s.listConversations.mockResolvedValue({ items: [c], total: 1, page: 1, limit: 30 });
  s.getConversation.mockResolvedValue(c);
  s.listMessages.mockResolvedValue({ items: messages, hasMore: false });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Bandeja />
    </QueryClientProvider>,
  );
}

const bar = async () => within(await screen.findByRole("region", { name: "Pau" }));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = new URLSearchParams("c=c1");
  s.listConversationOrders.mockResolvedValue([]);
  s.listConversationQuotes.mockResolvedValue([]);
  s.listPipelines.mockResolvedValue([]);
  s.listTasks.mockResolvedValue([]);
  fetchClient.mockResolvedValue(null);
  s.updateConversation.mockResolvedValue(conv());
  global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
});

describe("Chat · barra de Pau", () => {
  it("con Pau apagado no se pinta", async () => {
    setup(conv(), "off");
    await screen.findByLabelText("Mensaje");
    await waitFor(() => expect(s.getPauSettings).toHaveBeenCalled());
    expect(screen.queryByRole("region", { name: "Pau" })).not.toBeInTheDocument();
  });

  it("si no se puede leer el modo, no se pinta", async () => {
    s.getPauSettings.mockRejectedValue(new Error("boom"));
    s.listConversations.mockResolvedValue({ items: [conv()], total: 1, page: 1, limit: 30 });
    s.getConversation.mockResolvedValue(conv());
    s.listMessages.mockResolvedValue({ items: [msg()], hasMore: false });
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Bandeja />
      </QueryClientProvider>,
    );
    await screen.findByLabelText("Mensaje");
    expect(screen.queryByRole("region", { name: "Pau" })).not.toBeInTheDocument();
  });

  it("modo auto con pauEnabled: «Pau responde este chat» y botón Tomar que hace PATCH", async () => {
    setup(conv({ pauEnabled: true }), "auto");
    const b = await bar();
    expect(b.getByTestId("pau-status")).toHaveTextContent("Pau responde este chat");
    fireEvent.click(b.getByRole("button", { name: "Tomar" }));
    await waitFor(() => expect(s.updateConversation).toHaveBeenCalledWith("c1", { pauEnabled: false }));
  });

  it("modo auto en pausa: «Pau en pausa · atiendes tú» y Devolver a Pau hace PATCH", async () => {
    setup(conv({ pauEnabled: false }), "auto");
    const b = await bar();
    expect(b.getByTestId("pau-status")).toHaveTextContent("Pau en pausa · atiendes tú");
    fireEvent.click(b.getByRole("button", { name: "Devolver a Pau" }));
    await waitFor(() => expect(s.updateConversation).toHaveBeenCalledWith("c1", { pauEnabled: true }));
  });

  it("modo copiloto: sin Tomar/Devolver, con Sugerir respuesta", async () => {
    setup(conv({ pauEnabled: false }), "copilot");
    const b = await bar();
    expect(b.queryByRole("button", { name: "Tomar" })).not.toBeInTheDocument();
    expect(b.queryByRole("button", { name: "Devolver a Pau" })).not.toBeInTheDocument();
    expect(b.getByRole("button", { name: "Sugerir respuesta" })).toBeInTheDocument();
  });

  it("aviso destacado cuando Pau pidió ayuda", async () => {
    setup(conv({ pauEnabled: false, pauHelpReason: "Pide factura con RUC" }), "auto");
    const b = await bar();
    expect(b.getByRole("alert")).toHaveTextContent("Pau pidió ayuda: Pide factura con RUC");
  });

  it("Sugerir respuesta pone el texto en la caja y NO lo envía", async () => {
    s.suggestPauReply.mockResolvedValue({ text: "Hola Ana, el precio es S/ 99." });
    setup(conv(), "copilot");
    const b = await bar();
    fireEvent.click(b.getByRole("button", { name: "Sugerir respuesta" }));
    await waitFor(() => expect(s.suggestPauReply).toHaveBeenCalledWith("c1"));
    await waitFor(() =>
      expect(screen.getByLabelText("Mensaje")).toHaveValue("Hola Ana, el precio es S/ 99."),
    );
    expect(s.sendMessage).not.toHaveBeenCalled();
  });

  it("muestra «Pau está escribiendo…» mientras espera", async () => {
    let resolve: (v: { text: string }) => void = () => {};
    s.suggestPauReply.mockReturnValue(new Promise((r) => (resolve = r)));
    setup(conv(), "copilot");
    const b = await bar();
    fireEvent.click(b.getByRole("button", { name: "Sugerir respuesta" }));
    expect(await b.findByText("Pau está escribiendo…")).toBeInTheDocument();
    expect(b.getByRole("button", { name: "Sugerir respuesta" })).toBeDisabled();
    resolve({ text: "ok" });
    await waitFor(() => expect(screen.getByLabelText("Mensaje")).toHaveValue("ok"));
  });

  it("si la caja ya tiene texto, pregunta antes de reemplazar (y no llama sin confirmar)", async () => {
    s.suggestPauReply.mockResolvedValue({ text: "Sugerencia de Pau" });
    setup(conv(), "copilot");
    fireEvent.change(await screen.findByLabelText("Mensaje"), { target: { value: "Mi borrador" } });
    const b = await bar();
    fireEvent.click(b.getByRole("button", { name: "Sugerir respuesta" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(s.suggestPauReply).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.getByLabelText("Mensaje")).toHaveValue("Mi borrador");

    fireEvent.click(b.getByRole("button", { name: "Sugerir respuesta" }));
    fireEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Reemplazar y sugerir" }),
    );
    await waitFor(() => expect(screen.getByLabelText("Mensaje")).toHaveValue("Sugerencia de Pau"));
    expect(s.sendMessage).not.toHaveBeenCalled();
  });

  it("error de Pau se muestra con el mensaje del servidor", async () => {
    const { toast } = jest.requireMock("sonner") as { toast: { error: jest.Mock } };
    const AxiosError = (jest.requireActual("axios") as typeof import("axios")).AxiosError;
    s.suggestPauReply.mockRejectedValue(
      new AxiosError("x", "ERR", undefined, undefined, {
        status: 409,
        data: { code: "PAU_CAP_REACHED", message: "Se alcanzó el tope mensual de Pau" },
      } as never),
    );
    setup(conv(), "copilot");
    const b = await bar();
    fireEvent.click(b.getByRole("button", { name: "Sugerir respuesta" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Se alcanzó el tope mensual de Pau"));
  });

  it("con la ventana de 24 h cerrada, sugerir queda desactivado", async () => {
    setup(conv({ windowExpiresAt: new Date(Date.now() - 3600_000).toISOString() }), "copilot");
    const b = await bar();
    expect(b.getByRole("button", { name: "Sugerir respuesta" })).toBeDisabled();
  });
});

describe("Chat · burbuja y lista", () => {
  it("mensaje de Pau lleva etiqueta «Pau» (aunque no tenga senderName) y no «Automático»", async () => {
    setup(conv(), "auto", [
      msg(),
      msg({
        id: "m2",
        direction: "out",
        body: "Hola, soy Pau",
        status: "sent",
        senderKind: "pau",
        senderName: null,
      }),
    ]);
    const label = await screen.findByTestId("pau-label");
    expect(label).toHaveTextContent("Pau");
    expect(screen.queryByText(/Automático/)).not.toBeInTheDocument();
    expect(screen.getByText("Hola, soy Pau")).toBeInTheDocument();
  });

  it("la lista marca con «Pau pidió ayuda» los chats con motivo", async () => {
    setup(conv({ pauHelpReason: "No sé el precio" }), "auto");
    const flag = await screen.findByTestId("pau-help-flag");
    expect(flag).toHaveTextContent("Pau pidió ayuda");
    expect(flag).toHaveAttribute("title", "No sé el precio");
  });

  it("sin motivo no hay marca en la lista", async () => {
    setup(conv(), "auto");
    await screen.findByLabelText("Mensaje");
    expect(screen.queryByTestId("pau-help-flag")).not.toBeInTheDocument();
  });
});
