import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdvertisingSettings } from "../Settings";
import { adsGet, adsWrite, getAdsSales, saveAdsSettings } from "@/services/advertisingV22Service";
import type { AdsSettings } from "@/services/advertisingV22Service";

const mockIdentity = { companyId: "company-a", token: "test-token" };
const mockReload = jest.fn();
let mockSettings: AdsSettings;
let mockStatus = {
  preferences: { enabled: true, time: "08:00", destinationsCount: 1 },
  scheduler: { enabled: false },
  readiness: { ready: true, scope: "local" },
  automation: { state: "disabled", reasons: [{ code: "AUTOMATION_DISABLED", message: "Solicita a soporte habilitar la automatización." }] },
  deliveries: ["sent", "pending", "unknown"].map((status) => ({
    id: status, date: "2026-10-23", kind: "daily", status, destination: "+51911111111",
    errorCode: status === "unknown" ? "WHATSAPP_SEND_FAILED" : null,
    createdAt: "2026-10-23T20:00:00Z", updatedAt: "2026-10-23T20:01:00Z",
  })),
};

jest.mock("../context", () => ({
  useAdsV22: () => ({ identity: mockIdentity, actorId: "actor-a", settings: mockSettings, reload: mockReload }),
  useRefreshAds: () => jest.fn(),
  useAdsQuery: (key: unknown[], request: (identity: unknown, signal: AbortSignal) => Promise<unknown>, enabled = true) => {
    const query = jest.requireActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
    return query.useQuery({ queryKey: key, queryFn: ({ signal }) => request(mockIdentity, signal), enabled, retry: false });
  },
}));
jest.mock("@/contexts/AdminPeriodContext", () => ({ useAdminPeriod: () => ({ fromDate: "2026-10-01", toDate: "2026-10-23" }) }));
jest.mock("../../AdvertisingStoreFilterContext", () => ({ useAdvertisingStoreFilter: () => ({ storeId: "all", stores: [] }) }));
jest.mock("../../AdvertisingLivePanel", () => ({ AdvertisingLivePanel: () => null }));
jest.mock("../../AdvertisingStoreAssignmentsPanel", () => ({ AdvertisingStoreAssignmentsPanel: () => null }));
jest.mock("../ProfitConnections", () => ({ ProfitConnections: () => null }));
jest.mock("@/services/businessProductsService", () => ({ fetchBusinessProducts: jest.fn() }));
jest.mock("@/services/advertisingV22Service", () => ({
  adsGet: jest.fn(), adsWrite: jest.fn(), saveAdsSettings: jest.fn(),
  getAllAdsCatalog: jest.fn().mockResolvedValue({ accounts: [], rows: [] }), getAdsSales: jest.fn(),
}));
jest.mock("../shared", () => ({
  Block: ({ title, children }: { title: string; children: React.ReactNode }) => <section><h2>{title}</h2>{children}</section>,
  Failure: ({ error }: { error: unknown }) => <p role="alert">{error instanceof Error ? error.message : "Error al consultar"}</p>,
  SelectField: () => null,
  exportAdsWorkbook: jest.fn(),
}));

function mount() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AdvertisingSettings /></QueryClientProvider>);
}
beforeAll(() => {
  if (!global.structuredClone) global.structuredClone = (value) => JSON.parse(JSON.stringify(value));
});
beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState({}, "", "/publicidad/configuracion");
  mockSettings = {
    version: 1,
    rules: { noResultsDays: 3, minSpend: "10", nearLimitPct: 90, highFrequency: 3, winPct: 20, testMultiplier: 2, testMinSales: 3 },
    budgets: [], whatsapp: { enabled: true, time: "08:00", numbers: ["+51911111111"], includes: ["performance"] },
    permissions: [], tags: { hooks: [], creators: [] },
    capabilities: { view: true, spend: true, profit: true, edit: true, configure: true },
  };
  jest.mocked(adsGet).mockImplementation(async (_identity, path) => {
    if (path === "/v22/whatsapp/status") return mockStatus as never;
    if (path === "/v22/whatsapp/preview") return { text: "Vista previa con datos reales" } as never;
    return {} as never;
  });
  jest.mocked(saveAdsSettings).mockResolvedValue(mockSettings);
  mockReload.mockResolvedValue(undefined);
});

it("loads status only after opening WhatsApp and separates saved preference from automation availability", async () => {
  mount();
  expect(adsGet).not.toHaveBeenCalledWith(mockIdentity, "/v22/whatsapp/status", undefined, expect.anything());
  fireEvent.click(screen.getByRole("button", { name: "Resumen diario por WhatsApp" }));
  expect(await screen.findByText("Automatización deshabilitada")).toBeInTheDocument();
  expect(screen.getByText(/Solicitud de resumen diario guardada/)).toBeInTheDocument();
  expect(screen.getByText("Solicita a soporte habilitar la automatización.")).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "Solicitar resumen diario" })).toBeChecked();
  expect(adsGet).toHaveBeenCalledWith(mockIdentity, "/v22/whatsapp/status", undefined, expect.any(AbortSignal));
  expect(screen.getByText("Enviado al proveedor")).toBeInTheDocument();
  expect(screen.getByText("Pendiente")).toBeInTheDocument();
  expect(screen.getByText("Sin confirmación")).toBeInTheDocument();
  expect(screen.getByText(/la recepción no está confirmada/)).toBeInTheDocument();
  expect(screen.getByText(/Revisa el proveedor antes de repetir/)).toBeInTheDocument();
  expect(adsWrite).not.toHaveBeenCalled();
});

it("keeps status and history hidden from observers and never fetches destination data", async () => {
  mockSettings.capabilities.configure = false;
  mockSettings.whatsapp.numbers = [];
  window.history.replaceState({}, "", "/publicidad/configuracion?section=whatsapp");
  mount();
  expect(await screen.findByText(/Se requiere permiso de configuración para consultar el estado/)).toBeInTheDocument();
  expect(screen.queryByText("+51911111111")).not.toBeInTheDocument();
  expect(screen.queryByText("Historial de envíos")).not.toBeInTheDocument();
  expect(adsGet).not.toHaveBeenCalled();
  expect(adsWrite).not.toHaveBeenCalled();
});

it("saves a preference and refreshes status without sending a test or claiming activation", async () => {
  window.history.replaceState({}, "", "/publicidad/configuracion?section=whatsapp");
  mount();
  await screen.findByText("Automatización deshabilitada");
  const reads = jest.mocked(adsGet).mock.calls.filter(([, path]) => path === "/v22/whatsapp/status").length;
  fireEvent.click(screen.getByRole("button", { name: "Guardar resumen" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Preferencias de WhatsApp guardadas. Revisa el estado de la automatización.");
  expect(saveAdsSettings).toHaveBeenCalledWith(mockIdentity, mockSettings);
  await waitFor(() => expect(jest.mocked(adsGet).mock.calls.filter(([, path]) => path === "/v22/whatsapp/status").length).toBeGreaterThan(reads));
  expect(adsWrite).not.toHaveBeenCalled();
});

it("shows status failures without describing automation as available", async () => {
  window.history.replaceState({}, "", "/publicidad/configuracion?section=whatsapp");
  jest.mocked(adsGet).mockImplementation(async (_identity, path) => {
    if (path === "/v22/whatsapp/status") throw new Error("No se pudo consultar WhatsApp");
    return { text: "Vista previa" } as never;
  });
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo consultar WhatsApp");
  expect(screen.queryByText("Programación disponible")).not.toBeInTheDocument();
  expect(adsWrite).not.toHaveBeenCalled();
});

it.each([
  ["blocked", "Automatización pendiente de configuración"],
  ["scheduled", "Programación disponible"],
])("describes %s local readiness without inventing a delivery", async (state, label) => {
  window.history.replaceState({}, "", "/publicidad/configuracion?section=whatsapp");
  mockStatus = {
    ...mockStatus,
    scheduler: { enabled: true },
    readiness: { ready: state === "scheduled", scope: "local" },
    automation: { state, reasons: [] },
    deliveries: [],
  };
  mount();
  expect(await screen.findByText(label)).toBeInTheDocument();
  expect(screen.getByText("No hay envíos registrados para esta empresa.")).toBeInTheDocument();
  expect(screen.getByText(/Este estado verifica la configuración local/)).toBeInTheDocument();
  expect(adsWrite).not.toHaveBeenCalled();
});

it("links legacy sales to the existing sales review without promising bulk assignment", async () => {
  window.history.replaceState({}, "", "/publicidad/configuracion?section=legacy");
  jest.mocked(getAdsSales).mockResolvedValue({ quality: { legacyStoreCount: 2 } } as never);
  mount();
  expect(await screen.findByText(/Las ventas sin tienda permanecen sin asignar y requieren revisión individual/)).toBeInTheDocument();
  const link = screen.getByRole("link", { name: "Revisar ventas" });
  expect(link).toHaveAttribute("href", "/ventas");
  expect(link.getAttribute("href")).not.toContain("assignStore");
  expect(screen.queryByText(/Asignar ventas a tienda/)).not.toBeInTheDocument();
  expect(adsWrite).not.toHaveBeenCalled();
  expect(saveAdsSettings).not.toHaveBeenCalled();
});
