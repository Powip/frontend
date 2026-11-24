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
    auth: { accessToken: "t", user: { id: "u1", name: "Jairo", role: mockRole }, company: { id: "co1", stores: [{ id: "s1", name: "Tienda Uno" }, { id: "s2", name: "Tienda Dos" }] } },
    selectedStoreId: "s2",
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
  getEmbeddedSignupConfig: jest.fn(),
  completeEmbeddedSignup: jest.fn(),
  listMetaAccounts: jest.fn(),
  connectMetaAccount: jest.fn(),
  deleteMetaAccount: jest.fn(),
  listTikTokAccounts: jest.fn(),
  deleteTikTokAccount: jest.fn(),
  getTikTokAuthUrl: jest.fn(),
  connectTikTokOAuth: jest.fn(),
  goToExternalUrl: jest.fn(),
  getExportLog: jest.fn(),
  createExport: jest.fn(),
}));
const mockDownload = jest.fn();
jest.mock("xlsx", () => ({
  utils: {
    book_new: () => ({}),
    json_to_sheet: (rows: unknown[]) => ({ rows }),
    aoa_to_sheet: () => ({}),
    book_append_sheet: jest.fn(),
  },
  writeFile: (...args: unknown[]) => mockDownload(...args),
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
  maskPhone: false,
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
  team.getExportLog.mockResolvedValue([]);
  team.listMetaAccounts.mockResolvedValue([]);
  team.listTikTokAccounts.mockResolvedValue([]);
  team.getEmbeddedSignupConfig.mockResolvedValue({
    enabled: false,
    appId: null,
    configId: null,
    apiVersion: "v26.0",
    simulated: false,
  });
  window.history.replaceState(null, "", "/comercial/ventas-chat/ajustes");
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

  it("Privacidad: activar ocultar teléfono envía solo su tarjeta", async () => {
    setup();
    await screen.findByTestId("card-mask-phone");
    expect(saveBtn("mask-phone")).toBeDisabled();
    fireEvent.click(screen.getByRole("switch", { name: "Ocultar el teléfono completo a las vendedoras" }));
    fireEvent.click(saveBtn("mask-phone"));
    await waitFor(() => expect(team.updateCrmSettings).toHaveBeenCalledWith({ maskPhone: true, absentTaskMode: "wait" }));
  });

  it("Comentarios: guarda respuesta pública y palabras clave limpias", async () => {
    setup();
    await screen.findByTestId("card-comments");
    expect(saveBtn("comments")).toBeDisabled();
    fireEvent.click(screen.getByRole("switch", { name: "Responder en público y seguir por privado" }));
    expect(saveBtn("comments")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Respuesta pública"), { target: { value: " Te escribimos por DM " } });
    fireEvent.change(screen.getByLabelText("Comentarios que contienen"), {
      target: { value: "precio, talla,, precio , envío" },
    });
    fireEvent.click(saveBtn("comments"));
    await waitFor(() =>
      expect(team.updateCrmSettings).toHaveBeenCalledWith({
        commentAutoReply: true,
        commentHideFlagged: false,
        commentReplyText: "Te escribimos por DM",
        commentKeywords: ["precio", "talla", "envío"],
      }),
    );
  });

  it("Llamadas: envía solo su tarjeta", async () => {
    setup();
    await screen.findByTestId("card-calls");
    fireEvent.click(screen.getByRole("switch", { name: "Grabar llamadas" }));
    fireEvent.click(saveBtn("calls"));
    await waitFor(() =>
      expect(team.updateCrmSettings).toHaveBeenCalledWith({
        callRecording: true,
        callHoursStart: "09:00",
        callHoursEnd: "20:00",
        callLiveAi: false,
      }),
    );
  });

  it("Llamadas: horario, IA en vivo y horario inválido", async () => {
    setup();
    await screen.findByTestId("card-calls");
    fireEvent.change(screen.getByLabelText("Llamar desde"), { target: { value: "21:00" } });
    fireEvent.change(screen.getByLabelText("Llamar hasta"), { target: { value: "08:00" } });
    expect(saveBtn("calls")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Llamar desde"), { target: { value: "10:00" } });
    fireEvent.change(screen.getByLabelText("Llamar hasta"), { target: { value: "19:00" } });
    fireEvent.click(screen.getByRole("switch", { name: "La IA escucha y sugiere en vivo" }));
    fireEvent.click(saveBtn("calls"));
    await waitFor(() =>
      expect(team.updateCrmSettings).toHaveBeenCalledWith({
        callRecording: false,
        callHoursStart: "10:00",
        callHoursEnd: "19:00",
        callLiveAi: true,
      }),
    );
  });

  it("Comentarios: ocultar teléfonos o insultos", async () => {
    setup();
    await screen.findByTestId("card-comments");
    fireEvent.click(screen.getByRole("switch", { name: "Ocultar comentarios con teléfonos o insultos" }));
    fireEvent.click(saveBtn("comments"));
    await waitFor(() =>
      expect(team.updateCrmSettings).toHaveBeenCalledWith(expect.objectContaining({ commentHideFlagged: true })),
    );
  });

  it("Privacidad: regla por vendedora ausente", async () => {
    setup();
    await screen.findByTestId("card-mask-phone");
    fireEvent.change(screen.getByLabelText("Si la vendedora no trabaja el día de su seguimiento"), {
      target: { value: "reassign" },
    });
    fireEvent.click(saveBtn("mask-phone"));
    await waitFor(() =>
      expect(team.updateCrmSettings).toHaveBeenCalledWith({ maskPhone: false, absentTaskMode: "reassign" }),
    );
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
        storeId: "s2",
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

  it("envía la tienda elegida y la opción de toda la empresa", async () => {
    team.connectCustomWaba.mockResolvedValue({ status: "success", message: "ok", data: undefined } as never);
    setup();
    await screen.findByLabelText("Token de acceso");
    fireEvent.change(screen.getByLabelText("Tienda"), { target: { value: "s1" } });
    fireEvent.click(screen.getByLabelText("Usar como número de toda la empresa"));
    fill();
    fireEvent.click(saveBtn("whatsapp", "Conectar número"));
    await waitFor(() =>
      expect(team.connectCustomWaba).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: "s1", asCompanyDefault: true }),
      ),
    );
  });

  it("sin app de Meta deshabilita «Conectar con Facebook» y dice qué falta", async () => {
    setup();
    expect(await screen.findByTestId("embedded-signup-disabled")).toHaveTextContent(
      "WHATSAPP_META_EMBEDDED_SIGNUP_CONFIG_ID",
    );
    expect(screen.getByRole("button", { name: "Conectar con Facebook" })).toBeDisabled();
  });

  it("con el simulador conecta por Embedded Signup en la tienda elegida", async () => {
    team.getEmbeddedSignupConfig.mockResolvedValue({
      enabled: true,
      appId: "app",
      configId: "cfg",
      apiVersion: "v26.0",
      simulated: true,
    });
    team.completeEmbeddedSignup.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        id: "1",
        companyId: "co1",
        mode: "CUSTOM",
        wabaId: "w",
        phoneNumberId: "p",
        businessPhoneNumber: "+51 900 000 001",
        isActive: true,
        createdAt: "",
        updatedAt: "",
      },
    });
    setup();
    const btn = await screen.findByRole("button", { name: "Conectar con Facebook" });
    await waitFor(() => expect(btn).toBeEnabled());
    fireEvent.click(btn);
    await waitFor(() =>
      expect(team.completeEmbeddedSignup).toHaveBeenCalledWith({ storeId: "s2", code: "SIMULATED_CODE" }),
    );
    expect(await screen.findByText(/Número conectado: \+51 900 000 001/)).toBeInTheDocument();
  });

  it("si Meta falla al canjear el código muestra el error", async () => {
    team.getEmbeddedSignupConfig.mockResolvedValue({
      enabled: true,
      appId: "app",
      configId: "cfg",
      apiVersion: "v26.0",
      simulated: true,
    });
    team.completeEmbeddedSignup.mockRejectedValue(
      Object.assign(new Error("x"), {
        isAxiosError: true,
        response: { status: 502, data: { message: "Meta no respondió" } },
      }),
    );
    setup();
    const btn = await screen.findByRole("button", { name: "Conectar con Facebook" });
    await waitFor(() => expect(btn).toBeEnabled());
    fireEvent.click(btn);
    expect(await within(card("whatsapp")).findByRole("alert")).toHaveTextContent("Meta no respondió");
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

describe("Ajustes · TikTok", () => {
  const SETTINGS = "/comercial/ventas-chat/ajustes";
  const tiktok = (over: Partial<import("@/types/crmTeam").TikTokAccount> = {}) => ({
    id: "t1",
    channel: "tiktok" as const,
    accountId: "BIZ-1",
    name: "Tienda TT",
    isActive: true,
    createdAt: "2026-11-22T00:00:00Z",
    autoRenew: true,
    ...over,
  });
  const apiError = (status: number, message: string) =>
    Object.assign(new Error("x"), { isAxiosError: true, response: { status, data: { message } } });

  it("lista las cuentas y avisa de la que no se renueva sola", async () => {
    team.listTikTokAccounts.mockResolvedValue([tiktok(), tiktok({ id: "t2", name: "Manual", autoRenew: false })]);
    setup();
    const rows = await screen.findAllByTestId("tiktok-account");
    expect(rows[0]).toHaveTextContent("Tienda TT");
    expect(rows[0]).toHaveTextContent("ID BIZ-1");
    expect(rows[0]).not.toHaveTextContent("Sin renovación automática");
    expect(rows[1]).toHaveTextContent("Sin renovación automática");
  });

  it("el botón pide la URL y sale hacia TikTok", async () => {
    team.getTikTokAuthUrl.mockResolvedValue("https://www.tiktok.com/v2/auth/authorize?state=s");
    setup();
    await screen.findByLabelText("Minutos");
    fireEvent.click(saveBtn("tiktok", "Conectar con TikTok"));
    await waitFor(() =>
      expect(team.goToExternalUrl).toHaveBeenCalledWith("https://www.tiktok.com/v2/auth/authorize?state=s"),
    );
  });

  it("si el entorno no tiene las claves muestra el motivo y no sale de Powip", async () => {
    team.getTikTokAuthUrl.mockRejectedValue(
      apiError(503, "La conexión con TikTok no está configurada en este entorno."),
    );
    setup();
    await screen.findByLabelText("Minutos");
    fireEvent.click(saveBtn("tiktok", "Conectar con TikTok"));
    expect(await within(card("tiktok")).findByRole("alert")).toHaveTextContent("no está configurada");
    expect(team.goToExternalUrl).not.toHaveBeenCalled();
    expect(saveBtn("tiktok", "Conectar con TikTok")).toBeEnabled();
  });

  it("al volver de TikTok canjea el código una vez y limpia la URL", async () => {
    window.history.replaceState(null, "", `${SETTINGS}#tiktok_code=CODE-1&tiktok_state=STATE-1`);
    team.connectTikTokOAuth.mockResolvedValue({ account: tiktok(), webhook: "registered" });
    setup();
    expect(await screen.findByText(/Cuenta conectada: Tienda TT/)).toBeInTheDocument();
    expect(team.connectTikTokOAuth).toHaveBeenCalledTimes(1);
    expect(team.connectTikTokOAuth).toHaveBeenCalledWith("CODE-1", "STATE-1");
    expect(window.location.hash).toBe("");
    expect(document.body.textContent).not.toContain("CODE-1");
  });

  it("avisa si la cuenta quedó conectada pero sin recepción de mensajes", async () => {
    window.history.replaceState(null, "", `${SETTINGS}#tiktok_code=C&tiktok_state=S`);
    team.connectTikTokOAuth.mockResolvedValue({ account: tiktok(), webhook: "skipped" });
    setup();
    expect(await screen.findByText(/Falta configurar la URL que recibe los mensajes/)).toBeInTheDocument();
  });

  it("muestra el rechazo del canje y el error con que vuelve TikTok", async () => {
    window.history.replaceState(null, "", `${SETTINGS}#tiktok_code=C&tiktok_state=S`);
    team.connectTikTokOAuth.mockRejectedValue(apiError(403, "La conexión con TikTok la inició otro usuario."));
    const first = setup();
    expect(await within(card("tiktok")).findByRole("alert")).toHaveTextContent("otro usuario");
    first.unmount();

    window.history.replaceState(null, "", `${SETTINGS}?tiktok=error&message=Permiso%20denegado`);
    setup();
    expect(await within(card("tiktok")).findByRole("alert")).toHaveTextContent("Permiso denegado");
    expect(window.location.search).toBe("");
    expect(team.connectTikTokOAuth).toHaveBeenCalledTimes(1);
  });

  it("eliminar pide confirmación y llama al endpoint con el id", async () => {
    team.listTikTokAccounts.mockResolvedValue([tiktok()]);
    team.deleteTikTokAccount.mockResolvedValue(undefined);
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar cuenta Tienda TT" }));
    expect(team.deleteTikTokAccount).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(team.deleteTikTokAccount).toHaveBeenCalled());
    expect(team.deleteTikTokAccount.mock.calls[0][0]).toBe("t1");
  });
});

describe("Ajustes · descargar base (fase 3)", () => {
  it("descarga Excel con las bases elegidas y el periodo", async () => {
    team.createExport.mockResolvedValue([
      { dataset: "clients", rows: [{ nombre: "Ana" }], truncated: false },
    ]);
    setup();
    const box = await screen.findByTestId("card-export");
    await within(box).findByText("Todavía nadie descargó la base.");
    fireEvent.click(within(box).getByRole("checkbox", { name: "Pedidos" }));
    fireEvent.change(within(box).getByLabelText("Periodo"), { target: { value: "30" } });
    fireEvent.click(within(box).getByRole("button", { name: /Descargar Excel/ }));
    await waitFor(() =>
      expect(team.createExport).toHaveBeenCalledWith({ datasets: ["clients"], days: 30 }),
    );
    await waitFor(() =>
      expect(mockDownload).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/^base-crm-\d{4}-\d{2}-\d{2}\.xlsx$/)),
    );
  });

  it("sin bases elegidas no deja descargar", async () => {
    setup();
    const box = await screen.findByTestId("card-export");
    fireEvent.click(within(box).getByRole("checkbox", { name: "Pedidos" }));
    fireEvent.click(within(box).getByRole("checkbox", { name: "Clientes" }));
    expect(within(box).getByText("Elige al menos una base para descargar.")).toBeInTheDocument();
    expect(within(box).getByRole("button", { name: /Descargar Excel/ })).toBeDisabled();
  });

  it("muestra el registro de descargas", async () => {
    team.getExportLog.mockResolvedValue([
      {
        id: "e1",
        userId: "u1",
        userEmail: "admin@tienda.pe",
        dataset: "orders",
        filters: { days: 90 },
        rowCount: 42,
        createdAt: "2026-11-22T15:00:00.000Z",
      },
    ] as never);
    setup();
    const log = await screen.findByTestId("export-log");
    const row = within(log).getAllByRole("row")[1];
    expect(row).toHaveTextContent("admin@tienda.pe");
    expect(row).toHaveTextContent("Pedidos");
    expect(row).toHaveTextContent("Todas las tiendas · Últimos 90 días");
    expect(row).toHaveTextContent("42");
  });
});
