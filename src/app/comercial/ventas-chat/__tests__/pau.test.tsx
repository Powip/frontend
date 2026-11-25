import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PauView, { type PauTab } from "@/components/ventas-chat/PauView";
import { VENTAS_CHAT_TABS } from "@/app/comercial/ventas-chat/tabs";
import { describeToolCall } from "@/components/ventas-chat/pau";
import { resetCrmMeCache } from "@/hooks/useCrmMe";
import * as svc from "@/services/crmService";
import type { PauProvider, PauSettings, PauUsage } from "@/types/crm";

let mockRole = "ADMIN";
let mockStores: Array<{ id: string; name: string }> = [];
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { accessToken: "t", user: { id: "u1", name: "Jairo", role: mockRole }, company: { id: "co1" } },
  }),
}));
jest.mock("@/config/permissions.config", () => ({
  hasAdminAccess: (role?: string) => role === "ADMIN",
}));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => "/comercial/ventas-chat/pau",
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock("@/services/crmService", () => ({
  ...jest.requireActual("@/services/crmService"),
  getCrmMe: jest.fn(),
  getPauSettings: jest.fn(),
  updatePauSettings: jest.fn(),
  listPauProviders: jest.fn(),
  createPauProvider: jest.fn(),
  updatePauProvider: jest.fn(),
  deletePauProvider: jest.fn(),
  testPauProvider: jest.fn(),
  getPauUsage: jest.fn(),
  pauSandbox: jest.fn(),
}));
const s = svc as jest.Mocked<typeof svc>;

beforeAll(() => {
  global.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const SECRET = "sk-ant-SECRETO-123456";

const settings = (over: Partial<PauSettings> = {}): PauSettings => ({
  mode: "off",
  instructions: "Habla de tú.",
  knowledge: "Envíos a todo el Perú.",
  monthlyTokenCap: null,
  hasProvider: true,
  ...over,
});
const provider = (over: Partial<PauProvider> = {}): PauProvider => ({
  id: "pr1",
  provider: "anthropic",
  label: "Cuenta principal",
  keyHint: "••••a1b2",
  model: "claude-opus-5-5",
  isDefault: true,
  lastTestOk: true,
  lastTestAt: new Date().toISOString(),
  lastTestError: null,
  createdAt: new Date().toISOString(),
  ...over,
});
const USAGE: PauUsage = {
  since: "2026-11-01T00:00:00.000Z",
  calls: 14,
  inputTokens: 400,
  outputTokens: 150,
  totalTokens: 550,
  monthlyTokenCap: 1100,
  byKind: [
    { kind: "suggest", calls: 6, inputTokens: 200, outputTokens: 60 },
    { kind: "auto", calls: 5, inputTokens: 150, outputTokens: 70 },
    { kind: "sandbox", calls: 2, inputTokens: 40, outputTokens: 15 },
    { kind: "test", calls: 1, inputTokens: 10, outputTokens: 5 },
  ],
};

let mockTab: PauTab = "modo";
function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PauView defaultTab={mockTab} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = "ADMIN";
  mockTab = "modo";
  mockStores = [];
  resetCrmMeCache();
  s.getCrmMe.mockImplementation(async () => ({
    level: mockRole === "ADMIN" ? "admin" : "agent",
    stores: mockStores,
    phoneMasked: false,
  }) as Awaited<ReturnType<typeof svc.getCrmMe>>);
  s.getPauSettings.mockResolvedValue(settings());
  s.updatePauSettings.mockImplementation(async (input) => settings(input as Partial<PauSettings>));
  s.listPauProviders.mockResolvedValue([provider()]);
  s.getPauUsage.mockResolvedValue(USAGE);
  s.testPauProvider.mockResolvedValue({ ok: true, error: null, models: [], provider: provider() });
});

describe("pestaña", () => {
  it("Pau va después de Equipo, como en el mockup 152", () => {
    const labels = VENTAS_CHAT_TABS.map((t) => t.label);
    expect(labels[labels.indexOf("Equipo") + 1]).toBe("Pau");
    expect(VENTAS_CHAT_TABS.find((t) => t.label === "Pau")?.href).toBe("/comercial/ventas-chat/pau");
  });
});

describe("Pau · quién atiende", () => {
  it("elegir Copiloto hace PATCH directo", async () => {
    setup();
    fireEvent.click(await screen.findByRole("radio", { name: /Copiloto/ }));
    await waitFor(() => expect(s.updatePauSettings).toHaveBeenCalledWith({ mode: "copilot" }));
  });

  it("elegir «Pau responde solo» pide confirmación y luego hace PATCH", async () => {
    setup();
    fireEvent.click(await screen.findByRole("radio", { name: /Pau vende y cobra/ }));
    expect(s.updatePauSettings).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Finanzas da el visto final/)).toBeInTheDocument();
    expect(within(dialog).getByText(/pasa el chat a una persona/i)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Sí, que venda sola" }));
    await waitFor(() => expect(s.updatePauSettings).toHaveBeenCalledWith({ mode: "auto" }));
  });

  it("cancelar la confirmación no cambia nada", async () => {
    setup();
    fireEvent.click(await screen.findByRole("radio", { name: /Pau vende y cobra/ }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(s.updatePauSettings).not.toHaveBeenCalled();
  });

  it("sin proveedor bloquea Copiloto y Auto y enlaza a Proveedores", async () => {
    s.getPauSettings.mockResolvedValue(settings({ hasProvider: false }));
    s.listPauProviders.mockResolvedValue([]);
    setup();
    const copilot = await screen.findByRole("radio", { name: /Copiloto/ });
    expect(copilot).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Pau vende y cobra/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Solo CRM/ })).not.toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Proveedores de IA");
  });
});

describe("Pau · no administrador", () => {
  it("ve el modo actual y el aviso, sin llamar a endpoints de administrador", async () => {
    mockRole = "VENTAS";
    s.getPauSettings.mockResolvedValue(settings({ mode: "copilot" }));
    setup();
    expect(await screen.findByTestId("pau-current-mode")).toHaveTextContent("Copiloto");
    expect(screen.getByText("Solo un administrador puede configurar a Pau.")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Proveedores de IA" })).not.toBeInTheDocument();
    expect(s.listPauProviders).not.toHaveBeenCalled();
    expect(s.getPauUsage).not.toHaveBeenCalled();
    expect(s.pauSandbox).not.toHaveBeenCalled();
  });
});

describe("Pau · proveedores", () => {
  beforeEach(() => {
    mockTab = "prov";
  });

  it("lista con llave enmascarada, modelo, predeterminado y última prueba", async () => {
    setup();
    const row = await screen.findByTestId("provider-row");
    expect(within(row).getByText("Cuenta principal")).toBeInTheDocument();
    expect(within(row).getByText("Predeterminado")).toBeInTheDocument();
    expect(within(row).getByText(/••••a1b2/)).toBeInTheDocument();
    expect(within(row).getByText(/claude-opus-5-5/)).toBeInTheDocument();
    expect(within(row).getByTestId("provider-test")).toHaveTextContent("Última prueba correcta");
  });

  it("conectar envía el payload, lanza la prueba y la llave no queda en el DOM", async () => {
    s.listPauProviders.mockResolvedValue([]);
    s.getPauSettings.mockResolvedValue(settings({ hasProvider: false }));
    s.createPauProvider.mockResolvedValue(provider({ id: "nuevo", label: "Mi Claude" }));
    s.testPauProvider.mockResolvedValue({
      ok: true,
      error: null,
      models: ["claude-opus-5-5", "claude-sonnet-5-5"],
      provider: provider({ id: "nuevo" }),
    });
    s.updatePauProvider.mockResolvedValue(provider({ id: "nuevo", model: "claude-sonnet-5-5" }));
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Conectar proveedor/ }));
    const dlg = within(await screen.findByRole("dialog"));
    expect(dlg.getByLabelText(/Modelo/)).toHaveValue("claude-opus-5-5");
    const key = dlg.getByLabelText("Llave del proveedor") as HTMLInputElement;
    expect(key.type).toBe("password");
    expect(key.autocomplete).toBe("off");
    fireEvent.change(dlg.getByLabelText("Etiqueta"), { target: { value: "Mi Claude" } });
    fireEvent.change(key, { target: { value: SECRET } });
    fireEvent.click(dlg.getByRole("button", { name: "Conectar" }));

    await waitFor(() =>
      expect(s.createPauProvider).toHaveBeenCalledWith({
        provider: "anthropic",
        label: "Mi Claude",
        apiKey: SECRET,
        model: "claude-opus-5-5",
      }),
    );
    await waitFor(() => expect(s.testPauProvider).toHaveBeenCalledWith("nuevo"));
    const result = within(await screen.findByTestId("provider-test-result"));
    expect(result.getByText("Conexión correcta. La llave funciona.")).toBeInTheDocument();
    // La llave ya no existe en el DOM ni como valor de input.
    expect(document.body.innerHTML).not.toContain(SECRET);
    expect(screen.queryByDisplayValue(SECRET)).not.toBeInTheDocument();

    // Ofrece elegir modelo de la lista de la cuenta.
    fireEvent.change(result.getByLabelText("Modelo que usará Pau"), {
      target: { value: "claude-sonnet-5-5" },
    });
    fireEvent.click(result.getByRole("button", { name: "Usar este modelo" }));
    await waitFor(() =>
      expect(s.updatePauProvider).toHaveBeenCalledWith("nuevo", { model: "claude-sonnet-5-5" }),
    );
  });

  it("OpenAI exige el modelo; no envía sin él", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Conectar proveedor/ }));
    const dlg = within(await screen.findByRole("dialog"));
    fireEvent.change(dlg.getByLabelText("Proveedor"), { target: { value: "openai" } });
    expect(dlg.getByLabelText(/Modelo/)).toHaveValue("");
    fireEvent.change(dlg.getByLabelText("Etiqueta"), { target: { value: "OA" } });
    fireEvent.change(dlg.getByLabelText("Llave del proveedor"), { target: { value: "sk-x" } });
    fireEvent.click(dlg.getByRole("button", { name: "Conectar" }));
    expect(await dlg.findByText("OpenAI necesita que indiques el modelo")).toBeInTheDocument();
    expect(s.createPauProvider).not.toHaveBeenCalled();
  });

  it("muestra el mensaje del servidor si falta la clave de cifrado", async () => {
    const AxiosError = (jest.requireActual("axios") as typeof import("axios")).AxiosError;
    s.createPauProvider.mockRejectedValue(
      new AxiosError("x", "ERR", undefined, undefined, {
        status: 503,
        data: { code: "ENCRYPTION_NOT_CONFIGURED", message: "El servidor no tiene clave de cifrado" },
      } as never),
    );
    setup();
    fireEvent.click(await screen.findByRole("button", { name: /Conectar proveedor/ }));
    const dlg = within(await screen.findByRole("dialog"));
    fireEvent.change(dlg.getByLabelText("Etiqueta"), { target: { value: "X" } });
    fireEvent.change(dlg.getByLabelText("Llave del proveedor"), { target: { value: SECRET } });
    fireEvent.click(dlg.getByRole("button", { name: "Conectar" }));
    expect(await dlg.findByText("El servidor no tiene clave de cifrado")).toBeInTheDocument();
  });

  it("probar, predeterminado y eliminar (con confirmación)", async () => {
    s.listPauProviders.mockResolvedValue([provider(), provider({ id: "pr2", label: "OpenAI", isDefault: false })]);
    s.updatePauProvider.mockResolvedValue(provider({ id: "pr2" }));
    s.deletePauProvider.mockResolvedValue(undefined);
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Probar Cuenta principal" }));
    await waitFor(() => expect(s.testPauProvider).toHaveBeenCalledWith("pr1"));
    fireEvent.click(screen.getByRole("button", { name: "Hacer predeterminado OpenAI" }));
    await waitFor(() => expect(s.updatePauProvider).toHaveBeenCalledWith("pr2", { isDefault: true }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar OpenAI" }));
    expect(s.deletePauProvider).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(s.deletePauProvider).toHaveBeenCalledWith("pr2"));
  });

  it("editar: reemplazar llave es opcional y sin llave no la envía", async () => {
    s.updatePauProvider.mockResolvedValue(provider({ label: "Renombrada" }));
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Editar Cuenta principal" }));
    const dlg = within(await screen.findByRole("dialog"));
    fireEvent.change(dlg.getByLabelText("Etiqueta"), { target: { value: "Renombrada" } });
    fireEvent.click(dlg.getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(s.updatePauProvider).toHaveBeenCalledWith("pr1", {
        label: "Renombrada",
        model: "claude-opus-5-5",
      }),
    );
    expect(s.testPauProvider).not.toHaveBeenCalled();
  });
});

describe("Pau · instrucciones y conocimiento", () => {
  beforeEach(() => {
    mockTab = "pers";
  });

  it("Guardar se activa solo con cambios, muestra contador y envía lo cambiado", async () => {
    setup();
    const save = await screen.findByRole("button", { name: "Guardar" });
    expect(save).toBeDisabled();
    expect(screen.getByTestId("knowledge-count")).toHaveTextContent("22 / 40000");
    expect(screen.getByText(/Pau solo sabe lo que esté escrito aquí/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Conocimiento del negocio"), {
      target: { value: "Envíos a todo el Perú. Yape y Plin." },
    });
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    await waitFor(() =>
      expect(s.updatePauSettings).toHaveBeenCalledWith({ knowledge: "Envíos a todo el Perú. Yape y Plin." }),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled());
  });
});

describe("Pau · consumo", () => {
  beforeEach(() => {
    mockTab = "cons";
  });

  it("muestra tokens, llamadas, desglose, barra contra el tope y fija/quita el tope", async () => {
    setup();
    const stats = await screen.findAllByTestId("usage-stat");
    expect(stats.map((c) => c.textContent)).toEqual([
      expect.stringContaining("400"),
      expect.stringContaining("150"),
      expect.stringContaining("550"),
      expect.stringContaining("14"),
    ]);
    const kinds = screen.getAllByTestId("usage-kind").map((k) => k.textContent);
    expect(kinds[0]).toContain("Sugerencias");
    expect(kinds[1]).toContain("Respuestas automáticas");
    // Pruebas junta sandbox + test: 3 llamadas.
    expect(kinds[2]).toContain("Pruebas");
    expect(kinds[2]).toContain("3 llamadas");
    expect(screen.getByTestId("usage-cap")).toHaveTextContent("550 de 1,100 tokens (50 %)");

    fireEvent.change(screen.getByLabelText("Tope mensual de tokens"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Fijar tope" }));
    expect(await screen.findByText(/al menos 1,000 tokens/)).toBeInTheDocument();
    expect(s.updatePauSettings).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Tope mensual de tokens"), { target: { value: "2000" } });
    fireEvent.click(screen.getByRole("button", { name: "Fijar tope" }));
    await waitFor(() => expect(s.updatePauSettings).toHaveBeenCalledWith({ monthlyTokenCap: 2000 }));
    fireEvent.click(await screen.findByRole("button", { name: "Quitar tope" }));
    await waitFor(() => expect(s.updatePauSettings).toHaveBeenCalledWith({ monthlyTokenCap: null }));
  });
});

describe("Pau · probar a Pau", () => {
  beforeEach(() => {
    mockTab = "pers";
  });

  it("envía el historial completo en cada turno y pinta acciones y modelo", async () => {
    s.pauSandbox
      .mockResolvedValueOnce({ text: "Hola, ¿en qué te ayudo?", refused: false, model: "claude-opus-5-5", toolCalls: [] })
      .mockResolvedValueOnce({
        text: "Te paso con una asesora.",
        refused: false,
        model: "claude-opus-5-5",
        toolCalls: [
          { name: "pedir_ayuda_humana", input: { motivo: "Pide factura con RUC" } },
          { name: "crear_recordatorio", input: { titulo: "Llamar a Ana", en_horas: 2 } },
          { name: "mover_etapa", input: { etapa: "Cotizado" } },
        ],
      });
    setup();
    const box = await screen.findByLabelText("Mensaje de ensayo");
    fireEvent.change(box, { target: { value: "Hola" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar ensayo" }));
    await waitFor(() =>
      expect(s.pauSandbox).toHaveBeenNthCalledWith(1, [{ role: "user", text: "Hola" }]),
    );
    expect(await screen.findByText("Hola, ¿en qué te ayudo?")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Mensaje de ensayo"), { target: { value: "Necesito factura" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar ensayo" }));
    await waitFor(() =>
      expect(s.pauSandbox).toHaveBeenNthCalledWith(2, [
        { role: "user", text: "Hola" },
        { role: "assistant", text: "Hola, ¿en qué te ayudo?" },
        { role: "user", text: "Necesito factura" },
      ]),
    );
    const actions = await screen.findByTestId("sandbox-actions");
    expect(within(actions).getByText("Pediría ayuda a una asesora: Pide factura con RUC")).toBeInTheDocument();
    expect(within(actions).getByText("Crearía un recordatorio en 2 h: Llamar a Ana")).toBeInTheDocument();
    expect(within(actions).getByText("Movería el chat a Cotizado")).toBeInTheDocument();
    expect(screen.getAllByTestId("sandbox-model")[0]).toHaveTextContent("Modelo: claude-opus-5-5");
    expect(screen.getByText(/no se envía nada por WhatsApp/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Reiniciar/ }));
    expect(screen.queryByText("Hola, ¿en qué te ayudo?")).not.toBeInTheDocument();
  });

  it("si falla, muestra el error y conserva el texto escrito", async () => {
    const AxiosError = (jest.requireActual("axios") as typeof import("axios")).AxiosError;
    s.pauSandbox.mockRejectedValue(
      new AxiosError("x", "ERR", undefined, undefined, {
        status: 502,
        data: { code: "PAU_INVALID_KEY", message: "La llave del proveedor no es válida" },
      } as never),
    );
    setup();
    fireEvent.change(await screen.findByLabelText("Mensaje de ensayo"), { target: { value: "Hola" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar ensayo" }));
    expect(await screen.findByText("La llave del proveedor no es válida")).toBeInTheDocument();
    expect(screen.getByLabelText("Mensaje de ensayo")).toHaveValue("Hola");
  });
});

describe("describeToolCall", () => {
  it("acción desconocida se nombra sin romper", () => {
    expect(describeToolCall({ name: "otra", input: {} })).toBe("Haría la acción «otra»");
    expect(describeToolCall({ name: "mover_etapa", input: {} })).toBe("Movería el chat a —");
  });
});
