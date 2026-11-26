import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LlamadasView from "@/components/ventas-chat/LlamadasView";
import { callContact } from "@/components/ventas-chat/calls";
import { VENTAS_CHAT_TABS } from "@/app/comercial/ventas-chat/tabs";
import * as crm from "@/services/crmService";
import * as callsSvc from "@/services/crmCallsService";
import * as sessions from "@/services/crmCallSessionsService";
import { toast } from "sonner";
import type { Task } from "@/types/crm";
import type { Call, CallStats } from "@/types/crmCalls";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  usePathname: () => "/comercial/ventas-chat/llamadas",
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { accessToken: "t", user: { id: "u1", name: "Jairo", role: "VENTAS" }, company: { id: "co1" } },
  }),
}));
jest.mock("@/config/permissions.config", () => ({
  hasAdminAccess: (role?: string) => role === "ADMIN",
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/services/crmService", () => ({
  ...jest.requireActual("@/services/crmService"),
  listTasks: jest.fn(),
  updateTask: jest.fn(),
}));
jest.mock("@/services/crmCallsService", () => ({
  listCalls: jest.fn(),
  getCallStats: jest.fn(),
  listCallProspects: jest.fn(),
  createCall: jest.fn(),
  deleteCall: jest.fn(),
}));
jest.mock("@/services/crmCallSessionsService", () => ({
  ...jest.requireActual("@/services/crmCallSessionsService"),
  getCallPermission: jest.fn(),
}));
const permission = sessions.getCallPermission as jest.Mock;
const s = crm as jest.Mocked<typeof crm>;
const c = callsSvc as jest.Mocked<typeof callsSvc>;

const stats = (over: Partial<CallStats> = {}): CallStats => ({
  days: 1,
  calls: 10,
  answered: 7,
  sold: 2,
  callback: 3,
  noAnswer: 3,
  notInterested: 1,
  totalMinutes: 42,
  byUser: [],
  ...over,
});

const task = (over: Partial<Task> = {}): Task => ({
  id: "t1",
  conversationId: "c1",
  contactName: "Ana Pérez",
  contactPhone: "51999111222",
  type: "call",
  title: "Llamar para cerrar",
  note: null,
  dueAt: "2026-11-20T15:00:00.000Z",
  status: "pending",
  doneAt: null,
  assignedUserId: "u1",
  assignedUserName: "Jairo",
  createdByUserId: "u1",
  createdAt: "2026-11-19T10:00:00.000Z",
  ...over,
});

const call = (over: Partial<Call> = {}): Call => ({
  id: "k1",
  conversationId: "c1",
  contactName: "Ana Pérez",
  contactPhone: "51999111222",
  userId: "u1",
  userName: "Jairo",
  direction: "out",
  result: "sold",
  durationSeconds: 130,
  notes: "Compró 2 unidades",
  createdAt: "2026-11-19T15:00:00.000Z",
  ...over,
});

beforeAll(() => {
  global.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <LlamadasView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  c.getCallStats.mockResolvedValue(stats());
  c.listCallProspects.mockResolvedValue([]);
  permission.mockResolvedValue({ status: "none", expiresAt: null, canCall: false, canRequest: true, simulated: true });
  c.listCalls.mockResolvedValue([call()]);
  c.createCall.mockResolvedValue(call());
  c.deleteCall.mockResolvedValue(undefined);
  s.listTasks.mockResolvedValue([task(), task({ id: "t2", type: "message", title: "Enviar cotización" })]);
  s.updateTask.mockResolvedValue(task({ status: "done" }));
  global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
});

describe("Pestaña Llamadas", () => {
  it("está después de Bandeja y la ven todos", () => {
    const labels = VENTAS_CHAT_TABS.map((t) => t.label);
    expect(labels.indexOf("Llamadas")).toBe(labels.indexOf("Bandeja") + 1);
    expect(VENTAS_CHAT_TABS.find((t) => t.label === "Llamadas")).toMatchObject({
      href: "/comercial/ventas-chat/llamadas",
    });
    expect(VENTAS_CHAT_TABS.find((t) => t.label === "Llamadas")?.adminOnly).toBeFalsy();
  });

  it("explica que se llama por WhatsApp desde Powip y que las del teléfono se registran a mano", async () => {
    setup();
    expect(await screen.findByRole("note")).toHaveTextContent(/Contesta y haz llamadas por WhatsApp desde Powip.*registras a mano/);
  });

  it("muestra los KPIs y cambia de periodo", async () => {
    setup();
    expect(await screen.findByTestId("kpi-calls")).toHaveTextContent("Llamadas hoy10");
    expect(screen.getByTestId("kpi-calls")).toHaveTextContent("7 contestadas (70 %)");
    expect(screen.getByTestId("kpi-sold")).toHaveTextContent("2");
    expect(screen.getByTestId("kpi-sold")).toHaveTextContent(/S\/\s?0(\.00)? cobrado/);
    expect(screen.getByTestId("kpi-minutes")).toHaveTextContent("42 min");
    expect(screen.getByTestId("kpi-minutes")).toHaveTextContent("Promedio 6 min 0 s por llamada");
    expect(screen.getByTestId("kpi-meta")).toHaveTextContent("Minutos que cobra Meta0 min");
    expect(c.getCallStats).toHaveBeenCalledWith(1);
    fireEvent.click(within(screen.getByRole("group", { name: "Periodo" })).getByRole("button", { name: "7 días" }));
    await waitFor(() => expect(c.getCallStats).toHaveBeenCalledWith(7));
    await waitFor(() => expect(c.listCalls).toHaveBeenCalledWith({ days: 7, mine: true }));
  });

  it("la cola solo trae tareas de llamada con Llamar, Abrir chat y Registrar resultado", async () => {
    setup();
    const queue = within(await screen.findByRole("region", { name: "Cola de llamadas" }));
    const rows = await queue.findAllByTestId("queue-row");
    expect(rows).toHaveLength(1);
    expect(s.listTasks).toHaveBeenCalledWith({ assigned: "me", status: "pending" });
    expect(within(rows[0]).getByText("Llamar para cerrar")).toBeInTheDocument();
    expect(within(rows[0]).getByRole("link", { name: /Llamar/ })).toHaveAttribute("href", "tel:+51999111222");
    fireEvent.click(within(rows[0]).getByRole("button", { name: "Chat" }));
    expect(mockPush).toHaveBeenCalledWith("/comercial/ventas-chat/bandeja?c=c1");
  });

  it("registrar el resultado de la cola crea la llamada y marca la tarea hecha", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Registrar resultado" }));
    const dlg = within(await screen.findByRole("dialog"));
    fireEvent.change(dlg.getByLabelText("Resultado"), { target: { value: "sold" } });
    fireEvent.change(dlg.getByLabelText("Notas (opcional)"), { target: { value: "Pagó por Yape" } });
    fireEvent.click(dlg.getByRole("button", { name: "Guardar llamada" }));
    await waitFor(() =>
      expect(c.createCall).toHaveBeenCalledWith({
        conversationId: "c1",
        direction: "out",
        result: "sold",
        notes: "Pagó por Yape",
      }),
    );
    await waitFor(() => expect(s.updateTask).toHaveBeenCalledWith("t1", { status: "done" }));
  });

  it("«Volver a llamar» exige fecha y manda callbackAt en hora de Lima", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Registrar resultado" }));
    const dlg = within(await screen.findByRole("dialog"));
    fireEvent.change(dlg.getByLabelText("Resultado"), { target: { value: "callback" } });
    const save = dlg.getByRole("button", { name: "Guardar llamada" });
    expect(save).toBeDisabled();
    fireEvent.change(dlg.getByLabelText(/Volver a llamar el/), { target: { value: "2026-11-21T10:00" } });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() =>
      expect(c.createCall).toHaveBeenCalledWith({
        conversationId: "c1",
        direction: "out",
        result: "callback",
        callbackAt: "2026-11-21T15:00:00.000Z",
      }),
    );
  });

  it("«Registrar llamada» sin chat pide el teléfono y manda la duración en segundos", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Registrar llamada" }));
    const dlg = within(await screen.findByRole("dialog"));
    const save = dlg.getByRole("button", { name: "Guardar llamada" });
    expect(save).toBeDisabled();
    fireEvent.change(dlg.getByLabelText("Teléfono"), { target: { value: " +51 988 777 666 " } });
    fireEvent.change(dlg.getByLabelText("Tipo de llamada"), { target: { value: "in" } });
    fireEvent.change(dlg.getByLabelText("Minutos"), { target: { value: "2" } });
    fireEvent.change(dlg.getByLabelText("Segundos"), { target: { value: "10" } });
    fireEvent.click(save);
    await waitFor(() =>
      expect(c.createCall).toHaveBeenCalledWith({
        phone: "+51 988 777 666",
        direction: "in",
        result: "no_answer",
        durationSeconds: 130,
      }),
    );
    // Sin la tarea de la cola no se marca nada como hecho.
    expect(s.updateTask).not.toHaveBeenCalled();
  });

  it("el historial muestra resultado, duración, notas y quién; eliminar pide confirmación", async () => {
    setup();
    const row = await screen.findByTestId("call-row");
    expect(within(row).getByText("Vendido")).toBeInTheDocument();
    expect(row).toHaveTextContent("Hecha · 2 min 10 s · Jairo");
    expect(within(row).getByText("Compró 2 unidades")).toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: "Chat" }));
    expect(mockPush).toHaveBeenCalledWith("/comercial/ventas-chat/bandeja?c=c1");
    fireEvent.click(within(row).getByRole("button", { name: "Eliminar llamada con Ana Pérez" }));
    expect(c.deleteCall).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(c.deleteCall).toHaveBeenCalled());
    expect(c.deleteCall.mock.calls[0][0]).toBe("k1");
  });

  it("sin nombre, el historial oculta el teléfono a quien no puede verlo completo", () => {
    const sinNombre = { contactName: null, contactPhone: "51999111222" };
    expect(callContact(sinNombre, true)).toBe("+51 999 *** 222");
    expect(callContact(sinNombre)).toBe("51999111222");
    expect(callContact({ contactName: null, contactPhone: null }, true)).toBe("Sin contacto");
  });

  it("no ofrece eliminar llamadas de otra persona si no eres administrador", async () => {
    c.listCalls.mockResolvedValue([call({ userId: "u2", userName: "Luis" })]);
    setup();
    const row = await screen.findByTestId("call-row");
    expect(within(row).queryByRole("button", { name: /Eliminar llamada/ })).not.toBeInTheDocument();
  });

  it("si el servicio falla lo dice con un botón para reintentar", async () => {
    c.getCallStats.mockRejectedValue(new Error("ms-crm caído"));
    setup();
    const alerts = await screen.findAllByRole("alert");
    expect(alerts.some((a) => /ms-crm caído/.test(a.textContent ?? ""))).toBe(true);
  });
});

describe("Cola por probabilidad de compra", () => {
  const prospect = { conversationId: "c5", reason: "link" as const, contactName: "Rosa", contactPhone: "51988777666", assignedUserName: "Laura", total: 89 };
  const queue = async () => within(await screen.findByRole("region", { name: "Cola de llamadas" }));

  it("pone los chats por llamar después de las agendadas", async () => {
    c.listCallProspects.mockResolvedValue([prospect]);
    setup();
    await waitFor(async () => expect((await queue()).getAllByTestId("queue-row")).toHaveLength(2));
    const rows = (await queue()).getAllByTestId("queue-row");
    expect(rows[0]).toHaveTextContent("Ana Pérez");
    expect(rows[1]).toHaveTextContent("Rosa");
    expect(rows[1]).toHaveTextContent("Link sin pagar · S/ 89.00");
  });

  it("vacía explica cuándo aparecen y no deja empezar sin avisar", async () => {
    s.listTasks.mockResolvedValue([]);
    setup();
    expect(await screen.findByText("No hay llamadas pendientes.")).toBeInTheDocument();
  });

  it("«Empezar a llamar» avisa si nadie de la cola aceptó llamadas", async () => {
    setup();
    await (await queue()).findAllByTestId("queue-row");
    fireEvent.click(screen.getByRole("button", { name: /Empezar a llamar/ }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Ningún cliente de la cola aceptó llamadas todavía."),
    );
    expect(permission).toHaveBeenCalledWith("c1");
  });
});
