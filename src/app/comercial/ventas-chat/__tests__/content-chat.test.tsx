import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Bandeja from "@/components/ventas-chat/Bandeja";
import { fillName, firstName, stepText } from "@/components/ventas-chat/ContentLib";
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
  s.listConversationOrders.mockResolvedValue([]);
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
    const bar = within(await screen.findByRole("region", { name: "Guion" }));
    fireEvent.click(await bar.findByRole("button", { name: /1\. Saludo/ }));
    expect(await box()).toHaveValue("Hola Ana, bienvenida\n¿Qué buscas?");
    await waitFor(() => expect(s.updateConversation).toHaveBeenCalledWith("c1", { scriptStep: 0 }));
    expect(s.sendMessage).not.toHaveBeenCalled();
  });

  it("el paso actual se ve resaltado", async () => {
    setup({ scriptStep: 1 });
    const bar = within(await screen.findByRole("region", { name: "Guion" }));
    expect(await bar.findByRole("button", { name: /2\. Precio/ })).toHaveAttribute("aria-current", "step");
    expect(bar.getByRole("button", { name: /1\. Saludo/ })).not.toHaveAttribute("aria-current");
  });

  it("con texto previo pide confirmación; cancelar conserva el texto y confirmar lo reemplaza", async () => {
    setup();
    const bar = within(await screen.findByRole("region", { name: "Guion" }));
    fireEvent.change(await box(), { target: { value: "algo que escribí" } });
    fireEvent.click(await bar.findByRole("button", { name: /2\. Precio/ }));
    let dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("¿Reemplazar lo que escribiste?");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(await box()).toHaveValue("algo que escribí");
    expect(s.updateConversation).not.toHaveBeenCalled();

    fireEvent.click(bar.getByRole("button", { name: /2\. Precio/ }));
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
    fireEvent.click(await screen.findByRole("button", { name: /Catálogo/ }));
    expect(await box()).toHaveValue("Catálogo: https://x.pe/cat.pdf");
    expect(s.sendMessage).not.toHaveBeenCalled();
  });

  it("con texto previo, el material se añade en otra línea sin borrar lo escrito", async () => {
    setup();
    fireEvent.change(await box(), { target: { value: "Mira esto" } });
    fireEvent.click(await screen.findByRole("button", { name: /Respuestas/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Catálogo/ }));
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
