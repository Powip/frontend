import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PauView, { type PauTab } from "@/components/ventas-chat/PauView";
import { resetCrmMeCache } from "@/hooks/useCrmMe";
import * as svc from "@/services/crmService";
import type { PauConfig, PauProvider, PauSettings, PauUsage } from "@/types/crm";

let mockRole = "ADMIN";
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
  getPauUsage: jest.fn(),
}));
const s = svc as jest.Mocked<typeof svc>;

beforeAll(() => {
  global.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const CONFIG: PauConfig = {
  phases: { st1: 2 },
  phase: 3,
  channels: { whatsapp: true, instagram: true, messenger: true, comments: false },
  offHours: "answer",
  personality: {
    treatment: "tu",
    warmth: "cercano",
    emojis: "pocos",
    firmness: "estandar",
    greeting: "Hola",
    farewell: "Gracias",
    brandWords: "",
    avoidWords: "",
    forbiddenTopics: "política",
    collectionDays: "LS",
    collectionFrom: "08:00",
    collectionTo: "20:00",
  },
  capabilities: {
    createOrder: true,
    powipLink: true,
    deposit: true,
    collectBalance: true,
    documents: true,
    catalog: true,
    material: true,
    discounts: false,
  },
  reminders: [{ after: "+1 h", text: "Recordatorio amable con el link" }],
  handoff: { asksPerson: true, complaint: true, afterFailedAttempts: 2, amountOver: 600, codRisk: true, wholesale: true },
  providers: { order: [], timeoutSeconds: 8, allFail: "handoff", monthlyCapSoles: null, capAction: "copilot", modelByTask: {} },
};
const settings: PauSettings = {
  mode: "copilot",
  instructions: "",
  knowledge: "",
  monthlyTokenCap: null,
  hasProvider: true,
  config: CONFIG,
};
const provider = (id: string, label: string): PauProvider => ({
  id,
  provider: "anthropic",
  label,
  keyHint: "**a1b2",
  model: "claude-sonnet-5-5",
  isDefault: id === "p1",
  lastTestOk: true,
  lastTestAt: null,
  lastTestError: null,
  createdAt: new Date().toISOString(),
});
const USAGE: PauUsage = {
  since: "2026-11-01T00:00:00.000Z",
  calls: 3,
  inputTokens: 100,
  outputTokens: 50,
  totalTokens: 150,
  monthlyTokenCap: null,
  byProvider: [{ providerId: "p1", label: "Principal", model: "claude-sonnet-5-5", tasks: 3, messages: 2, tokens: 150 }],
  byKind: [],
};

function setup(tab: PauTab) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PauView defaultTab={tab} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = "ADMIN";
  resetCrmMeCache();
  s.getCrmMe.mockImplementation(
    async () =>
      ({
        level: mockRole === "ADMIN" ? "admin" : "agent",
        stores: [
          { id: "st1", name: "KUNCA" },
          { id: "st2", name: "LIVII" },
        ],
        phoneMasked: false,
      }) as Awaited<ReturnType<typeof svc.getCrmMe>>,
  );
  s.getPauSettings.mockResolvedValue(settings);
  s.updatePauSettings.mockResolvedValue(settings);
  s.listPauProviders.mockResolvedValue([provider("p1", "Principal"), provider("p2", "Respaldo")]);
  s.getPauUsage.mockResolvedValue(USAGE);
});

describe("Pau · fase y canales (P4–P6)", () => {
  it("fase por tienda: se elige la tienda y guarda solo la tienda tocada", async () => {
    setup("modo");
    // Una tienda a la vez: primero KUNCA; LIVII se elige en el selector de tienda.
    const kunca = await screen.findByRole("radiogroup", { name: "Fase de Pau en KUNCA" });
    expect(within(kunca).getByRole("radio", { name: /Fase 2/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("radiogroup", { name: "Fase de Pau en LIVII" })).not.toBeInTheDocument();
    const picker = screen.getByRole("tablist", { name: "Tienda a configurar" });
    fireEvent.click(within(picker).getByRole("tab", { name: "LIVII" }));
    const livii = await screen.findByRole("radiogroup", { name: "Fase de Pau en LIVII" });
    expect(within(livii).getByRole("radio", { name: /Fase 3/ })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(within(livii).getByRole("radio", { name: /Fase 0/ }));
    await waitFor(() => expect(s.updatePauSettings).toHaveBeenCalledWith({ config: { phases: { st2: 0 } } }));
  });

  it("apagar Instagram; TikTok no se muestra (el CRM es solo WhatsApp y Meta)", async () => {
    setup("modo");
    fireEvent.click(await screen.findByRole("switch", { name: "Instagram" }));
    await waitFor(() =>
      expect(s.updatePauSettings).toHaveBeenCalledWith({ config: { channels: { instagram: false } } }),
    );
    expect(screen.queryByText("Próximamente")).not.toBeInTheDocument();
    expect(screen.queryByText("TikTok")).not.toBeInTheDocument();
  });

  it("la vendedora no ve fases ni canales", async () => {
    mockRole = "SELLER";
    setup("modo");
    await screen.findByTestId("pau-summary");
    expect(screen.queryByRole("radiogroup", { name: /Fase de Pau/ })).not.toBeInTheDocument();
  });
});

describe("Pau · personalidad (P7)", () => {
  it("guarda solo lo cambiado y muestra lo no configurable", async () => {
    setup("pers");
    const trato = await screen.findByRole("radiogroup", { name: "Tratamiento" });
    fireEvent.click(within(trato).getByRole("radio", { name: "Usted" }));
    fireEvent.change(screen.getByLabelText("Palabras a evitar"), { target: { value: "barato" } });
    fireEvent.click(screen.getByRole("button", { name: /Guardar personalidad/ }));
    await waitFor(() =>
      expect(s.updatePauSettings).toHaveBeenCalledWith({
        config: { personality: { treatment: "usted", avoidWords: "barato" } },
      }),
    );
    expect(screen.getByText(/Verdad operativa/)).toBeInTheDocument();
  });
});

describe("Pau · qué puede hacer (P8)", () => {
  it("Pau vende completo: crear pedido, link de pago, adelanto y cobro se pueden activar (25-nov)", async () => {
    setup("perm");
    for (const name of [
      "Crear el pedido en Comercial › Ventas",
      "Enviar el POWIP Link de pago",
      "Ofrecer pagar solo el adelanto (según la política de la tienda)",
      "Cobrar adelantos y saldos pendientes",
    ]) {
      expect(await screen.findByRole("switch", { name })).toBeEnabled();
    }
    expect(screen.queryByText(/Pau solo cotiza/)).not.toBeInTheDocument();
  });

  it("switch de permiso y monto para pasar a persona", async () => {
    setup("perm");
    fireEvent.click(await screen.findByRole("switch", { name: "Dar descuentos" }));
    await waitFor(() =>
      expect(s.updatePauSettings).toHaveBeenCalledWith({ config: { capabilities: { discounts: true } } }),
    );
    const monto = screen.getByLabelText("Monto");
    fireEvent.change(monto, { target: { value: "800" } });
    fireEvent.blur(monto);
    await waitFor(() =>
      expect(s.updatePauSettings).toHaveBeenCalledWith({ config: { handoff: { amountOver: 800 } } }),
    );
  });
});

describe("Pau · proveedores y consumo (P9, P11)", () => {
  it("bajar el principal guarda el nuevo orden", async () => {
    setup("prov");
    fireEvent.click(await screen.findByRole("button", { name: "Bajar Principal" }));
    await waitFor(() =>
      expect(s.updatePauSettings).toHaveBeenCalledWith({ config: { providers: { order: ["p2", "p1"] } } }),
    );
  });

  it("tabla de uso por proveedor sin inventar soles", async () => {
    setup("cons");
    const table = await screen.findByTestId("pau-usage-by-provider");
    expect(within(table).getByText("Principal")).toBeInTheDocument();
    expect(within(table).getByText("Sin precio")).toBeInTheDocument();
  });

  it("precio por proveedor se guarda y el medidor compara el gasto con el tope", async () => {
    s.getPauUsage.mockResolvedValue({ ...USAGE, spentSoles: 42, monthlyCapSoles: 50 });
    s.getPauSettings.mockResolvedValue({ ...settings, config: { ...settings.config, providers: { ...settings.config.providers, monthlyCapSoles: 50 } } });
    setup("prov");
    const meter = await screen.findByTestId("pau-spend-meter");
    await waitFor(() => expect(meter).toHaveTextContent("S/ 42.00 de S/ 50.00"));
    expect(meter).toHaveTextContent("84 % del tope · aviso al 80 %");
    const price = await screen.findByLabelText("Precio por millón de tokens de Principal");
    fireEvent.change(price, { target: { value: "12.5" } });
    fireEvent.blur(price);
    await waitFor(() =>
      expect(s.updatePauSettings).toHaveBeenCalledWith({ config: { providers: { pricePerMTokens: { p1: 12.5 } } } }),
    );
  });
});
