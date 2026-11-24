import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import Bandeja from "@/components/ventas-chat/Bandeja";
import * as svc from "@/services/crmService";
import * as content from "@/services/crmContentService";
import type {
  Conversation,
  ConversationFollowup,
  InboxSummary,
  Message,
  Pipeline,
  PauSettings,
  Stage,
  Template,
} from "@/types/crm";

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
jest.mock("@/services/crmCallsService", () => ({
  listCalls: jest.fn().mockResolvedValue([]),
  getCallStats: jest.fn(),
  createCall: jest.fn(),
  deleteCall: jest.fn(),
}));
jest.mock("@/services/crmContentService", () => ({
  ...jest.requireActual("@/services/crmContentService"),
  proposeObjection: jest.fn(),
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
  getPauSettings: jest.fn(),
  getInboxSummary: jest.fn(),
  sendNote: jest.fn(),
  sendConversationTemplate: jest.fn(),
  listTemplates: jest.fn(),
  listTags: jest.fn(),
  listConversationFollowups: jest.fn(),
}));
const s = svc as jest.Mocked<typeof svc>;
const c = content as jest.Mocked<typeof content>;
import { fetchClientByPhone } from "@/services/clients.service";
const fetchClient = fetchClientByPhone as jest.Mock;

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
const summary = (over: Partial<InboxSummary> = {}): InboxSummary => ({
  slaMinutes: 15,
  open: 10,
  unanswered: 3,
  overSla: 1,
  mineUnanswered: 2,
  unassigned: 4,
  pauHelp: 0,
  thinking: 2,
  ...over,
});
const tpl = (over: Partial<Template> = {}): Template => ({
  name: "retomar",
  language: "es",
  category: "MARKETING",
  status: "APPROVED",
  bodyText: "Hola {{1}}, tu pedido {{2}} sigue disponible",
  variableCount: 2,
  ...over,
});
const stage = (id: string, name: string, position: number, kind: Stage["kind"] = "open"): Stage => ({
  id,
  pipelineId: "p1",
  name,
  color: "#22c55e",
  position,
  kind,
});
const pipeline: Pipeline = {
  id: "p1",
  name: "Ventas",
  isDefault: true,
  stages: [stage("s1", "Nuevo", 0), stage("s4", "Perdido", 1, "lost")],
};
const settings = (mode: PauSettings["mode"]): PauSettings => ({
  mode,
  instructions: "",
  knowledge: "",
  monthlyTokenCap: null,
  hasProvider: true,
});

function setup(cv: Conversation = conv(), messages: Message[] = [msg()]) {
  s.listConversations.mockResolvedValue({ items: [cv], total: 1, page: 1, limit: 30 });
  s.getConversation.mockResolvedValue(cv);
  s.listMessages.mockResolvedValue({ items: messages, hasMore: false });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Bandeja />
    </QueryClientProvider>,
  );
}
/** Panel derecho, en la pestaña indicada (Pedido, Cliente o Seguimiento). */
const panel = async (tab?: "Pedido" | "Cliente" | "Seguimiento") => {
  const aside = within(await screen.findByRole("complementary", { name: "Cliente y pedido" }));
  if (tab) fireEvent.click(await aside.findByRole("tab", { name: tab }));
  return aside;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = new URLSearchParams("c=c1");
  s.listConversationOrders.mockResolvedValue([]);
  s.listConversationQuotes.mockResolvedValue([]);
  s.listPipelines.mockResolvedValue([]);
  s.listTasks.mockResolvedValue([]);
  s.getPauSettings.mockResolvedValue(settings("off"));
  s.getInboxSummary.mockResolvedValue(summary());
  s.listTags.mockResolvedValue([]);
  s.listTemplates.mockResolvedValue([]);
  s.listConversationFollowups.mockResolvedValue([]);
  fetchClient.mockResolvedValue(null);
  s.updateConversation.mockResolvedValue(conv());
  global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
});

const lastListParams = () => s.listConversations.mock.calls[s.listConversations.mock.calls.length - 1][0];

describe("Indicadores de la Bandeja", () => {
  it("pinta los conteos, la nota de «tuyas» y el SLA", async () => {
    setup();
    const strip = within(await screen.findByRole("group", { name: "Indicadores de la bandeja" }));
    expect(strip.getByRole("button", { name: /Sin responder/ })).toHaveTextContent("3");
    expect(strip.getByRole("button", { name: /Sin responder/ })).toHaveTextContent("2 tuyas");
    expect(strip.getByRole("button", { name: /Fuera de tiempo/ })).toHaveTextContent("más de 15 min");
    expect(strip.getByRole("button", { name: /Sin asignar/ })).toHaveTextContent("4");
    expect(strip.getByRole("button", { name: /Pau pidió ayuda/ })).toHaveTextContent("0");
    expect(strip.getByRole("button", { name: /Lo están pensando/ })).toHaveTextContent("2");
  });

  it("al hacer clic filtra la lista con el parámetro y otro clic lo quita", async () => {
    setup();
    const strip = within(await screen.findByRole("group", { name: "Indicadores de la bandeja" }));
    await waitFor(() => expect(s.listConversations).toHaveBeenCalled());
    expect(lastListParams()).not.toHaveProperty("unanswered");

    fireEvent.click(strip.getByRole("button", { name: /Sin responder/ }));
    await waitFor(() => expect(lastListParams()).toMatchObject({ unanswered: true, status: "open" }));
    expect(strip.getByRole("button", { name: /Sin responder/ })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(strip.getByRole("button", { name: /Sin responder/ }));
    await waitFor(() => expect(lastListParams()).not.toHaveProperty("unanswered"));
    expect(strip.getByRole("button", { name: /Sin responder/ })).toHaveAttribute("aria-pressed", "false");
  });

  it.each([
    ["Fuera de tiempo", { overSla: true }],
    ["Pau pidió ayuda", { pauHelp: true }],
    ["Lo están pensando", { thinking: true }],
    ["Sin asignar", { assigned: "unassigned" }],
  ])("«%s» envía su filtro", async (name, expected) => {
    setup();
    const strip = within(await screen.findByRole("group", { name: "Indicadores de la bandeja" }));
    fireEvent.click(strip.getByRole("button", { name: new RegExp(name) }));
    await waitFor(() => expect(lastListParams()).toMatchObject(expected));
  });

  it("con todo en cero muestra «Todo al día»", async () => {
    s.getInboxSummary.mockResolvedValue(
      summary({ unanswered: 0, overSla: 0, mineUnanswered: 0, unassigned: 0, pauHelp: 0, thinking: 0 }),
    );
    setup();
    expect(await screen.findByText("Todo al día")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Indicadores de la bandeja" })).not.toBeInTheDocument();
  });

  it("«Links por cobrar» y «Cobrado hoy» van como tarjetas KPI", async () => {
    s.getInboxSummary.mockResolvedValue(
      summary({ pendingLinks: 2, pendingLinksAmount: 150, collectedToday: 80 }),
    );
    setup();
    const cobros = within(await screen.findByRole("group", { name: "Cobros del chat" }));
    expect(cobros.getByText("Links por cobrar").parentElement).toHaveTextContent("2");
    expect(cobros.getByText("Links por cobrar").parentElement).toHaveTextContent("S/ 150.00");
    expect(cobros.getByText("Cobrado hoy").parentElement).toHaveTextContent("S/ 80.00");
  });

  it("si el resumen falla no pinta la franja", async () => {
    s.getInboxSummary.mockRejectedValue(new Error("down"));
    setup();
    await screen.findByText("Ana Pérez");
    expect(screen.queryByRole("group", { name: "Indicadores de la bandeja" })).not.toBeInTheDocument();
    expect(screen.queryByText("Todo al día")).not.toBeInTheDocument();
  });
});

describe("Nota interna", () => {
  it("se escribe en modo «Nota interna», va a notes (no a messages) y se pinta distinta", async () => {
    s.sendNote.mockResolvedValue(
      msg({
        id: "n1",
        direction: "out",
        type: "note",
        body: "Revisar stock antes de ofrecer",
        status: "sent",
        senderKind: "agent",
        senderName: "Jairo R",
      }),
    );
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Nota interna/ }));
    expect(screen.getByText(/Solo la ve tu equipo/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nota interna"), { target: { value: "Revisar stock antes de ofrecer" } });
    fireEvent.click(screen.getByLabelText("Guardar nota"));
    await waitFor(() => expect(s.sendNote).toHaveBeenCalledWith("c1", "Revisar stock antes de ofrecer"));
    expect(s.sendMessage).not.toHaveBeenCalled();
    const note = await screen.findByTestId("internal-note");
    expect(note).toHaveTextContent("Nota interna · Jairo R");
    expect(note).toHaveTextContent("Revisar stock antes de ofrecer");
    expect(note.className).toContain("bg-crm-note");
    expect(note.className).not.toContain("bg-primary");
    expect(screen.queryByTestId("system-message")).not.toBeInTheDocument();
  });

  it("se puede guardar con la ventana de 24 h cerrada", async () => {
    s.sendNote.mockResolvedValue(msg({ id: "n2", direction: "out", type: "note", body: "Llamar mañana", senderKind: "agent" }));
    setup(conv({ windowExpiresAt: PAST }));
    fireEvent.click(await screen.findByRole("button", { name: /Nota interna/ }));
    const box = screen.getByLabelText("Nota interna");
    expect(box).not.toBeDisabled();
    fireEvent.change(box, { target: { value: "Llamar mañana" } });
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(s.sendNote).toHaveBeenCalledWith("c1", "Llamar mañana"));
  });

  it("un evento de nota existente se pinta con estilo propio", async () => {
    setup(conv(), [
      msg(),
      msg({ id: "n3", direction: "out", type: "note", body: "Pidió factura", senderKind: "agent", senderName: "Luis" }),
    ]);
    const note = await screen.findByTestId("internal-note");
    expect(note).toHaveTextContent("Pidió factura");
  });
});

describe("Plantilla con la ventana cerrada", () => {
  it("elige plantilla, rellena variables, ve la vista previa y envía el cuerpo correcto", async () => {
    s.listTemplates.mockResolvedValue([tpl(), tpl({ name: "pendiente", status: "PENDING" })]);
    s.sendConversationTemplate.mockResolvedValue(
      msg({ id: "t1", direction: "out", type: "template", senderKind: "agent", body: "Hola Ana, tu pedido ORD-1 sigue disponible", status: "sent" }),
    );
    setup(conv({ windowExpiresAt: PAST }));
    fireEvent.click(await screen.findByRole("button", { name: "Enviar plantilla" }));
    const dialog = within(await screen.findByRole("dialog"));
    const select = (await dialog.findByLabelText("Plantilla")) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).not.toContain("pendiente (es)");
    fireEvent.change(select, { target: { value: "retomar::es" } });
    expect(dialog.getByLabelText("Variable {{1}}")).toHaveValue("Ana");
    const send = dialog.getByRole("button", { name: "Enviar plantilla" });
    expect(send).toBeDisabled();
    fireEvent.change(dialog.getByLabelText("Variable {{2}}"), { target: { value: "ORD-1" } });
    expect(dialog.getByTestId("template-preview")).toHaveTextContent("Hola Ana, tu pedido ORD-1 sigue disponible");
    expect(dialog.getByText(/Meta cobra/)).toBeInTheDocument();
    expect(send).toBeEnabled();
    fireEvent.click(send);
    await waitFor(() =>
      expect(s.sendConversationTemplate).toHaveBeenCalledWith("c1", {
        templateName: "retomar",
        templateLanguage: "es",
        variables: ["Ana", "ORD-1"],
      }),
    );
    expect(await screen.findByText("Hola Ana, tu pedido ORD-1 sigue disponible")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("sin plantillas aprobadas lo dice y enlaza a Ajustes", async () => {
    s.listTemplates.mockResolvedValue([tpl({ status: "PENDING" })]);
    setup(conv({ windowExpiresAt: PAST }));
    fireEvent.click(await screen.findByRole("button", { name: "Enviar plantilla" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(await dialog.findByText(/No hay plantillas aprobadas/)).toBeInTheDocument();
    expect(dialog.getByRole("link", { name: "Ajustes" })).toHaveAttribute("href", "/comercial/ventas-chat/ajustes");
    expect(s.sendConversationTemplate).not.toHaveBeenCalled();
  });

  it("en Messenger no hay botón de plantilla y queda el aviso de 7 días", async () => {
    setup(conv({ channel: "messenger", windowExpiresAt: PAST }));
    expect(await screen.findByText(/Pasaron 7 días/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enviar plantilla" })).not.toBeInTheDocument();
  });

  it("con la ventana abierta no ofrece plantilla", async () => {
    setup();
    await screen.findByLabelText("Mensaje");
    expect(screen.queryByRole("button", { name: "Enviar plantilla" })).not.toBeInTheDocument();
  });
});

describe("Lo está pensando", () => {
  it("fija fecha y nota (hora Lima) con PATCH resumeAt", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Lo está pensando/ }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.change(dialog.getByLabelText("Retomar el"), { target: { value: "2099-01-10T09:00" } });
    fireEvent.change(dialog.getByLabelText(/Nota/), { target: { value: "Consulta con su esposo" } });
    fireEvent.click(dialog.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(s.updateConversation).toHaveBeenCalledWith("c1", {
        resumeAt: "2099-01-10T14:00:00.000Z",
        resumeNote: "Consulta con su esposo",
      }),
    );
  });

  it("no deja guardar una fecha pasada", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Lo está pensando/ }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.change(dialog.getByLabelText("Retomar el"), { target: { value: "2020-01-10T09:00" } });
    expect(dialog.getByRole("button", { name: "Guardar" })).toBeDisabled();
  });

  it("con resumeAt muestra la franja, «Retomar ahora» limpia la fecha y la lista lo marca", async () => {
    setup(conv({ resumeAt: "2099-01-10T14:00:00.000Z", resumeNote: "Consulta con su esposo" }));
    const banner = await screen.findByTestId("thinking-banner");
    expect(banner).toHaveTextContent("Lo está pensando · retomar el 10 de enero a las 09:00");
    expect(banner).toHaveTextContent("Consulta con su esposo");
    expect(screen.getByTestId("thinking-flag")).toHaveTextContent("Lo está pensando");
    fireEvent.click(within(banner).getByRole("button", { name: "Retomar ahora" }));
    await waitFor(() => expect(s.updateConversation).toHaveBeenCalledWith("c1", { resumeAt: null }));
  });
});

describe("Perdido desde el chat", () => {
  it("pide el motivo y mueve a la etapa perdida del embudo", async () => {
    s.listPipelines.mockResolvedValue([pipeline]);
    setup(conv({ pipelineId: "p1", stageId: "s1" }));
    fireEvent.click(await screen.findByRole("button", { name: /Perdido/ }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.click(dialog.getByRole("button", { name: "Sin stock" }));
    fireEvent.click(dialog.getByRole("button", { name: "Guardar motivo" }));
    await waitFor(() =>
      expect(s.updateConversation).toHaveBeenCalledWith("c1", { stageId: "s4", lostReason: "Sin stock" }),
    );
  });

  it("no aparece si el chat ya está en una etapa perdida", async () => {
    s.listPipelines.mockResolvedValue([pipeline]);
    setup(conv({ pipelineId: "p1", stageId: "s4", lostReason: "Precio" }));
    await screen.findByLabelText("Mensaje");
    await waitFor(() => expect(s.listPipelines).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /^Perdido/ })).not.toBeInTheDocument();
  });
});

describe("Enseñarle la respuesta a Pau", () => {
  const question = "¿Hacen envíos a provincia?";

  async function openTeach(mode: PauSettings["mode"] = "copilot") {
    s.getPauSettings.mockResolvedValue(settings(mode));
    setup(conv(), [msg({ body: question })]);
    fireEvent.click(await screen.findByRole("button", { name: "Enseñarle la respuesta" }));
    return within(await screen.findByRole("dialog"));
  }

  it("prellena la pregunta con el último mensaje del cliente y queda pendiente si no eres admin", async () => {
    c.proposeObjection.mockResolvedValue({
      id: "o1",
      name: question,
      response: "Sí, enviamos a todo el Perú",
      position: 0,
      active: false,
      createdAt: "2026-11-19T00:00:00.000Z",
      proposedByName: "Jairo R",
    });
    const dialog = await openTeach();
    expect(dialog.getByLabelText("Pregunta del cliente")).toHaveValue(question);
    fireEvent.change(dialog.getByLabelText("Respuesta oficial"), { target: { value: "Sí, enviamos a todo el Perú" } });
    fireEvent.click(dialog.getByRole("button", { name: "Enviar respuesta" }));
    await waitFor(() =>
      expect(c.proposeObjection).toHaveBeenCalledWith({ name: question, response: "Sí, enviamos a todo el Perú" }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/pendiente/)));
  });

  it("si queda activa (administrador) avisa que Pau ya la usa", async () => {
    c.proposeObjection.mockResolvedValue({
      id: "o2",
      name: question,
      response: "Sí",
      position: 0,
      active: true,
      createdAt: "2026-11-19T00:00:00.000Z",
      proposedByName: null,
    });
    const dialog = await openTeach("auto");
    fireEvent.change(dialog.getByLabelText("Respuesta oficial"), { target: { value: "Sí" } });
    fireEvent.click(dialog.getByRole("button", { name: "Enviar respuesta" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/Pau ya la usa/)));
  });

  it("con Pau apagado y sin pedir ayuda no hay botón", async () => {
    setup();
    await screen.findByLabelText("Mensaje");
    expect(screen.queryByRole("button", { name: "Enseñarle la respuesta" })).not.toBeInTheDocument();
  });

  it("con Pau apagado pero con pedido de ayuda sí se puede enseñar", async () => {
    setup(conv({ pauHelpReason: "No sé el costo del envío" }));
    expect(await screen.findByRole("button", { name: "Enseñarle la respuesta" })).toBeInTheDocument();
  });
});

describe("Etiquetas en el panel", () => {
  it("muestra chips, sugiere las ya usadas y añade con un clic", async () => {
    s.listTags.mockResolvedValue(["VIP", "Mayorista", "Reclamo"]);
    s.updateConversation.mockResolvedValue(conv({ tags: ["VIP", "Mayorista"] }));
    setup(conv({ tags: ["VIP"] }));
    const p = await panel("Cliente");
    expect(await p.findByText("VIP")).toBeInTheDocument();
    fireEvent.click(await p.findByRole("button", { name: "+ Mayorista" }));
    await waitFor(() => expect(s.updateConversation).toHaveBeenCalledWith("c1", { tags: ["VIP", "Mayorista"] }));
    expect(p.queryByRole("button", { name: "+ VIP" })).not.toBeInTheDocument();
  });

  it("añade una etiqueta nueva escrita a mano y no repite una existente", async () => {
    setup(conv({ tags: ["VIP"] }));
    const p = await panel("Cliente");
    const box = await p.findByLabelText("Nueva etiqueta");
    fireEvent.change(box, { target: { value: "vip" } });
    fireEvent.click(p.getByRole("button", { name: /Añadir/ }));
    expect(s.updateConversation).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: "  Urgente " } });
    fireEvent.click(p.getByRole("button", { name: /Añadir/ }));
    await waitFor(() => expect(s.updateConversation).toHaveBeenCalledWith("c1", { tags: ["VIP", "Urgente"] }));
  });

  it("quita una etiqueta", async () => {
    setup(conv({ tags: ["VIP", "Reclamo"] }));
    const p = await panel("Cliente");
    fireEvent.click(await p.findByRole("button", { name: "Quitar etiqueta VIP" }));
    await waitFor(() => expect(s.updateConversation).toHaveBeenCalledWith("c1", { tags: ["Reclamo"] }));
  });

  it("la lista muestra hasta 2 etiquetas por fila", async () => {
    mockParams = new URLSearchParams();
    setup(conv({ tags: ["A", "B", "C"] }));
    const tags = await screen.findByTestId("conv-tags");
    expect(tags).toHaveTextContent("A");
    expect(tags).toHaveTextContent("B");
    expect(tags).not.toHaveTextContent("C");
  });
});

describe("Próximos seguimientos en el panel", () => {
  const f = (over: Partial<ConversationFollowup> = {}): ConversationFollowup => ({
    ruleId: "r1",
    ruleName: "Seguimiento +2 h",
    objective: "sale",
    target: "customer",
    dueAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
    viaTemplate: false,
    ...over,
  });

  it("lista regla, objetivo y si saldrá por plantilla", async () => {
    s.listConversationFollowups.mockResolvedValue([
      f(),
      f({ ruleId: "r2", ruleName: "Cobranza día 2", objective: "collection", viaTemplate: true }),
    ]);
    setup();
    const p = await panel("Seguimiento");
    const items = await p.findAllByTestId("followup-item");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Seguimiento +2 h");
    expect(items[0]).toHaveTextContent("Venta");
    expect(items[0]).not.toHaveTextContent("plantilla");
    expect(items[1]).toHaveTextContent("Cobranza");
    expect(items[1]).toHaveTextContent("Saldrá por plantilla");
    expect(s.listConversationFollowups).toHaveBeenCalledWith("c1");
  });

  it("vacío muestra el mensaje", async () => {
    setup();
    const p = await panel("Seguimiento");
    expect(
      await p.findByText("No hay seguimientos automáticos programados para este chat."),
    ).toBeInTheDocument();
  });
});
