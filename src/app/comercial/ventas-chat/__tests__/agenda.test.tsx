import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AgendaView from "@/components/ventas-chat/AgendaView";
import * as svc from "@/services/crmService";
import type { Task } from "@/types/crm";

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  usePathname: () => "/comercial/ventas-chat/agenda",
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { accessToken: "t", user: { id: "u1", name: "Jairo", role: "ADMIN" }, company: { id: "co1" } },
  }),
}));
jest.mock("@/config/permissions.config", () => ({
  hasAdminAccess: (role?: string) => role === "ADMIN",
}));
jest.mock("@/services/crmService", () => ({
  ...jest.requireActual("@/services/crmService"),
  listTasks: jest.fn(),
  createTask: jest.fn(),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
}));
const s = svc as jest.Mocked<typeof svc>;

// 2026-11-19 15:00 Lima
const NOW = new Date("2026-11-19T20:00:00.000Z").getTime();

const task = (over: Partial<Task> = {}): Task => ({
  id: "t1",
  conversationId: "c1",
  contactName: "Ana Pérez",
  contactPhone: "51999111222",
  type: "message",
  title: "Enviar cotización",
  note: "Pidió 2 unidades",
  dueAt: "2026-11-19T22:00:00.000Z",
  status: "pending",
  doneAt: null,
  assignedUserId: "u1",
  assignedUserName: "Jairo",
  createdByUserId: "u1",
  createdAt: "2026-11-18T10:00:00.000Z",
  ...over,
});

const PENDING = [
  task({ id: "venc", title: "Llamada vencida", type: "call", dueAt: "2026-11-18T15:00:00.000Z" }),
  task(),
  task({ id: "prox", title: "Retomar la próxima semana", type: "other", conversationId: null, dueAt: "2026-11-25T15:00:00.000Z" }),
];

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AgendaView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, "now").mockReturnValue(NOW);
  s.listTasks.mockImplementation(async (p) =>
    p.status === "pending" ? PENDING : [task({ id: "d1", title: "Ya enviada", status: "done", doneAt: "2026-11-19T18:00:00.000Z" })],
  );
  s.updateTask.mockResolvedValue(task({ status: "done" }));
  s.createTask.mockResolvedValue(task());
  s.deleteTask.mockResolvedValue(undefined);
  global.fetch = jest.fn(() => new Promise(() => {})) as unknown as typeof fetch;
});
afterEach(() => jest.restoreAllMocks());

describe("Agenda", () => {
  it("agrupa en Vencidas, Hoy y Próximas con tipo, nota y contacto", async () => {
    setup();
    const venc = within(await screen.findByRole("region", { name: "Vencidas" }));
    const hoy = within(screen.getByRole("region", { name: "Hoy" }));
    const prox = within(screen.getByRole("region", { name: "Próximas" }));
    expect(venc.getByText("Llamada vencida")).toBeInTheDocument();
    expect(venc.getByText("Llamada")).toBeInTheDocument();
    expect(hoy.getByText("Enviar cotización")).toBeInTheDocument();
    expect(hoy.getByText("Pidió 2 unidades")).toBeInTheDocument();
    expect(hoy.getByText("Hoy 17:00")).toBeInTheDocument();
    expect(hoy.getByText(/Ana Pérez/)).toBeInTheDocument();
    expect(prox.getByText("Retomar la próxima semana")).toBeInTheDocument();
    expect(s.listTasks).toHaveBeenCalledWith({ assigned: "me", status: "pending" });
  });

  it("«Abrir chat» solo aparece si la tarea tiene conversación", async () => {
    setup();
    await screen.findByText("Enviar cotización");
    expect(screen.getAllByRole("button", { name: "Abrir chat" })).toHaveLength(2);
    const hoy = within(screen.getByRole("region", { name: "Hoy" }));
    fireEvent.click(hoy.getByRole("button", { name: "Abrir chat" }));
    expect(mockPush).toHaveBeenCalledWith("/comercial/ventas-chat/bandeja?c=c1");
  });

  it("«Hecha» marca la tarea como hecha", async () => {
    setup();
    const hoy = within(await screen.findByRole("region", { name: "Hoy" }));
    fireEvent.click(hoy.getByRole("button", { name: "Hecha" }));
    await waitFor(() =>
      expect(s.updateTask).toHaveBeenCalledWith("t1", { status: "done" }),
    );
  });

  it("Mías/Todas cambia el filtro", async () => {
    setup();
    await screen.findByText("Enviar cotización");
    fireEvent.click(screen.getByRole("button", { name: "Todas" }));
    await waitFor(() =>
      expect(s.listTasks).toHaveBeenCalledWith({ assigned: "all", status: "pending" }),
    );
  });

  it("crea una tarea nueva en hora Lima", async () => {
    setup();
    await screen.findByText("Enviar cotización");
    fireEvent.click(screen.getByRole("button", { name: /Nueva tarea/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Título"), {
      target: { value: "Llamar a Luis" },
    });
    fireEvent.change(within(dialog).getByLabelText("Tipo"), { target: { value: "call" } });
    fireEvent.change(within(dialog).getByLabelText("Fecha y hora"), {
      target: { value: "2026-11-20T10:30" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Crear tarea" }));
    await waitFor(() =>
      expect(s.createTask).toHaveBeenCalledWith({
        type: "call",
        title: "Llamar a Luis",
        dueAt: "2026-11-20T15:30:00.000Z",
      }),
    );
  });

  it("reprogramar manda solo la fecha nueva", async () => {
    setup();
    const hoy = within(await screen.findByRole("region", { name: "Hoy" }));
    fireEvent.click(hoy.getByRole("button", { name: "Reprogramar" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Fecha y hora"), {
      target: { value: "2026-11-21T09:00" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(s.updateTask).toHaveBeenCalledWith("t1", { dueAt: "2026-11-21T14:00:00.000Z" }),
    );
  });

  it("eliminar pide confirmación", async () => {
    setup();
    const hoy = within(await screen.findByRole("region", { name: "Hoy" }));
    fireEvent.click(hoy.getByRole("button", { name: "Eliminar tarea Enviar cotización" }));
    expect(s.deleteTask).not.toHaveBeenCalled();
    const confirm = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirm).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(s.deleteTask).toHaveBeenCalledWith("t1"));
  });

  it("«Hechas» carga las tareas hechas solo al abrir", async () => {
    setup();
    await screen.findByText("Enviar cotización");
    expect(s.listTasks).not.toHaveBeenCalledWith(expect.objectContaining({ status: "done" }));
    fireEvent.click(screen.getByRole("button", { name: /Hechas/ }));
    expect(await screen.findByText("Ya enviada")).toBeInTheDocument();
    expect(s.listTasks).toHaveBeenCalledWith({ assigned: "me", status: "done" });
  });
});
