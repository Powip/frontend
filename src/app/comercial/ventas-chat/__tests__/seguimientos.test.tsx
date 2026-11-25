import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import SeguimientosView from "@/components/ventas-chat/SeguimientosView";
import { VENTAS_CHAT_TABS } from "@/app/comercial/ventas-chat/tabs";
import * as svc from "@/services/crmService";
import * as teamSvc from "@/services/crmTeamService";
import type {
  FollowupRule,
  FollowupRun,
  FollowupStats,
  Pipeline,
  Stage,
  Template,
} from "@/types/crm";

import axiosAuth from "@/lib/axiosAuth";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/comercial/ventas-chat/seguimientos",
  useSearchParams: () => new URLSearchParams(),
}));
let mockRole = "SELLER";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { accessToken: "t", user: { id: "u1", name: "Jairo", role: mockRole }, company: { id: "co1" } },
  }),
}));
jest.mock("@/config/permissions.config", () => ({
  hasAdminAccess: (role?: string) => role === "ADMIN",
}));
jest.mock("@/services/crmTeamService", () => ({
  ...jest.requireActual("@/services/crmTeamService"),
  getCrmSettings: jest.fn(),
  updateCrmSettings: jest.fn(),
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/services/crmService", () => ({
  ...jest.requireActual("@/services/crmService"),
  listFollowupRules: jest.fn(),
  getFollowupStats: jest.fn(),
  listFollowupRuns: jest.fn(),
  listPipelines: jest.fn(),
  listTemplates: jest.fn(),
  createFollowupRule: jest.fn(),
  updateFollowupRule: jest.fn(),
  deleteFollowupRule: jest.fn(),
}));
const s = svc as jest.Mocked<typeof svc>;
const team = teamSvc as jest.Mocked<typeof teamSvc>;

beforeAll(() => {
  // Radix (Switch dentro de un diálogo) usa ResizeObserver, que jsdom no trae.
  global.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
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
  stages: [stage("s1", "Nuevo", 0), stage("s2", "Cotizado", 1), stage("s3", "Ganado", 2, "won")],
};

const rule = (over: Partial<FollowupRule> = {}): FollowupRule => ({
  id: "r1",
  name: "+2 h · recordatorio",
  objective: "sale",
  trigger: "customer_silent",
  stageId: null,
  waitMinutes: 120,
  target: "customer",
  message: "{nombre}, ¿te ayudo a separarla?",
  templateName: "seguimiento_consulta",
  templateLanguage: "es",
  templateVariables: ["{nombre}"],
  active: true,
  createdAt: "2026-11-19T10:00:00.000Z",
  ...over,
});
const RULES = [
  rule(),
  rule({
    id: "r2",
    name: "Saldo · aviso",
    objective: "collection",
    waitMinutes: 1440,
    templateName: null,
    templateLanguage: null,
    templateVariables: [],
    active: false,
  }),
];
const STATS: FollowupStats = {
  days: 30,
  sentFree: 12,
  sentTemplate: 5,
  tasks: 3,
  skipped: 7,
  failed: 1,
  limits: { sale: 6, collection: 3, aftersale: 2 },
  month: {
    since: "2026-11-01T05:00:00.000Z",
    sent: 142,
    sentFree: 118,
    sentTemplate: 24,
    templateCost: 7.2,
    recoveredSales: 9,
    recoveredAmount: 1080,
  },
};
const RUN: FollowupRun = {
  id: "u1",
  ruleId: "r1",
  ruleName: "+2 h · recordatorio",
  conversationId: "c1",
  contactName: "Ana Pérez",
  contactPhone: "51999111222",
  objective: "sale",
  result: "skipped_window",
  detail: "Pasaron más de 24 h y la regla no tiene plantilla",
  createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
};
const TEMPLATES: Template[] = [
  {
    name: "seguimiento_consulta",
    language: "es",
    category: "MARKETING",
    status: "APPROVED",
    bodyText: "Hola {{1}}, seguimos con tu consulta.",
    variableCount: 1,
  },
];

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SeguimientosView />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  s.listFollowupRules.mockResolvedValue(RULES);
  s.getFollowupStats.mockResolvedValue(STATS);
  s.listFollowupRuns.mockResolvedValue([RUN]);
  s.listPipelines.mockResolvedValue([pipeline]);
  s.listTemplates.mockResolvedValue(TEMPLATES);
  s.createFollowupRule.mockResolvedValue(rule({ id: "new" }));
  s.updateFollowupRule.mockResolvedValue(rule());
  s.deleteFollowupRule.mockResolvedValue(undefined);
  mockRole = "SELLER";
  team.getCrmSettings.mockResolvedValue({
    slaMinutes: 15,
    hours: { days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00" },
    awayEnabled: false,
    awayMessage: "",
    welcomeEnabled: false,
    welcomeMessage: "",
    assignMode: "manual",
    assignUsers: [],
    dailyGoal: 0,
    followupWeeklyMax: 3,
    followupSendStart: "07:00",
    followupSendEnd: "20:00",
  } as never);
  team.updateCrmSettings.mockImplementation(async (patch) => patch as never);
});

describe("pestañas", () => {
  it("siguen el orden del mockup 152 y Ventas ya no es pestaña (vive en el Core)", () => {
    expect(VENTAS_CHAT_TABS.map((t) => t.label)).toEqual([
      "Bandeja",
      "Llamadas",
      "Agenda",
      "Embudo",
      "Seguimientos",
      "Difusiones",
      "Equipo",
      "Pau",
      "Objeciones",
      "Ficha de venta",
      "Guion y material",
      "Auditoría",
      "Ajustes",
    ]);
    expect(VENTAS_CHAT_TABS[4].href).toBe("/comercial/ventas-chat/seguimientos");
    expect(VENTAS_CHAT_TABS[5].href).toBe("/comercial/ventas-chat/difusiones");
  });
});

describe("Seguimientos · lista", () => {
  it("muestra resumen de 30 días, límites y reglas agrupadas con frase legible", async () => {
    setup();
    const cards = await screen.findAllByTestId("stat-card");
    expect(cards.map((c) => c.textContent)).toEqual([
      expect.stringContaining("12"),
      expect.stringContaining("5"),
      expect.stringContaining("3"),
      expect.stringContaining("7"),
      expect.stringContaining("1"),
    ]);
    expect(screen.getByTestId("limits")).toHaveTextContent("Venta 6 · Cobranza 3 · Postventa 2");

    const venta = within(await screen.findByRole("group", { name: "Venta" }));
    expect(
      venta.getByText(
        "Si el cliente no responde en 2 h → WhatsApp al cliente · plantilla seguimiento_consulta fuera de 24 h",
      ),
    ).toBeInTheDocument();
    const cobranza = within(screen.getByRole("group", { name: "Cobranza" }));
    expect(cobranza.getByText("Saldo · aviso")).toBeInTheDocument();
    expect(cobranza.getByText("Pausada")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Postventa" })).not.toBeInTheDocument();
  });

  it("muestra los seguimientos del mes con costo de plantillas y ventas recuperadas", async () => {
    setup();
    const card = await screen.findByTestId("month-card");
    expect(within(card).getByText("142")).toBeInTheDocument();
    expect(within(card).getByText("118")).toBeInTheDocument();
    expect(within(card).getByText("24")).toBeInTheDocument();
    expect(within(card).getByText("Gratis en ventana")).toBeInTheDocument();
    expect(within(card).getByText("Con plantilla")).toBeInTheDocument();
    const summary = within(card).getByTestId("month-summary");
    expect(summary).toHaveTextContent("24 plantillas costaron aprox. S/ 7.20, cobrados directo en tu cuenta de Meta.");
    expect(summary).toHaveTextContent("Los seguimientos recuperaron 9 ventas por S/ 1,080.00.");
  });

  it("actividad reciente: enlace al chat, etiqueta de resultado y detalle", async () => {
    setup();
    const row = await screen.findByTestId("run-row");
    const link = within(row).getByRole("link", { name: "Ana Pérez" });
    expect(link).toHaveAttribute("href", "/comercial/ventas-chat/bandeja?c=c1");
    expect(within(row).getByText("Omitido: ventana de 24 h cerrada")).toBeInTheDocument();
    expect(within(row).getByText(/no tiene plantilla/)).toBeInTheDocument();
    expect(within(row).getByText("hace 5 min")).toBeInTheDocument();
  });

  it("activar y pausar llama al PATCH con active", async () => {
    mockRole = "ADMIN";
    setup();
    fireEvent.click(await screen.findByRole("switch", { name: "Activar +2 h · recordatorio" }));
    await waitFor(() => expect(s.updateFollowupRule).toHaveBeenCalledWith("r1", { active: false }));
    fireEvent.click(screen.getByRole("switch", { name: "Activar Saldo · aviso" }));
    await waitFor(() => expect(s.updateFollowupRule).toHaveBeenCalledWith("r2", { active: true }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("+2 h · recordatorio pausada"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Saldo · aviso activada"));
  });

  it("eliminar pide confirmación", async () => {
    mockRole = "ADMIN";
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar regla Saldo · aviso" }));
    expect(s.deleteFollowupRule).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(s.deleteFollowupRule).toHaveBeenCalledWith("r2"));
  });

  it("duplicar crea una copia pausada", async () => {
    mockRole = "ADMIN";
    setup();
    const row = (await screen.findAllByTestId("rule-row"))[0];
    fireEvent.click(within(row).getByRole("button", { name: /Duplicar/ }));
    await waitFor(() =>
      expect(s.createFollowupRule).toHaveBeenCalledWith(
        expect.objectContaining({ name: "+2 h · recordatorio (copia)", active: false, waitMinutes: 120 }),
      ),
    );
  });
});

describe("Seguimientos · crear regla", () => {
  const open = async () => {
    mockRole = "ADMIN";
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Nueva regla/ }));
    return within(await screen.findByRole("dialog"));
  };

  it("envía el payload correcto con espera convertida a minutos", async () => {
    const dlg = await open();
    fireEvent.change(dlg.getByLabelText("Nombre"), { target: { value: "Día 3" } });
    fireEvent.change(dlg.getByLabelText("Esperar"), { target: { value: "3" } });
    fireEvent.change(dlg.getByLabelText("Unidad de espera"), { target: { value: "days" } });
    fireEvent.change(dlg.getByLabelText("Mensaje (dentro de 24 h)"), {
      target: { value: "Hola {nombre}" },
    });
    await waitFor(() => expect(dlg.getByLabelText(/Plantilla para cuando/)).toBeInTheDocument());
    await waitFor(() =>
      expect(within(dlg.getByLabelText(/Plantilla para cuando/)).getAllByRole("option").length).toBe(2),
    );
    fireEvent.change(dlg.getByLabelText(/Plantilla para cuando/), {
      target: { value: "seguimiento_consulta|es" },
    });
    expect(dlg.getByTestId("template-preview")).toHaveTextContent(
      "Hola {{1}}, seguimos con tu consulta.",
    );
    fireEvent.change(dlg.getByLabelText("Valor de {{1}}"), { target: { value: "{nombre}" } });
    expect(dlg.getByTestId("template-preview")).toHaveTextContent("Hola Ana, seguimos");
    fireEvent.click(dlg.getByRole("button", { name: "Crear regla" }));
    await waitFor(() =>
      expect(s.createFollowupRule).toHaveBeenCalledWith({
        name: "Día 3",
        objective: "sale",
        trigger: "customer_silent",
        stageId: null,
        waitMinutes: 4320,
        target: "customer",
        message: "Hola {nombre}",
        templateName: "seguimiento_consulta",
        templateLanguage: "es",
        templateVariables: ["{nombre}"],
        active: false,
      }),
    );
  });

  it("los chips insertan {nombre} y {vendedora} en el mensaje", async () => {
    const dlg = await open();
    fireEvent.click(dlg.getByRole("button", { name: "{nombre}" }));
    fireEvent.click(dlg.getByRole("button", { name: "{vendedora}" }));
    expect(dlg.getByLabelText("Mensaje (dentro de 24 h)")).toHaveValue("{nombre}{vendedora}");
  });

  it("«tiempo en etapa» exige elegir etapa antes de guardar", async () => {
    const dlg = await open();
    fireEvent.change(dlg.getByLabelText("Nombre"), { target: { value: "Cotizado parado" } });
    fireEvent.change(dlg.getByLabelText("Mensaje (dentro de 24 h)"), { target: { value: "Hola" } });
    fireEvent.change(dlg.getByLabelText("Cuándo se activa"), { target: { value: "stage_idle" } });
    fireEvent.click(dlg.getByRole("button", { name: "Crear regla" }));
    expect(await dlg.findByText("Elige la etapa: este disparador la necesita.")).toBeInTheDocument();
    expect(s.createFollowupRule).not.toHaveBeenCalled();

    await waitFor(() => expect(within(dlg.getByLabelText(/Etapa/)).getAllByRole("option").length).toBe(4));
    fireEvent.change(dlg.getByLabelText(/Etapa/), { target: { value: "s2" } });
    fireEvent.click(dlg.getByRole("button", { name: "Crear regla" }));
    await waitFor(() =>
      expect(s.createFollowupRule).toHaveBeenCalledWith(
        expect.objectContaining({ trigger: "stage_idle", stageId: "s2" }),
      ),
    );
  });

  it("avisa si el servicio de WhatsApp no entrega las plantillas, sin romper", async () => {
    s.listTemplates.mockRejectedValue(
      Object.assign(new Error("x"), {
        isAxiosError: true,
        response: { status: 502, data: { code: "TEMPLATES_UNAVAILABLE", message: "WhatsApp no responde" } },
      }),
    );
    const dlg = await open();
    expect(await dlg.findByText(/WhatsApp no responde/)).toBeInTheDocument();
    expect(dlg.getByRole("button", { name: "Crear regla" })).toBeEnabled();
  });
});

describe("Seguimientos · secuencias rápidas", () => {
  it("pide confirmación, avisa que quedan pausadas y crea reglas inactivas", async () => {
    mockRole = "ADMIN";
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Crear secuencia Sin respuesta del equipo" }));
    const dlg = within(await screen.findByRole("dialog"));
    expect(dlg.getAllByText(/pausadas/).length).toBeGreaterThan(0);
    expect(s.createFollowupRule).not.toHaveBeenCalled();
    fireEvent.click(dlg.getByRole("button", { name: "Crear 2 reglas pausadas" }));
    await waitFor(() => expect(s.createFollowupRule).toHaveBeenCalledTimes(2));
    expect(s.createFollowupRule).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        trigger: "agent_silent",
        target: "agent",
        waitMinutes: 15,
        active: false,
      }),
    );
    expect(s.createFollowupRule).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ waitMinutes: 60, active: false }),
    );
  });

  it("la recuperación del PDF (+3 h, +8 h, días 2-4) usa la plantilla solo en los pasos de plantilla", async () => {
    mockRole = "ADMIN";
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Crear secuencia Recuperación de 4 días" }));
    const dlg = within(await screen.findByRole("dialog"));
    await waitFor(() => expect(within(dlg.getByLabelText(/Plantilla para los/)).getAllByRole("option").length).toBe(2));
    fireEvent.change(dlg.getByLabelText(/Plantilla para los/), {
      target: { value: "seguimiento_consulta|es" },
    });
    fireEvent.click(dlg.getByRole("button", { name: "Crear 5 reglas pausadas" }));
    await waitFor(() => expect(s.createFollowupRule).toHaveBeenCalledTimes(5));
    const calls = s.createFollowupRule.mock.calls.map((c) => c[0]);
    expect(calls.map((c) => c.templateName)).toEqual([
      null,
      null,
      "seguimiento_consulta",
      "seguimiento_consulta",
      "seguimiento_consulta",
    ]);
    expect(calls.map((c) => c.waitMinutes)).toEqual([180, 480, 2880, 4320, 5760]);
    expect(calls.every((c) => c.active === false)).toBe(true);
  });
});

describe("Seguimientos · vendedora (R3)", () => {
  it("ve las reglas pero no puede crear, editar, activar ni eliminar", async () => {
    setup();
    await screen.findAllByTestId("rule-row");
    expect(screen.queryByRole("button", { name: /Nueva regla/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Eliminar regla/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Crear secuencia/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("Solo el administrador").length).toBeGreaterThan(0);
  });
});

describe("Seguimientos · programados para hoy (S5)", () => {
  const UP = {
    ruleId: "r1",
    ruleName: "+2 h · recordatorio",
    objective: "sale",
    target: "customer",
    conversationId: "c9",
    contactName: "Rosa Díaz",
    channel: "whatsapp",
    dueAt: "2026-11-24T20:30:00Z",
    viaTemplate: false,
    templateName: null,
  };
  beforeEach(() => {
    (axiosAuth.get as jest.Mock).mockImplementation(async (url: string) =>
      url.endsWith("/followup-rules/upcoming") ? { data: { items: [UP] } } : { data: {} },
    );
    (axiosAuth.post as jest.Mock).mockResolvedValue({ data: { result: "sent", detail: null } });
  });
  it("el administrador adelanta o cancela un envío", async () => {
    mockRole = "ADMIN";
    setup();
    const row = await screen.findByTestId("upcoming-row");
    expect(within(row).getByText("Rosa Díaz")).toBeInTheDocument();
    expect(within(row).getByText("Gratis")).toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button", { name: "Enviar ahora a Rosa Díaz" }));
    await waitFor(() =>
      expect(axiosAuth.post).toHaveBeenCalledWith(expect.stringContaining("/followup-rules/r1/conversations/c9/send-now")),
    );
    fireEvent.click(within(row).getByRole("button", { name: "Cancelar envío a Rosa Díaz" }));
    await waitFor(() =>
      expect(axiosAuth.post).toHaveBeenCalledWith(expect.stringContaining("/followup-rules/r1/conversations/c9/cancel")),
    );
  });
  it("la vendedora ve la lista pero sin botones", async () => {
    setup();
    const row = await screen.findByTestId("upcoming-row");
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("Seguimientos · límites (fase 3)", () => {
  it("la vendedora no ve la tarjeta de límites", async () => {
    setup();
    await screen.findAllByTestId("stat-card");
    expect(screen.queryByTestId("card-followup-limits")).not.toBeInTheDocument();
  });

  it("el administrador cambia tope semanal y horario y guarda", async () => {
    mockRole = "ADMIN";
    setup();
    const card = await screen.findByTestId("card-followup-limits");
    const weekly = within(card).getByLabelText("Máximo por semana");
    expect(weekly).toHaveValue(3);
    fireEvent.change(weekly, { target: { value: "5" } });
    fireEvent.change(within(card).getByLabelText("Enviar desde"), { target: { value: "08:00" } });
    fireEvent.click(within(card).getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(team.updateCrmSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          followupWeeklyMax: 5,
          followupSendStart: "08:00",
          followupSendEnd: "20:00",
        }),
      ),
    );
  });

  it("no deja guardar si el tope sale de 1-20 o el horario está al revés", async () => {
    mockRole = "ADMIN";
    setup();
    const card = await screen.findByTestId("card-followup-limits");
    fireEvent.change(within(card).getByLabelText("Máximo por semana"), { target: { value: "25" } });
    expect(within(card).getByText("El tope semanal va de 1 a 20 mensajes.")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Guardar" })).toBeDisabled();
    fireEvent.change(within(card).getByLabelText("Máximo por semana"), { target: { value: "4" } });
    fireEvent.change(within(card).getByLabelText("hasta"), { target: { value: "06:00" } });
    expect(
      within(card).getByText("El horario de envío debe empezar antes de terminar."),
    ).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Guardar" })).toBeDisabled();
  });
});
