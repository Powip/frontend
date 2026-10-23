import { fireEvent, render, screen } from "@testing-library/react";
import { AdvertisingModuleShell } from "../../AdvertisingModuleShell";

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
    window.history.replaceState({}, "", "/publicidad?storeId=store&from=2026-10-01&to=2026-10-31");
  });
  it("shows exactly the four work tabs and preserves the selected scope in links and URL", () => {
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
    expect(screen.getByRole("link", { name: "Anuncios" })).toHaveAttribute(
      "href",
      "/publicidad/anuncios?from=2026-10-01&to=2026-10-31&storeId=store",
    );
    expect(new URLSearchParams(window.location.search).get("storeId")).toBe("store");
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
    "keeps only the local store selector and advertising settings on %s",
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
      fireEvent.change(screen.getByRole("combobox", { name: "Tienda" }), {
        target: { value: "other" },
      });
      expect(new URLSearchParams(window.location.search).get("storeId")).toBe("other");
      expect(screen.getByRole("link", { name: "Configuración" })).toHaveAttribute(
        "href",
        "/publicidad/configuracion?from=2026-10-01&to=2026-10-31&storeId=other",
      );
    },
  );
});
