import type { ComponentProps } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sidebar } from "../Sidebar";

let mockPathname = "/ventas";
jest.mock("@/lib/liveAvailability", () => ({ getLiveAvailability: async () => ({ available: false }) }));
jest.mock("@/services/commercialLeadsService", () => ({ getCommercialLeadCapabilities: async () => ({ enabled: false }) }));
jest.mock("@/services/advertisingV22Service", () => ({ adsGet: async () => ({ capabilities: { view: false } }) }));
jest.mock("@/components/inventory/reports/InventoryAlertsBadge", () => ({ InventoryAlertsBadge: () => null }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { accessToken: "t", company: { id: "company" }, user: { id: "user", role: "ADMINISTRADOR", permissions: [] } },
    selectedStoreId: "store-a",
    logout: jest.fn(),
    hasPermission: () => false,
  }),
}));
jest.mock("next/navigation", () => ({ usePathname: () => mockPathname, useRouter: () => ({ push: jest.fn() }) }));
jest.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: jest.fn() }) }));
jest.mock("next/link", () => ({ __esModule: true, default: (props: ComponentProps<"a">) => <a {...props} /> }));

/** Solo se finge la fecha (el badge «Nuevo» vence el 24-12-2026); los timers siguen reales. */
function atDate(iso: string) {
  jest.useFakeTimers({
    now: new Date(iso),
    doNotFake: ["nextTick", "setImmediate", "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback", "hrtime", "performance"],
  });
}

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Sidebar /></QueryClientProvider>);
}

beforeEach(() => {
  mockPathname = "/ventas";
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
});
afterEach(() => jest.useRealTimers());

describe("menú: Comercial › Packs y promociones (FEAT-32 M4, spec §7.0)", () => {
  it("Comercial lleva «Packs y promociones» después de Registrar venta; no quedan Promociones ni Productos › Packs", () => {
    atDate("2026-11-25T12:00:00-05:00");
    mount();
    const link = screen.getByRole("link", { name: /^Packs y promociones/ });
    expect(link).toHaveAttribute("href", "/packs-promos");
    expect(screen.queryByRole("link", { name: /^Promociones$/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Productos" }));
    const hrefs = screen.getAllByRole("link").map((item) => item.getAttribute("href"));
    expect(hrefs.indexOf("/packs-promos")).toBe(hrefs.indexOf("/registrar-venta") + 1);
    expect(screen.queryByRole("link", { name: /^Packs$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Promociones$/ })).not.toBeInTheDocument();
    expect(hrefs).not.toContain("/productos/packs");
    // Productos queda: Lista de productos, Categorías, Etiquetas, Listas de precios, Inventario, Modo almacén, Compras, Proveedores.
    const start = hrefs.indexOf("/productos");
    expect(hrefs.slice(start, start + 8)).toEqual([
      "/productos", "/productos/categorias", "/productos/etiquetas", "/productos/listas-precios", "/inventario", "/almacen", "/compras", "/proveedores",
    ]);
  });

  it("en su página muestra la etiqueta «Nuevo» hasta el 24-12-2026 y después ya no", () => {
    mockPathname = "/packs-promos";
    atDate("2026-12-24T20:00:00-05:00");
    const first = mount();
    expect(within(screen.getByRole("link", { name: /^Packs y promociones/ })).getByText("Nuevo")).toBeInTheDocument();
    first.unmount();

    atDate("2026-12-25T00:00:01-05:00");
    mount();
    const link = screen.getByRole("link", { name: /^Packs y promociones/ });
    expect(within(link).queryByText("Nuevo")).not.toBeInTheDocument();
  });
});
