import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EquipoView, { goalPercent } from "@/components/ventas-chat/EquipoView";
import * as crmService from "@/services/crmService";
import * as teamService from "@/services/crmTeamService";
import type { Conversation } from "@/types/crm";
import type { TeamMember, TeamStats } from "@/types/crmTeam";

let mockRole = "ADMIN";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { accessToken: "t", user: { id: "u1", name: "Jairo", role: mockRole }, company: { id: "co1" } },
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
  updateConversation: jest.fn(),
}));
jest.mock("@/services/crmTeamService", () => ({
  ...jest.requireActual("@/services/crmTeamService"),
  getTeamStats: jest.fn(),
  listTeamMembers: jest.fn(),
  setDailyGoal: jest.fn(),
}));
const team = teamService as jest.Mocked<typeof teamService>;
const crm = crmService as jest.Mocked<typeof crmService>;

const conv = (over: Partial<Conversation> = {}) =>
  ({
    id: "c1",
    channel: "whatsapp",
    contactPhone: "+51900000001",
    contactName: "Rosa Quispe",
    status: "open",
    assignedUserId: "u1",
    assignedUserName: "Ana",
    ...over,
  }) as Conversation;

const member = (over: Partial<TeamMember> = {}): TeamMember => ({
  userId: "u1",
  userName: "Ana",
  kind: "agent",
  openAssigned: 5,
  unanswered: 1,
  messagesSent: 40,
  avgFirstResponseMinutes: 12,
  won: 3,
  lost: 1,
  ordersLinked: 2,
  pendingTasks: 4,
  overdueTasks: 0,
  ...over,
});

const stats = (over: Partial<TeamStats> = {}): TeamStats => ({
  days: 7,
  slaMinutes: 15,
  kpis: {
    openConversations: 21,
    unanswered: 6,
    waitingOverSla: 2,
    avgFirstResponseMinutes: 9,
    wonConversations: 7,
    lostConversations: 3,
    ordersLinked: 5,
    messagesSent: 130,
  },
  members: [
    member(),
    member({ userId: "u2", userName: "Luis", openAssigned: 9, messagesSent: 10, avgFirstResponseMinutes: null }),
    member({ userId: "pau", userName: "Pau", kind: "pau", openAssigned: 2, messagesSent: 80 }),
  ],
  waiting: [{ conversation: conv(), waitingMinutes: 75 }],
  lostReasons: [
    { reason: "Precio", count: 4 },
    { reason: "No respondió", count: 2 },
  ],
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
      <EquipoView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = "ADMIN";
  team.getTeamStats.mockResolvedValue(stats());
  team.listTeamMembers.mockResolvedValue([
    { userId: "u1", userName: "Ana" },
    { userId: "u2", userName: "Luis" },
  ]);
  crm.updateConversation.mockResolvedValue(conv({ assignedUserId: "u2", assignedUserName: "Luis" }));
});

const rowNames = () =>
  screen.getAllByTestId("member-row").map((r) => within(r).getAllByRole("rowheader")[0].textContent);

describe("Equipo", () => {
  it("muestra los KPIs", async () => {
    setup();
    const kpis = await screen.findAllByTestId("kpi");
    const text = kpis.map((k) => k.textContent).join("|");
    expect(kpis).toHaveLength(8);
    expect(text).toContain("21Chats abiertos");
    expect(text).toContain("2EsperandoMás de 15 min");
    expect(text).toContain("9 minPrimera respuesta");
    expect(text).toContain("130Mensajes enviados");
    expect(team.getTeamStats).toHaveBeenCalledWith(7);
  });

  it("cambia el periodo a 30 días", async () => {
    setup();
    await screen.findAllByTestId("kpi");
    fireEvent.click(screen.getByRole("button", { name: "Últimos 30 días" }));
    await waitFor(() => expect(team.getTeamStats).toHaveBeenCalledWith(30));
  });

  it("lista los chats esperando con contacto, minutos y asignada", async () => {
    setup();
    const list = await screen.findByTestId("waiting-list");
    expect(within(list).getByText("Rosa Quispe")).toBeInTheDocument();
    expect(list.textContent).toContain("Esperando 1 h 15 min");
    expect(list.textContent).toContain("Asignada a Ana");
    expect(screen.getByText(/Chats esperando más de 15 min/)).toBeInTheDocument();
    expect(within(list).getByRole("link", { name: "Abrir chat" })).toHaveAttribute(
      "href",
      "/comercial/ventas-chat/bandeja?c=c1",
    );
  });

  it("reasignar llama a updateConversation con id y nombre, sin ofrecer a la persona actual", async () => {
    setup();
    const select = await screen.findByLabelText("Reasignar a… (Rosa Quispe)");
    await waitFor(() => expect(select).not.toBeDisabled());
    const options = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Reasignar a…", "Luis"]);
    fireEvent.change(select, { target: { value: "u2" } });
    await waitFor(() =>
      expect(crm.updateConversation).toHaveBeenCalledWith("c1", {
        assignedUserId: "u2",
        assignedUserName: "Luis",
      }),
    );
  });

  it("sin chats esperando dice «Todo al día»", async () => {
    team.getTeamStats.mockResolvedValue(stats({ waiting: [] }));
    setup();
    expect(await screen.findByTestId("all-clear")).toHaveTextContent("Todo al día");
  });

  it("incluye a Pau con su etiqueta y ordena por columna", async () => {
    setup();
    await screen.findByTestId("ranking");
    expect(screen.getByText("Agente IA")).toBeInTheDocument();
    // Orden inicial: más chats abiertos primero.
    expect(rowNames()[0]).toContain("Luis");
    fireEvent.click(screen.getByRole("button", { name: "Mensajes" }));
    expect(rowNames()[0]).toContain("Pau"); // 80 (desc)
    fireEvent.click(screen.getByRole("button", { name: "Mensajes" }));
    expect(rowNames()[0]).toContain("Luis"); // 10 (asc)
    // Sin dato de primera respuesta siempre al final.
    fireEvent.click(screen.getByRole("button", { name: "1ª respuesta" }));
    expect(rowNames()[2]).toContain("Luis");
    fireEvent.click(screen.getByRole("button", { name: "1ª respuesta" }));
    expect(rowNames()[2]).toContain("Luis");
  });

  it("muestra los motivos de pérdida", async () => {
    setup();
    const list = await screen.findByTestId("lost-reasons");
    expect(list.textContent).toContain("Precio");
    expect(list.textContent).toContain("No respondió");
  });

  it("muestra el error del servidor", async () => {
    team.getTeamStats.mockRejectedValue(new Error("boom"));
    setup();
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });

  it("un usuario que no es administrador no ve nada ni llama a los endpoints", () => {
    mockRole = "VENTAS";
    setup();
    expect(screen.getByText("Solo un administrador puede ver esta sección")).toBeInTheDocument();
    expect(team.getTeamStats).not.toHaveBeenCalled();
    expect(team.listTeamMembers).not.toHaveBeenCalled();
  });
});

describe("Equipo · fase 3", () => {
  const today = {
    goal: 1000,
    total: 450,
    unassigned: 50,
    members: [
      { userId: "u1", userName: "Ana", collected: 300 },
      { userId: "u2", userName: "Luis", collected: 100 },
    ],
  };

  it("goalPercent: sin meta es null y no pasa de 100", () => {
    expect(goalPercent(10, 0)).toBeNull();
    expect(goalPercent(450, 1000)).toBe(45);
    expect(goalPercent(2000, 1000)).toBe(100);
  });

  it("muestra la meta del día, el avance por vendedora y lo no asignado", async () => {
    team.getTeamStats.mockResolvedValue(stats({ today }));
    setup();
    const box = await screen.findByTestId("daily-goal");
    expect(box).toHaveTextContent("45%");
    const items = within(screen.getByTestId("goal-members")).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Ana");
    expect(items[0]).toHaveTextContent("60%");
    expect(items[1]).toHaveTextContent("20%");
    expect(box).toHaveTextContent("cobrados en chats sin vendedora asignada");
  });

  it("guarda la nueva meta", async () => {
    team.getTeamStats.mockResolvedValue(stats({ today }));
    team.setDailyGoal.mockResolvedValue({ dailyGoal: 1500 });
    setup();
    const box = await screen.findByTestId("daily-goal");
    const input = within(box).getByLabelText("Meta (S/)");
    const save = within(box).getByRole("button", { name: "Guardar" });
    expect(save).toBeDisabled();
    fireEvent.change(input, { target: { value: "1500" } });
    fireEvent.click(save);
    await waitFor(() => expect(team.setDailyGoal).toHaveBeenCalledWith(1500));
  });

  it("sin meta fijada lo dice y no dibuja barras", async () => {
    team.getTeamStats.mockResolvedValue(stats({ today: { ...today, goal: 0 } }));
    setup();
    const box = await screen.findByTestId("daily-goal");
    expect(box).toHaveTextContent("sin meta fijada");
    expect(within(box).queryByText(/%/)).not.toBeInTheDocument();
  });

  it("tabla de resultados por canal con conversión", async () => {
    team.getTeamStats.mockResolvedValue(
      stats({
        byChannel: [
          { channel: "whatsapp", chats: 10, won: 1, conversion: 10, collected: 250 },
          { channel: "tiktok", chats: 0, won: 0, conversion: null, collected: 0 },
        ],
      }),
    );
    setup();
    const table = await screen.findByTestId("channel-results");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("WhatsApp");
    expect(rows[0]).toHaveTextContent("10%");
    expect(rows[1]).toHaveTextContent("TikTok");
    expect(rows[1]).toHaveTextContent("—");
  });
});
