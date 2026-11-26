import { render, screen, within } from "@testing-library/react";
import AdminLayout from "../layout";

let mockPathname = "/administracion/capital";
jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t" }, loading: false, hasPermission: () => true }),
}));
jest.mock("@/components/header/Header", () => ({ __esModule: true, default: () => null }));
jest.mock("../_components/AdminPeriodControl", () => ({ AdminPeriodControl: () => null }));
jest.mock("@/contexts/AdminPeriodContext", () => ({
  AdminPeriodProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAdminPeriod: () => ({ fromDate: "2026-11-01", toDate: "2026-11-26" }),
}));

const AVISO = "Los datos de esta sección se guardan solo en este navegador";

describe("layout de Administración", () => {
  it("Capital y ROI se ve dentro de Caja, con sus subpestañas y el aviso de datos solo del navegador", () => {
    mockPathname = "/administracion/capital";
    render(<AdminLayout>contenido</AdminLayout>);

    const secciones = screen.getByRole("navigation", { name: "Secciones de administración" });
    expect(within(secciones).getByRole("link", { name: "Caja" })).toHaveAttribute("aria-current", "true");

    const subpestanas = screen.getByRole("list", { name: "Subsecciones de Caja" });
    expect(within(subpestanas).getByRole("link", { name: "Flujo de caja" })).toHaveAttribute(
      "href",
      "/administracion/flujo",
    );
    expect(within(subpestanas).getByRole("link", { name: "Capital y ROI" })).toHaveAttribute("aria-current", "page");

    expect(screen.getByText(AVISO)).toBeInTheDocument();
    expect(screen.queryByText("Esta sección no está en el menú")).not.toBeInTheDocument();
  });

  it("Flujo de caja no muestra el aviso", () => {
    mockPathname = "/administracion/flujo";
    render(<AdminLayout>contenido</AdminLayout>);
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  });

  it("Cuentas sigue fuera del menú, con su aviso de siempre", () => {
    mockPathname = "/administracion/cuentas";
    render(<AdminLayout>contenido</AdminLayout>);
    expect(screen.getByText("Esta sección no está en el menú")).toBeInTheDocument();
    expect(screen.queryByText(AVISO)).not.toBeInTheDocument();
  });
});
