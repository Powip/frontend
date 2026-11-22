import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";

const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockSearch = "";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  usePathname: () => "/configuracion/whatsapp",
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

jest.mock("@/services/courierService", () => ({
  fetchCouriers: jest.fn().mockResolvedValue([
    { id: "courier-1", name: "Shalom", companyId: "c-1", isActive: true, created_at: "" },
    { id: "courier-2", name: "Inactivo", companyId: "c-1", isActive: false, created_at: "" },
  ]),
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/features/whatsapp/api/templates.api", () => ({
  listWhatsAppTemplates: jest.fn().mockResolvedValue([]),
  syncWhatsAppTemplates: jest.fn().mockResolvedValue([]),
  createWhatsAppTemplate: jest.fn(),
}));

jest.mock("@/features/whatsapp/api/rules.api", () => ({
  getWhatsAppRules: jest.fn().mockResolvedValue({
    items: [],
    summary: { activeCount: 0, estimatedMonthly: 0 },
  }),
  saveWhatsAppRule: jest.fn(),
  activateWhatsAppRule: jest.fn(),
  deactivateWhatsAppRule: jest.fn(),
  updateWhatsAppRule: jest.fn(),
}));

jest.mock("@/features/whatsapp/api/settings.api", () => ({
  getWhatsAppSettings: jest.fn().mockResolvedValue({
    schedule: {
      days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
      from: "08:00",
      to: "20:00",
      outOfHours: "SILENT",
      timezone: "America/Lima",
    },
    dedupe: false,
    maxPerOrderPerDay: 3,
    missingData: { notifyAgent: false, sendWhenFixed: false },
    autoReply: null,
    optOutByKeyword: false,
    foreignNumbers: { inbound: "REJECTED", allowOutbound: false },
    version: 0,
  }),
  updateWhatsAppSettings: jest.fn(),
}));

jest.mock("@/features/whatsapp/api/queue.api", () => ({
  getWhatsAppUpcomingQueue: jest.fn().mockResolvedValue({
    total: 0,
    groups: [],
  }),
  getWhatsAppMessages: jest.fn().mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 10,
    total: 0,
    hasMore: false,
  }),
  limaTodayStartIso: jest.fn(() => "2026-10-30T00:00:00Z"),
}));

import { useAuth } from "@/contexts/AuthContext";
import { WHATSAPP_TAB_STORAGE_KEY } from "@/features/whatsapp/constants/whatsapp-tabs";
import WhatsAppSettingsPage from "../page";

const mockedUseAuth = useAuth as jest.Mock;

function render(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

function mockAuth(
  role: string,
  stores = [
    { id: "s-1", name: "LIVII" },
    { id: "s-2", name: "KUNCA" },
  ],
) {
  mockedUseAuth.mockReturnValue({
    auth: {
      user: { email: "persona@empresa.pe", id: "u-1", role, permissions: [] },
      company: { id: "c-1", name: "Empresa", stores },
    },
  });
}

async function renderPage(search = "") {
  mockSearch = search;
  render(<WhatsAppSettingsPage />);
  return screen.findByRole("tablist");
}

function selectedTabName() {
  return screen.getAllByRole("tab").find((tab) => tab.getAttribute("aria-selected") === "true")
    ?.textContent;
}

beforeAll(() => {
  Element.prototype.scrollIntoView = () => undefined;
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  mockReplace.mockClear();
  mockPush.mockClear();
  window.localStorage.clear();
  mockAuth("ADMINISTRADOR");
});

describe("WhatsAppSettingsPage", () => {
  it("muestra el título y las seis pestañas", async () => {
    await renderPage();
    expect(
      screen.getByRole("heading", { level: 1, name: "Notificaciones por WhatsApp" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Conexión",
      "Plantillas",
      "Programación",
      "Conversaciones",
      "Historial de envíos",
      "Bajas, alertas y permisos",
    ]);
  });

  it("abre la pestaña indicada en la URL aunque haya otra guardada", async () => {
    window.localStorage.setItem(WHATSAPP_TAB_STORAGE_KEY, "plantillas");
    await renderPage("tab=historial");
    expect(selectedTabName()).toBe("Historial de envíos");
    expect(window.localStorage.getItem(WHATSAPP_TAB_STORAGE_KEY)).toBe("historial");
  });

  it("usa la preferencia guardada si la URL no indica pestaña", async () => {
    window.localStorage.setItem(WHATSAPP_TAB_STORAGE_KEY, "programacion");
    await renderPage();
    await waitFor(() => expect(selectedTabName()).toBe("Programación"));
  });

  it("ignora valores desconocidos y vuelve a Conexión", async () => {
    window.localStorage.setItem(WHATSAPP_TAB_STORAGE_KEY, "otra");
    await renderPage("tab=no-existe");
    expect(selectedTabName()).toBe("Conexión");
  });

  it("al cambiar de pestaña actualiza la URL y la preferencia sin perder otros parámetros", async () => {
    const user = userEvent.setup();
    await renderPage("tab=conexion&ref=menu");
    await user.click(screen.getByRole("tab", { name: "Plantillas" }));
    expect(mockPush).toHaveBeenCalledWith("/configuracion/whatsapp?tab=plantillas&ref=menu", {
      scroll: false,
    });
    expect(window.localStorage.getItem(WHATSAPP_TAB_STORAGE_KEY)).toBe("plantillas");
  });

  it("la pestaña conexion carga datos pero sin números conectados", async () => {
    await renderPage("tab=conexion");
    // Con el backend conectado, muestra "Cargando estado…" mientras carga, o estado sin conexión
    expect(screen.queryByText(/Conectado ·|S\/ \d|USD \d/)).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar prueba" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("el historial queda pendiente sin ceros, porcentajes ni filas", async () => {
    await renderPage("tab=historial");
    expect(screen.getByText("Indicadores pendientes de integración")).toBeInTheDocument();
    expect(screen.getByText("Mensajes pendientes de integración")).toBeInTheDocument();
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Últimos 7 días" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Exportar Excel" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("bajas, alertas y permisos muestra sugeridos sin guardar ni registros ficticios", async () => {
    await renderPage("tab=ajustes");
    expect(screen.getByText("Bajas pendientes de integración")).toBeInTheDocument();
    expect(screen.getByText("Registro pendiente de integración")).toBeInTheDocument();
    expect(screen.getAllByText(/Valores sugeridos del documento/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Matriz propuesta en el documento/)).toBeInTheDocument();
    expect(screen.getAllByText("Sin confirmar")).toHaveLength(8);
    expect(screen.getByText(/de la tienda LIVII/)).toBeInTheDocument();
  });

  it("la pestaña plantillas carga y muestra lista vacía con opción de crear plantilla", async () => {
    await renderPage("tab=plantillas");
    expect(screen.getByRole("heading", { name: "Tus plantillas" })).toBeInTheDocument();
    // Con backend conectado, muestra lista vacía o "Todavía no tienes plantillas"
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva plantilla" })).toBeInTheDocument();
  });

  it("quien no es administrador no ve «Nueva plantilla»", async () => {
    mockAuth("AGENTES");
    await renderPage("tab=plantillas");
    expect(screen.queryByRole("button", { name: "Nueva plantilla" })).not.toBeInTheDocument();
  });

  it("la pestaña programación carga reglas y formularios con valores sugeridos", async () => {
    await renderPage("tab=programacion");
    // Con backend conectado, carga reglas vacías
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    // Verifica que el botón de programar esté disponible
    expect(screen.getByRole("button", { name: "Programar envío" })).toBeInTheDocument();
  });

  it("explica el enlace desde Plantillas sin activar nada", async () => {
    await renderPage("tab=programacion&rule=pedido_en_camino&template=tpl-1");
    expect(
      screen.getByText(
        /Llegaste desde Plantillas para activar «Pedido en camino».*no se activó nada/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("al cerrar el aviso del enlace limpia los parámetros", async () => {
    const user = userEvent.setup();
    await renderPage("tab=programacion&rule=pedido_en_camino&template=tpl-1");
    await user.click(screen.getByRole("button", { name: "Cerrar aviso" }));
    expect(mockReplace).toHaveBeenCalledWith("/configuracion/whatsapp?tab=programacion", {
      scroll: false,
    });
  });

  it("al salir de Programación descarta los parámetros del enlace", async () => {
    const user = userEvent.setup();
    await renderPage("tab=programacion&rule=pedido_en_camino&template=tpl-1&ref=menu");
    await user.click(screen.getByRole("tab", { name: "Plantillas" }));
    expect(mockPush).toHaveBeenCalledWith("/configuracion/whatsapp?tab=plantillas&ref=menu", {
      scroll: false,
    });
  });

  it("la pestaña conversaciones queda pendiente sin conversaciones ni contadores", async () => {
    await renderPage("tab=conversaciones");
    expect(screen.getByText("Conversaciones pendientes de integración")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Respondió" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(
      screen.getByRole("searchbox", { name: "Buscar pedido, cliente o teléfono" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Asignadas a mí" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Respuesta automática" })).toBeInTheDocument();
  });

  it("quien no es administrador no ve la configuración de respuesta automática", async () => {
    mockAuth("AGENTES");
    await renderPage("tab=conversaciones");
    expect(screen.queryByRole("button", { name: "Respuesta automática" })).not.toBeInTheDocument();
  });

  it("un enlace a una conversación abre el panel en estado pendiente", async () => {
    mockSearch = "tab=conversaciones&thread=t-1";
    render(<WhatsAppSettingsPage />);
    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText("Conversación pendiente de integración")).toBeInTheDocument();
    expect(within(drawer).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("volver y adelante siguen la pestaña de la URL", async () => {
    await renderPage("tab=historial");
    expect(selectedTabName()).toBe("Historial de envíos");
    mockSearch = "tab=ajustes";
    const { rerender } = render(<WhatsAppSettingsPage />);
    rerender(<WhatsAppSettingsPage />);
    expect(screen.getAllByRole("tab", { selected: true }).map((tab) => tab.textContent)).toContain(
      "Bajas, alertas y permisos",
    );
  });

  it("fuera de Conversaciones no conserva la conversación de la URL", async () => {
    const user = userEvent.setup();
    await renderPage("tab=conexion&thread=t-1&ref=menu");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Historial de envíos" }));
    expect(mockPush).toHaveBeenCalledWith("/configuracion/whatsapp?tab=historial&ref=menu", {
      scroll: false,
    });
  });

  it("no muestra conexiones, contadores ni métricas ficticias", async () => {
    await renderPage("tab=conexion");
    expect(screen.queryByText(/Conectado ·/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nombre aprobado/)).not.toBeInTheDocument();
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab.textContent).not.toMatch(/\d/);
    }
    expect(screen.getByText("Integración pendiente")).toBeInTheDocument();
  });

  it("lista las tiendas reales de la empresa sin números conectados", async () => {
    await renderPage("tab=conexion");
    const list = screen.getByRole("list", { name: "Tiendas de tu empresa" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    for (const [index, name] of ["LIVII", "KUNCA"].entries()) {
      expect(items[index]).toHaveTextContent(name);
      // Con backend conectado, muestra "Sin número conectado" o "Sin conectar"
      expect(items[index]).toHaveTextContent(/Sin número conectado|Sin conectar/);
    }
  });

  it("indica cómo crear una tienda si la empresa no tiene", async () => {
    mockAuth("ADMINISTRADOR", []);
    await renderPage("tab=conexion");
    expect(screen.getByRole("link", { name: "Crear una tienda" })).toHaveAttribute(
      "href",
      "/configuracion/tiendas",
    );
  });

  it("avisa a quien no es administrador que la configuración la gestiona un administrador", async () => {
    mockAuth("AGENTES");
    await renderPage("tab=plantillas");
    expect(
      screen.getByText(/Solo un administrador podrá cambiar esta configuración/),
    ).toBeInTheDocument();
  });

  it("no muestra ese aviso en pestañas de uso diario ni a administradores", async () => {
    mockAuth("AGENTES");
    await renderPage("tab=conversaciones");
    expect(screen.queryByText(/Solo un administrador/)).not.toBeInTheDocument();
  });

  it("no hace peticiones de red", async () => {
    const fetchSpy = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchSpy;
    try {
      await renderPage("tab=conexion");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("no renderiza nada sin sesión", () => {
    mockedUseAuth.mockReturnValue({ auth: null });
    const { container } = render(<WhatsAppSettingsPage />);
    expect(container).toBeEmptyDOMElement();
  });
});
