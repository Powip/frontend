import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Bandeja from "@/components/ventas-chat/Bandeja";
import { fillName, firstName, stepText } from "@/components/ventas-chat/ContentLib";
import { ENVIO_TEXT, PAGO_TEXT, dispatchText, windowHoursLeft } from "@/components/ventas-chat/ChatSaleGuide";
import axiosAuth from "@/lib/axiosAuth";
import * as svc from "@/services/crmService";
import * as content from "@/services/crmContentService";
import type { Conversation, Message } from "@/types/crm";
import type { Objection, Script, Sheet } from "@/types/crmContent";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { accessToken: "t", user: { id: "u1", name: "Jairo", surname: "R" }, company: { id: "co1" } },
  }),
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => "/comercial/ventas-chat/bandeja",
  useSearchParams: () => new URLSearchParams("c=c1"),
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
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() },
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
}));
jest.mock("@/services/crmContentService", () => ({
  ...jest.requireActual("@/services/crmContentService"),
  getScript: jest.fn(),
  listObjections: jest.fn(),
  listMaterials: jest.fn(),
  listSheets: jest.fn(),
  registerObjectionUse: jest.fn(),
}));
const s = svc as jest.Mocked<typeof svc>;
const c = content as jest.Mocked<typeof content>;
const detect = axiosAuth.post as jest.Mock;
import { fetchClientByPhone } from "@/services/clients.service";

beforeAll(() => {
  global.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

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
  lastMessagePreview: "Hola",
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
const msg: Message = {
  id: "m1",
  conversationId: "c1",
  direction: "in",
  type: "text",
  body: "Hola",
  status: "received",
  senderKind: "customer",
  senderUserId: null,
  senderName: null,
  errorMessage: null,
  createdAt: new Date().toISOString(),
};
const SCRIPT: Script = {
  steps: [
    { name: "Saludo", message: "Hola {nombre}, bienvenida", question: "¿Qué buscas?" },
    { name: "Precio", message: "Cuesta S/ 50", question: "" },
  ],
  version: 1,
  note: null,
  updatedAt: null,
  updatedByName: null,
  myReadVersion: 1,
};
const OBJ: Objection = {
  id: "o1",
  name: "Está caro",
  response: "Mira todo lo que incluye",
  position: 0,
  active: true,
  createdAt: "2026-11-01T00:00:00.000Z",
  proposedByName: null,
};
const SHEET: Sheet = {
  id: "s1",
  name: "Polo básico",
  price: "S/ 50",
  forWhom: "",
  highlights: "Algodón pima",
  alternatives: "",
  complements: "",
  active: true,
  materials: [{ id: "pm1", sheetId: "s1", kind: "photo", title: "Foto frontal", url: "https://x.pe/f.jpg", position: 0 }],
  updatedAt: "2026-11-18T15:00:00.000Z",
};

function setup(over: Partial<Conversation> = {}) {
  const c1 = conv(over);
  s.listConversations.mockResolvedValue({ items: [c1], total: 1, page: 1, limit: 30 });
  s.getConversation.mockResolvedValue(c1);
  s.listMessages.mockResolvedValue({ items: [msg], hasMore: false });
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Bandeja />
    </QueryClientProvider>,
  );
}
const box = () => screen.findByLabelText("Mensaje") as Promise<HTMLTextAreaElement>;

beforeEach(() => {
  jest.clearAllMocks();
  detect.mockReset();
  s.listConversationOrders.mockResolvedValue([]);
  s.listConversationQuotes.mockResolvedValue([]);
  s.listPipelines.mockResolvedValue([]);
  s.listTasks.mockResolvedValue([]);
  s.getPauSettings.mockRejectedValue(new Error("sin pau"));
  (fetchClientByPhone as jest.Mock).mockResolvedValue(null);
  s.updateConversation.mockResolvedValue(conv());
  c.getScript.mockResolvedValue(SCRIPT);
  c.listObjections.mockResolvedValue([OBJ, { ...OBJ, id: "o2", name: "Inactiva", active: false }]);
  c.listMaterials.mockResolvedValue([
    { id: "g1", sheetId: null, kind: "pdf", title: "Catálogo", url: "https://x.pe/cat.pdf", position: 0 },
  ]);
  c.listSheets.mockResolvedValue([SHEET]);
  c.registerObjectionUse.mockResolvedValue();
  global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
});

describe("ContentLib", () => {
  it("fillName reemplaza {nombre} y, sin nombre, limpia el marcador", () => {
    expect(firstName({ contactName: "  Ana  Pérez" })).toBe("Ana");
    expect(firstName({ contactName: null })).toBe("");
    expect(fillName("Hola {nombre}, hola", "Ana")).toBe("Hola Ana, hola");
    expect(fillName("Hola {nombre}!", "")).toBe("Hola!");
    expect(fillName("{nombre}, buenas", "")).toBe("buenas");
    expect(stepText({ name: "x", message: "Hola {nombre}", question: "¿Qué buscas?" }, "Ana")).toBe("Hola Ana\n¿Qué buscas?");
  });
});

describe("Chat · guion y respuestas", () => {
  it("sin guion, objeciones ni material no se pinta nada", async () => {
    c.getScript.mockResolvedValue({ ...SCRIPT, steps: [], version: 0 });
    c.listObjections.mockResolvedValue([]);
    c.listMaterials.mockResolvedValue([]);
    c.listSheets.mockResolvedValue([]);
    setup();
    await box();
    await waitFor(() => expect(c.getScript).toHaveBeenCalled());
    await waitFor(() => expect(c.listSheets).toHaveBeenCalled());
    expect(screen.queryByRole("region", { name: "Guion" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Respuestas/ })).not.toBeInTheDocument();
  });

  it("clic en un paso rellena la caja con el nombre, hace PATCH scriptStep y no envía", async () => {
    setup();
    const bar = within(await screen.findByRole("region", { name: "Venta en 1 minuto" }));
    fireEvent.click(await bar.findByRole("button", { name: "Paso 1: Saludo" }));
    expect(await box()).toHaveValue("Hola Ana, bienvenida\n¿Qué buscas?");
    await waitFor(() => expect(s.updateConversation).toHaveBeenCalledWith("c1", { scriptStep: 0 }));
    expect(s.sendMessage).not.toHaveBeenCalled();
  });

  it("el paso actual se ve resaltado", async () => {
    setup({ scriptStep: 1 });
    const bar = within(await screen.findByRole("region", { name: "Venta en 1 minuto" }));
    expect(await bar.findByRole("button", { name: "Paso 2: Precio" })).toHaveAttribute("aria-current", "step");
    expect(bar.getByRole("button", { name: "Paso 1: Saludo" })).not.toHaveAttribute("aria-current");
  });

  it("con texto previo pide confirmación; cancelar conserva el texto y confirmar lo reemplaza", async () => {
    setup();
    const bar = within(await screen.findByRole("region", { name: "Venta en 1 minuto" }));
    fireEvent.change(await box(), { target: { value: "algo que escribí" } });
    fireEvent.click(await bar.findByRole("button", { name: "Paso 2: Precio" }));
    let dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("¿Reemplazar lo que escribiste?");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(await box()).toHaveValue("algo que escribí");
    expect(s.updateConversation).not.toHaveBeenCalled();

    fireEvent.click(bar.getByRole("button", { name: "Paso 2: Precio" }));
    dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Reemplazar" }));
    expect(await box()).toHaveValue("Cuesta S/ 50");
    await waitFor(() => expect(s.updateConversation).toHaveBeenCalledWith("c1", { scriptStep: 1 }));
  });

  it("una objeción activa inserta su respuesta y registra el uso", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Respuestas/ }));
    const list = within(await screen.findByRole("region", { name: "Objeciones" }));
    expect(list.queryByText("Inactiva")).not.toBeInTheDocument();
    fireEvent.click(list.getByRole("button", { name: /Está caro/ }));
    expect(await box()).toHaveValue("Mira todo lo que incluye");
    await waitFor(() => expect(c.registerObjectionUse).toHaveBeenCalledWith("c1", "o1"));
    expect(s.sendMessage).not.toHaveBeenCalled();
  });

  it("un material del negocio inserta «título: url» en la caja", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Respuestas/ }));
    fireEvent.click(await within(await screen.findByRole("region", { name: "Material" })).findByRole("button", { name: /Catálogo/ }));
    expect(await box()).toHaveValue("Catálogo: https://x.pe/cat.pdf");
    expect(s.sendMessage).not.toHaveBeenCalled();
  });

  it("con texto previo, el material se añade en otra línea sin borrar lo escrito", async () => {
    setup();
    fireEvent.change(await box(), { target: { value: "Mira esto" } });
    fireEvent.click(await screen.findByRole("button", { name: /Respuestas/ }));
    fireEvent.click(await within(await screen.findByRole("region", { name: "Material" })).findByRole("button", { name: /Catálogo/ }));
    expect(await box()).toHaveValue("Mira esto\nCatálogo: https://x.pe/cat.pdf");
  });

  it("buscador de productos: precio, qué destacar y material de la ficha", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Respuestas/ }));
    fireEvent.change(await screen.findByLabelText("Buscar producto"), { target: { value: "polo" } });
    await waitFor(() => expect(c.listSheets).toHaveBeenCalledWith("polo"));
    const card = within(await screen.findByTestId("chat-sheet"));

    fireEvent.click(card.getByRole("button", { name: "Insertar precio de Polo básico" }));
    expect(await box()).toHaveValue("Polo básico: S/ 50");

    fireEvent.click(await screen.findByRole("button", { name: /Respuestas/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Insertar qué destacar de Polo básico" }));
    expect(await box()).toHaveValue("Polo básico: S/ 50\nAlgodón pima");

    fireEvent.click(await screen.findByRole("button", { name: /Respuestas/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Foto frontal/ }));
    expect(await box()).toHaveValue("Polo básico: S/ 50\nAlgodón pima\nFoto frontal: https://x.pe/f.jpg");
  });
});

describe("Chat · pantalla del mockup 152", () => {
  const RULES = { cutoffTime: "13:00", lastUnits: 3, instantReply: true, promo: "2x1 en polos hoy" };

  it("windowHoursLeft redondea hacia arriba y da 0 si cerró", () => {
    const now = Date.parse("2026-11-23T10:00:00.000Z");
    expect(windowHoursLeft({ windowExpiresAt: "2026-11-24T08:30:00.000Z" }, now)).toBe(23);
    expect(windowHoursLeft({ windowExpiresAt: "2026-11-23T09:00:00.000Z" }, now)).toBe(0);
    expect(windowHoursLeft({ windowExpiresAt: null }, now)).toBe(0);
  });

  it("dispatchText usa la hora de Lima contra la hora de corte", () => {
    // 15:00 UTC = 10:00 en Lima; 20:00 UTC = 15:00 en Lima.
    expect(dispatchText(RULES, new Date("2026-11-23T15:00:00.000Z"))).toBe("Despacho hoy si confirma antes de 13:00");
    expect(dispatchText(RULES, new Date("2026-11-23T20:00:00.000Z"))).toBe("Despacho mañana");
    expect(dispatchText({ cutoffTime: "" })).toBeNull();
  });

  it("barra «Venta en 1 minuto»: pasos hechos, actual con nombre y el resto solo número", async () => {
    setup({ scriptStep: 1 });
    const bar = within(await screen.findByRole("region", { name: "Venta en 1 minuto" }));
    const cur = await bar.findByRole("button", { name: "Paso 2: Precio" });
    expect(cur).toHaveAttribute("aria-current", "step");
    expect(cur).toHaveTextContent("Precio");
    expect(bar.getByRole("button", { name: "Paso 1: Saludo" })).not.toHaveTextContent("Saludo");
  });

  it("aviso de ventana abierta con horas que quedan y promo del día con «Ofrecer»", async () => {
    c.getScript.mockResolvedValue({ ...SCRIPT, closingRules: RULES } as Script);
    setup();
    expect(await screen.findByTestId("window-banner")).toHaveTextContent("Ventana abierta · quedan 3 h. Tus mensajes no tienen costo.");
    const promo = within(await screen.findByTestId("promo-banner"));
    expect(promo.getByText(/2x1 en polos hoy/)).toBeInTheDocument();
    fireEvent.click(promo.getByRole("button", { name: "Ofrecer" }));
    expect(await box()).toHaveValue("2x1 en polos hoy");
    expect(s.sendMessage).not.toHaveBeenCalled();
  });

  it("sin ventana no hay aviso verde ni promo", async () => {
    c.getScript.mockResolvedValue({ ...SCRIPT, closingRules: RULES } as Script);
    setup({ windowExpiresAt: new Date(Date.now() - 1000).toISOString() });
    await box();
    await waitFor(() => expect(c.getScript).toHaveBeenCalled());
    expect(screen.queryByTestId("window-banner")).not.toBeInTheDocument();
    expect(screen.queryByTestId("promo-banner")).not.toBeInTheDocument();
  });

  it("tarjeta «Sugerencia · paso N de M»: Usar llena la caja, Descartar la quita, nada se envía", async () => {
    setup({ scriptStep: 1 });
    const card = within(await screen.findByTestId("suggestion-card"));
    expect(card.getByText("Sugerencia · paso 2 de 2")).toBeInTheDocument();
    expect(card.getByText("Cuesta S/ 50")).toBeInTheDocument();
    expect(card.getByText(/Enviar también/)).toBeInTheDocument();
    fireEvent.click(card.getByRole("button", { name: "Usar" }));
    expect(await box()).toHaveValue("Cuesta S/ 50");
    expect(screen.queryByTestId("suggestion-card")).not.toBeInTheDocument();
    expect(s.sendMessage).not.toHaveBeenCalled();
  });

  it.each([
    ["llm", "IA"],
    ["mock", "Reglas"],
  ] as const)("la respuesta a la objeción dice de dónde sale: %s → %s", async (source, label) => {
    detect.mockResolvedValue({
      data: {
        objectionId: "o1",
        label: "Está caro",
        confidence: 0.9,
        suggestedResponse: "Mira todo lo que incluye",
        replySource: source === "llm" ? "llm" : "official",
        source,
        text: "muy caro",
      },
    });
    setup();
    const card = within(await screen.findByTestId("suggestion-card"));
    expect(await card.findByText("Responde la objeción del cliente")).toBeInTheDocument();
    expect(card.getByTestId("suggestion-source")).toHaveTextContent(label);
  });

  it("sin objeción la sugerencia sale del guion: Reglas", async () => {
    setup();
    const card = within(await screen.findByTestId("suggestion-card"));
    expect(card.getByTestId("suggestion-source")).toHaveTextContent("Reglas");
  });

  it("Descartar oculta la sugerencia sin tocar la caja", async () => {
    setup();
    const card = within(await screen.findByTestId("suggestion-card"));
    fireEvent.click(card.getByRole("button", { name: "Descartar" }));
    expect(screen.queryByTestId("suggestion-card")).not.toBeInTheDocument();
    expect(await box()).toHaveValue("");
  });

  it("atajos Guion · paso N, /envío y /pago dejan el texto en la caja", async () => {
    setup();
    const chips = within(await screen.findByTestId("quick-chips"));
    fireEvent.click(await chips.findByRole("button", { name: "Guion · paso 1" }));
    expect(await box()).toHaveValue("Hola Ana, bienvenida\n¿Qué buscas?");
    fireEvent.click(chips.getByRole("button", { name: "/envío" }));
    fireEvent.click(chips.getByRole("button", { name: "/pago" }));
    expect(await box()).toHaveValue(`Hola Ana, bienvenida\n¿Qué buscas?\n${ENVIO_TEXT}\n${PAGO_TEXT}`);
    expect(s.sendMessage).not.toHaveBeenCalled();
  });

  it("panel derecho con pestañas Pedido, Cliente y Seguimiento; abre en Pedido", async () => {
    setup();
    const aside = within(await screen.findByRole("complementary", { name: "Cliente y pedido" }));
    expect(await aside.findByRole("tab", { name: "Pedido" })).toHaveAttribute("aria-selected", "true");
    expect(aside.getByRole("button", { name: /Armar pedido leyendo el chat/ })).toBeInTheDocument();
    fireEvent.click(aside.getByRole("tab", { name: "Seguimiento" }));
    expect(aside.getByRole("tab", { name: "Seguimiento" })).toHaveAttribute("aria-selected", "true");
    expect(aside.queryByRole("button", { name: /Armar pedido leyendo el chat/ })).not.toBeInTheDocument();
  });
});
