import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { AdvertisingModuleShell } from "../../AdvertisingModuleShell";
import { useAdvertisingStoreFilter } from "../../AdvertisingStoreFilterContext";

let mockPath = "/publicidad";
let mockCanView = true;
const mockReplace = jest.fn();
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
}));
jest.mock("next/navigation", () => ({
  usePathname: () => mockPath,
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock("@/components/header/Header", () => ({
  __esModule: true,
  default: () => (
    <header>
      <select aria-label="Tienda global" />
      <button>Administrar Tiendas</button>
    </header>
  ),
}));
jest.mock("@/components/dashboard/PeriodSelector", () => ({
  PeriodSelector: () => <button>Calendario POWIP</button>,
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      user: { id: "actor" },
      accessToken: "token",
      company: {
        id: "company",
        stores: [
          { id: "store", name: "Tienda" },
          { id: "other", name: "Otra tienda" },
        ],
      },
    },
    selectedStoreId: "store",
    loading: false,
  }),
}));
jest.mock("../context", () => ({
  AdvertisingV22Provider: ({ children }: { children: React.ReactNode }) => children,
  useAdsV22: () => ({
    settings: { capabilities: { view: mockCanView } },
    loading: false,
    error: null,
    reload: jest.fn(),
  }),
}));
describe("Publicidad navigation and access", () => {
  beforeEach(() => {
    mockCanView = true;
    mockPath = "/publicidad";
    window.history.replaceState({}, "", "/publicidad?from=2026-10-01&to=2026-10-31");
  });
  it("defaults to the whole business without inheriting the global Sales store", () => {
    render(
      <AdvertisingModuleShell>
        <p>Números</p>
      </AdvertisingModuleShell>,
    );
    expect(
      screen.getByRole("navigation", { name: "Secciones de publicidad" }).querySelectorAll("a"),
    ).toHaveLength(4);
    for (const name of ["Mis números", "Anuncios", "Pruebas", "Configuración"])
      expect(screen.getByRole("link", { name })).toBeInTheDocument();
    expect(screen.getByText("Números")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Tienda global" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Tienda" })).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Negocio" })).toHaveValue("all");
    expect(screen.getByRole("link", { name: "Anuncios" })).toHaveAttribute(
      "href",
      "/publicidad/anuncios?from=2026-10-01&to=2026-10-31&storeId=all",
    );
    expect(new URLSearchParams(window.location.search).get("storeId")).toBe("all");
  });
  it("hides the period on tests and never renders protected children without view permission", async () => {
    mockPath = "/publicidad/pruebas";
    mockCanView = false;
    render(
      <AdvertisingModuleShell>
        <p>Ganancia confidencial</p>
      </AdvertisingModuleShell>,
    );
    expect(screen.queryByRole("button", { name: "Calendario POWIP" })).not.toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Tu rol no tiene acceso a Publicidad",
    );
    expect(screen.queryByText("Ganancia confidencial")).not.toBeInTheDocument();
  });
  it.each(["/publicidad", "/publicidad/anuncios", "/publicidad/configuracion"])(
    "uses the explicit business selection and preserves period and section on %s",
    (path) => {
      mockPath = path;
      render(
        <AdvertisingModuleShell>
          <p>Contenido</p>
        </AdvertisingModuleShell>,
      );
      expect(screen.queryByRole("button", { name: "Administrar Tiendas" })).not.toBeInTheDocument();
      expect(screen.queryByRole("combobox", { name: "Tienda global" })).not.toBeInTheDocument();
      expect(screen.getAllByRole("combobox")).toHaveLength(1);
      expect(screen.getByRole("combobox", { name: "Negocio" })).toHaveValue("all");
      fireEvent.change(screen.getByRole("combobox", { name: "Negocio" }), { target: { value: "store" } });
      expect(screen.getByRole("link", { name: "Anuncios" })).toHaveAttribute(
        "href", "/publicidad/anuncios?from=2026-10-01&to=2026-10-31&storeId=store",
      );
      act(() => {
        window.history.replaceState({}, "", `${path}?storeId=other&from=2026-10-01&to=2026-10-31&section=sales-costs`);
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      expect(new URLSearchParams(window.location.search).get("storeId")).toBe("other");
      expect(new URLSearchParams(window.location.search).get("section")).toBe("sales-costs");
      expect(screen.getByRole("link", { name: "Configuración" })).toHaveAttribute(
        "href",
        "/publicidad/configuracion?from=2026-10-01&to=2026-10-31&storeId=other",
      );
    },
  );
  it("shows the selected period control in Configuration", () => {
    mockPath = "/publicidad/configuracion";
    render(<AdvertisingModuleShell><p>Configuración</p></AdvertisingModuleShell>);
    expect(screen.getByRole("button", { name: "Calendario POWIP" })).toBeInTheDocument();
    expect(screen.getByText(/Datos al/)).toHaveTextContent(/oct/);
  });
  it("clears a selected review when the business changes while preserving the section and dates", () => {
    mockPath = "/publicidad/configuracion";
    window.history.replaceState({}, "", "/publicidad/configuracion?section=sales-costs&from=2026-10-01&to=2026-10-31");
    render(<AdvertisingModuleShell><ReviewSelection /></AdvertisingModuleShell>);
    fireEvent.click(screen.getByRole("button", { name: "Abrir pedido" }));
    expect(screen.getByText("Pedido seleccionado")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Negocio" }), { target: { value: "other" } });
    expect(screen.queryByText("Pedido seleccionado")).not.toBeInTheDocument();
    expect(Object.fromEntries(new URLSearchParams(window.location.search))).toEqual({
      section: "sales-costs", from: "2026-10-01", to: "2026-10-31", storeId: "other",
    });
  });
  it("preserves ad view filters when a saved view changes the business", () => {
    mockPath = "/publicidad/anuncios";
    render(<AdvertisingModuleShell><SavedViewFilters /></AdvertisingModuleShell>);
    fireEvent.click(screen.getByRole("button", { name: "Aplicar vista de otra tienda" }));
    expect(screen.getByText("Vista por campañas" )).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Negocio" })).toHaveValue("other");
  });
  it.each(["foreign", "none"])("rejects an unavailable store URL %s instead of selecting the first store", (value) => {
    window.history.replaceState({}, "", `/publicidad?storeId=${value}&from=2026-10-01&to=2026-10-31`);
    render(<AdvertisingModuleShell><p>Números</p></AdvertisingModuleShell>);
    expect(screen.getByRole("combobox", { name: "Negocio" })).toHaveValue("all");
    expect(new URLSearchParams(window.location.search).get("storeId")).toBe("all");
  });
});

function ReviewSelection() {
  const [selected, setSelected] = useState(false);
  return <><button onClick={() => setSelected(true)}>Abrir pedido</button>{selected && <p>Pedido seleccionado</p>}</>;
}
function SavedViewFilters() {
  const [filter, setFilter] = useState("Vista por anuncios");
  const { setStoreId } = useAdvertisingStoreFilter();
  return <><button onClick={() => { setFilter("Vista por campañas"); setStoreId("other"); }}>Aplicar vista de otra tienda</button><p>{filter}</p></>;
}
