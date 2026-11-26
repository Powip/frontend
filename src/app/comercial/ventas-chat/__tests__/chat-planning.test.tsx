import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PipelineSection, TasksSection } from "@/components/ventas-chat/ChatPlanningSections";
import * as svc from "@/services/crmService";
import type { Conversation, Pipeline, Stage, Task } from "@/types/crm";

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
  listPipelines: jest.fn(),
  listTasks: jest.fn(),
  createTask: jest.fn(),
  updateTask: jest.fn(),
  updateConversation: jest.fn(),
}));
const s = svc as jest.Mocked<typeof svc>;

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
  stages: [stage("s1", "Nuevo", 0), stage("s2", "Cotizado", 1), stage("s4", "Perdido", 2, "lost")],
};
const conv: Conversation = {
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
  lastMessageAt: null,
  lastMessagePreview: null,
  lastMessageDirection: null,
  lastInboundAt: null,
  windowExpiresAt: null,
  createdAt: "2026-11-19T10:00:00.000Z",
  pipelineId: "p1",
  stageId: "s1",
  stageChangedAt: null,
  lostReason: null,
  marketingOptOut: false,
  pauEnabled: false,
  pauHelpReason: null,
  scriptStep: null,
  resumeAt: null,
  resumeNote: null,
  tags: [],
};
const task: Task = {
  id: "t1",
  conversationId: "c1",
  contactName: "Ana Pérez",
  contactPhone: "51999111222",
  type: "call",
  title: "Llamar mañana",
  note: null,
  dueAt: "2026-11-20T15:00:00.000Z",
  status: "pending",
  doneAt: null,
  assignedUserId: "u1",
  assignedUserName: "Jairo",
  createdByUserId: "u1",
  createdAt: "2026-11-19T10:00:00.000Z",
};

function setup(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  s.listPipelines.mockResolvedValue([pipeline]);
  s.listTasks.mockResolvedValue([task]);
  s.updateConversation.mockResolvedValue(conv);
  s.updateTask.mockResolvedValue({ ...task, status: "done" });
  s.createTask.mockResolvedValue(task);
});

describe("Panel del chat · Embudo", () => {
  it("muestra la etapa actual y cambia con el selector", async () => {
    setup(<PipelineSection conversation={conv} />);
    const select = (await screen.findByLabelText("Etapa de la conversación")) as HTMLSelectElement;
    await waitFor(() => expect(select.value).toBe("s1"));
    fireEvent.change(select, { target: { value: "s2" } });
    await waitFor(() => expect(s.updateConversation).toHaveBeenCalledWith("c1", { stageId: "s2" }));
  });

  it("una etapa perdida pide el motivo", async () => {
    setup(<PipelineSection conversation={conv} />);
    const select = await screen.findByLabelText("Etapa de la conversación");
    await waitFor(() => expect(within(select).getAllByRole("option")).toHaveLength(3));
    fireEvent.change(select, { target: { value: "s4" } });
    expect(s.updateConversation).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Sin stock" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Guardar motivo" }));
    await waitFor(() =>
      expect(s.updateConversation).toHaveBeenCalledWith("c1", {
        stageId: "s4",
        lostReason: "Sin stock",
      }),
    );
  });

  it("sin etapa usa el embudo por defecto y muestra «Sin etapa»", async () => {
    setup(<PipelineSection conversation={{ ...conv, pipelineId: null, stageId: null }} />);
    expect(await screen.findByRole("option", { name: "Sin etapa" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Cotizado" })).toBeInTheDocument();
  });
});

describe("Panel del chat · Tareas", () => {
  it("lista las pendientes de la conversación", async () => {
    setup(<TasksSection conversation={conv} />);
    expect(await screen.findByText("Llamar mañana")).toBeInTheDocument();
    expect(s.listTasks).toHaveBeenCalledWith({
      assigned: "all",
      status: "pending",
      conversationId: "c1",
    });
  });

  it("marca una tarea como hecha", async () => {
    setup(<TasksSection conversation={conv} />);
    fireEvent.click(await screen.findByLabelText("Marcar hecha: Llamar mañana"));
    await waitFor(() => expect(s.updateTask).toHaveBeenCalledWith("t1", { status: "done" }));
  });

  it("«Recordatorio» crea una tarea ya vinculada a la conversación", async () => {
    setup(<TasksSection conversation={conv} />);
    await screen.findByText("Llamar mañana");
    fireEvent.click(screen.getByRole("button", { name: /Recordatorio/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Título"), {
      target: { value: "Confirmar pago" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Crear tarea" }));
    await waitFor(() =>
      expect(s.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: "c1", title: "Confirmar pago", type: "message" }),
      ),
    );
  });
});
