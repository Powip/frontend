import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AjustesView from "@/components/ventas-chat/AjustesView";
import * as crmService from "@/services/crmService";
import * as teamService from "@/services/crmTeamService";
import type { CrmSettings } from "@/types/crmTeam";

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
  listTemplates: jest.fn(),
}));
jest.mock("@/services/crmTeamService", () => ({
  ...jest.requireActual("@/services/crmTeamService"),
  getCrmSettings: jest.fn(),
  updateCrmSettings: jest.fn(),
  listTeamMembers: jest.fn(),
  connectCustomWaba: jest.fn(),
  listMetaAccounts: jest.fn(),
  connectMetaAccount: jest.fn(),
  deleteMetaAccount: jest.fn(),
}));
const team = teamService as jest.Mocked<typeof teamService>;
const crm = crmService as jest.Mocked<typeof crmService>;

const settings = (over: Partial<CrmSettings> = {}): CrmSettings => ({
  slaMinutes: 15,
  hours: { days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00" },
  awayEnabled: false,
  awayMessage: "Estamos fuera de horario, {nombre}.",
  welcomeEnabled: false,
  welcomeMessage: "Hola {nombre}, bienvenida.",
  assignMode: "manual",
  assignUsers: [],
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
      <AjustesView />
    </QueryClientProvider>,
  );
}

const card = (id: string) => screen.getByTestId(`card-${id}`);
const saveBtn = (id: string, name = "Guardar") => within(card(id)).getByRole("button", { name });

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = "ADMIN";
  team.getCrmSettings.mockResolvedValue(settings());
  team.listMetaAccounts.mockResolvedValue([]);
  team.updateCrmSettings.mockImplementation(async (input) => settings(input));
  team.listTeamMembers.mockResolvedValue([
    { userId: "u1", userName: "Ana" },
    { userId: "u2", userName: "Luis" },
  ]);
  crm.listTemplates.mockResolvedValue([
    { name: "a", language: "es", category: "MARKETING", status: "APPROVED", bodyText: "x", variableCount: 0 },
    { name: "b", language: "es", category: "MARKETING", status: "APPROVED", bodyText: "x", variableCount: 0 },
    { name: "c", language: "es", category: "UTILITY", status: "PENDING", bodyText: "x", variableCount: 0 },
    { name: "d", language: "es", category: "UTILITY", status: "REJECTED", bodyText: "x", variableCount: 0 },
  ]);
});

describe("Ajustes · tarjetas con PATCH parcial", () => {
  it("SLA: botón inactivo sin cambios y envía solo slaMinutes", async () => {
    setup();
    const input = await screen.findByLabelText("Minutos");
    expect(saveBtn("sla")).toBeDisabled();
    fireEvent.change(input, { target: { value: "30" } });
    expect(saveBtn("sla")).toBeEnabled();
    fireEvent.click(saveBtn("sla"));
    await waitFor(() => expect(team.updateCrmSettings).toHaveBeenCalledWith({ slaMinutes: 30 }));
    await waitFor(() => expect(saveBtn("sla")).toBeDisabled());
  });

  it("SLA fuera de rango no se puede guardar", async () => {
    setup();
    fireEvent.change(await screen.findByLabelText("Minutos"), { target: { value: "800" } });
    expect(saveBtn("sla")).toBeDisabled();
  });

  it("Horario: envía hours, awayEnabled y awayMessage", async () => {
    setup();
    await screen.findByLabelText("Minutos");
    expect(saveBtn("hours")).toBeDisabled();
    fireEvent.click(within(card("hours")).getByRole("checkbox", { name: "Sábado" }));
    fireEvent.click(within(card("hours")).getByRole("switch"));
    fireEvent.change(within(card("hours")).getByLabelText("Hasta"), { target: { value: "20:00" } });
    fireEvent.click(saveBtn("hours"));
    await waitFor(() =>
      expect(team.updateCrmSettings).toHaveBeenCalledWith({
        hours: { days: [1, 2, 3, 4, 5, 6], start: "09:00", end: "20:00" },
        awayEnabled: true,
        awayMessage: "Estamos fuera de horario, {nombre}.",
      }),
    );
  });

  it("Horario: activar con mensaje vacío no deja guardar", async () => {
    setup();
    await screen.findByLabelText("Minutos");
    fireEvent.change(within(card("hours")).getByLabelText("Mensaje fuera de horario"), {
      target: { value: "  " },
    });
    fireEvent.click(within(card("hours")).getByRole("switch"));
    expect(saveBtn("hours")).toBeDisabled();
    expect(within(card("hours")).getByText(/Escribe el mensaje/)).toBeInTheDocument();
  });

  it("Bienvenida: vista previa con {nombre} y envía solo su parte", async () => {
    setup();
    await screen.findByLabelText("Minutos");
    expect(screen.getByTestId("welcome-preview")).toHaveTextContent("Hola María, bienvenida.");
    fireEvent.click(within(card("welcome")).getByRole("switch"));
    fireEvent.change(within(card("welcome")).getByLabelText("Mensaje de bienvenida"), {
      target: { value: "Hola {nombre}, ¿en qué te ayudo?" },
    });
    expect(screen.getByTestId("welcome-preview")).toHaveTextContent("Hola María, ¿en qué te ayudo?");
    fireEvent.click(saveBtn("welcome"));
    await waitFor(() =>
      expect(team.updateCrmSettings).toHaveBeenCalledWith({
        welcomeEnabled: true,
        welcomeMessage: "Hola {nombre}, ¿en qué te ayudo?",
      }),
    );
  });

  it("Reparto por turnos sin personas muestra aviso y no guarda", async () => {
    setup();
    await screen.findByLabelText("Minutos");
    fireEvent.click(within(card("assign")).getByRole("radio", { name: "Por turnos" }));
    expect(within(card("assign")).getByText(/Elige al menos una persona/)).toBeInTheDocument();
    expect(saveBtn("assign")).toBeDisabled();
  });

  it("Reparto por turnos con personas envía assignMode y assignUsers", async () => {
    setup();
    await screen.findByLabelText("Minutos");
    fireEvent.click(within(card("assign")).getByRole("radio", { name: "Por turnos" }));
    fireEvent.click(await within(card("assign")).findByRole("checkbox", { name: "Luis" }));
    fireEvent.click(saveBtn("assign"));
    await waitFor(() =>
      expect(team.updateCrmSettings).toHaveBeenCalledWith({
        assignMode: "round_robin",
        assignUsers: [{ userId: "u2", userName: "Luis" }],
      }),
    );
  });

  it("Reparto: aviso si no hay personas con actividad", async () => {
    team.listTeamMembers.mockResolvedValue([]);
    setup();
    expect(await screen.findByText(/Todavía no hay personas con actividad/)).toBeInTheDocument();
  });

  it("muestra el error 400 del servidor dentro de la tarjeta", async () => {
    team.updateCrmSettings.mockRejectedValue(
      Object.assign(new Error("x"), {
        isAxiosError: true,
        response: { status: 400, data: { message: "El mensaje no puede estar vacío" } },
      }),
    );
    setup();
    fireEvent.change(await screen.findByLabelText("Minutos"), { target: { value: "20" } });
    fireEvent.click(saveBtn("sla"));
    expect(await within(card("sla")).findByRole("alert")).toHaveTextContent(
      "El mensaje no puede estar vacío",
    );
  });

  it("lista dónde se configura cada cosa", async () => {
    setup();
    const links = (await screen.findAllByRole("link")).map((l) => l.getAttribute("href"));
    expect(links).toEqual(
      expect.arrayContaining([
        "/comercial/ventas-chat/pau",
        "/comercial/ventas-chat/seguimientos",
        "/comercial/ventas-chat/difusiones",
        "/comercial/ventas-chat/embudo",
        "/comercial/ventas-chat/guion",
        "/comercial/ventas-chat/objeciones",
      ]),
    );
  });
});

describe("Ajustes · WhatsApp del negocio", () => {
  const fill = () => {
    fireEvent.change(screen.getByLabelText(/ID de la cuenta/), { target: { value: " 111222 " } });
    fireEvent.change(screen.getByLabelText(/ID del número/), { target: { value: "333444" } });
    fireEvent.change(screen.getByLabelText(/Número de WhatsApp del negocio/), {
      target: { value: "+51999888777" },
    });
    fireEvent.change(screen.getByLabelText("Token de acceso"), { target: { value: "EAAB-secreto" } });
  };

  it("el token es un campo de contraseña sin autocompletar", async () => {
    setup();
    const token = await screen.findByLabelText("Token de acceso");
    expect(token).toHaveAttribute("type", "password");
    expect(token).toHaveAttribute("autocomplete", "off");
    expect(saveBtn("whatsapp", "Conectar número")).toBeDisabled();
  });

  it("envía el cuerpo exacto y limpia los campos tras conectar", async () => {
    team.connectCustomWaba.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        id: "1",
        companyId: "co1",
        mode: "CUSTOM",
        wabaId: "111222",
        phoneNumberId: "333444",
        businessPhoneNumber: "+51999888777",
        isActive: true,
        createdAt: "",
        updatedAt: "",
      },
    });
    setup();
    await screen.findByLabelText("Token de acceso");
    fill();
    fireEvent.click(saveBtn("whatsapp", "Conectar número"));
    await waitFor(() =>
      expect(team.connectCustomWaba).toHaveBeenCalledWith({
        wabaId: "111222",
        phoneNumberId: "333444",
        businessPhoneNumber: "+51999888777",
        accessToken: "EAAB-secreto",
      }),
    );
    expect(await screen.findByText(/Número conectado: \+51999888777/)).toBeInTheDocument();
    expect(screen.getByLabelText("Token de acceso")).toHaveValue("");
    expect(screen.getByLabelText(/ID de la cuenta/)).toHaveValue("");
    expect(document.body.textContent).not.toContain("EAAB-secreto");
  });

  it("si falla muestra el error y también limpia el token", async () => {
    team.connectCustomWaba.mockRejectedValue(
      Object.assign(new Error("x"), {
        isAxiosError: true,
        response: { status: 422, data: { message: "Meta rechazó el token" } },
      }),
    );
    setup();
    await screen.findByLabelText("Token de acceso");
    fill();
    fireEvent.click(saveBtn("whatsapp", "Conectar número"));
    expect(await within(card("whatsapp")).findByRole("alert")).toHaveTextContent("Meta rechazó el token");
    expect(screen.getByLabelText("Token de acceso")).toHaveValue("");
    // Los identificadores se conservan para reintentar.
    expect(screen.getByLabelText(/ID del número/)).toHaveValue("333444");
  });

  it("muestra cuántas plantillas hay aprobadas, en revisión y rechazadas", async () => {
    setup();
    const box = await screen.findByTestId("templates-status");
    await waitFor(() => expect(box.textContent).toContain("2 aprobadas"));
    expect(box.textContent).toContain("1 en revisión");
    expect(box.textContent).toContain("1 rechazadas");
  });

  it("si las plantillas fallan lo dice sin romper el resto", async () => {
    crm.listTemplates.mockRejectedValue(new Error("WhatsApp no responde"));
    setup();
    const box = await screen.findByTestId("templates-status");
    expect(await within(box).findByRole("alert")).toHaveTextContent("WhatsApp no responde");
    expect(await screen.findByLabelText("Minutos")).toBeInTheDocument();
  });
});

describe("Ajustes · permisos", () => {
  it("no administrador: aviso y ninguna llamada", () => {
    mockRole = "VENTAS";
    setup();
    expect(screen.getByText("Solo un administrador puede ver esta sección")).toBeInTheDocument();
    expect(team.getCrmSettings).not.toHaveBeenCalled();
    expect(team.listTeamMembers).not.toHaveBeenCalled();
    expect(crm.listTemplates).not.toHaveBeenCalled();
  });
});

describe("Ajustes · Instagram y Messenger", () => {
  const account = (over: Record<string, unknown> = {}) => ({
    id: "a1",
    channel: "instagram" as const,
    accountId: "1784000",
    pageId: "9001",
    name: "Tienda IG",
    isActive: true,
    createdAt: "2026-11-19T10:00:00.000Z",
    ...over,
  });
  const fill = () => {
    fireEvent.change(screen.getByLabelText("Canal"), { target: { value: "messenger" } });
    fireEvent.change(screen.getByLabelText(/Cuenta que recibe los mensajes/), {
      target: { value: " 555 " },
    });
    fireEvent.change(screen.getByLabelText("ID de la página de Facebook"), { target: { value: "777" } });
    fireEvent.change(screen.getByLabelText(/Nombre \(opcional\)/), { target: { value: " Mi página " } });
    fireEvent.change(screen.getByLabelText("Token de acceso de la página"), {
      target: { value: "EAAG-secreto" },
    });
  };

  it("lista las cuentas conectadas con canal, nombre e id", async () => {
    team.listMetaAccounts.mockResolvedValue([account()]);
    setup();
    const row = await screen.findByTestId("meta-account");
    expect(row).toHaveTextContent("Instagram");
    expect(row).toHaveTextContent("Tienda IG");
    expect(row).toHaveTextContent("ID 1784000");
  });

  it("el token es contraseña sin autocompletar y el botón espera los datos", async () => {
    setup();
    const token = await screen.findByLabelText("Token de acceso de la página");
    expect(token).toHaveAttribute("type", "password");
    expect(token).toHaveAttribute("autocomplete", "off");
    expect(saveBtn("meta", "Conectar cuenta")).toBeDisabled();
  });

  it("envía el cuerpo exacto y limpia el token", async () => {
    team.connectMetaAccount.mockResolvedValue(
      account({ channel: "messenger", accountId: "555", pageId: "777", name: "Mi página" }),
    );
    setup();
    await screen.findByLabelText("Token de acceso de la página");
    fill();
    fireEvent.click(saveBtn("meta", "Conectar cuenta"));
    await waitFor(() =>
      expect(team.connectMetaAccount).toHaveBeenCalledWith({
        channel: "messenger",
        accountId: "555",
        pageId: "777",
        name: "Mi página",
        accessToken: "EAAG-secreto",
      }),
    );
    expect(await screen.findByText(/Cuenta conectada: Messenger · Mi página/)).toBeInTheDocument();
    expect(screen.getByLabelText("Token de acceso de la página")).toHaveValue("");
    expect(document.body.textContent).not.toContain("EAAG-secreto");
  });

  it("si Meta rechaza el token muestra el error y limpia el token", async () => {
    team.connectMetaAccount.mockRejectedValue(
      Object.assign(new Error("x"), {
        isAxiosError: true,
        response: { status: 422, data: { message: "Meta rechazó el token" } },
      }),
    );
    setup();
    await screen.findByLabelText("Token de acceso de la página");
    fill();
    fireEvent.click(saveBtn("meta", "Conectar cuenta"));
    expect(await within(card("meta")).findByRole("alert")).toHaveTextContent("Meta rechazó el token");
    expect(screen.getByLabelText("Token de acceso de la página")).toHaveValue("");
    expect(screen.getByLabelText("ID de la página de Facebook")).toHaveValue("777");
  });

  it("eliminar pide confirmación y llama al endpoint con el id", async () => {
    team.listMetaAccounts.mockResolvedValue([account()]);
    team.deleteMetaAccount.mockResolvedValue(undefined);
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar cuenta Tienda IG" }));
    expect(team.deleteMetaAccount).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(team.deleteMetaAccount).toHaveBeenCalled());
    expect(team.deleteMetaAccount.mock.calls[0][0]).toBe("a1");
  });
});
