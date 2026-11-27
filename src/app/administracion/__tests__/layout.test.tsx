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
jest.mock("../_components/ImportarNavegador", () => ({ ImportarNavegador: () => <p>aviso de importación</p> }));
jest.mock("@/contexts/AdminPeriodContext", () => ({
  AdminPeriodProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAdminPeriod: () => ({ fromDate: "2026-11-01", toDate: "2026-11-26" }),
}));

describe("layout de Administración", () => {
  it("Capital y ROI se ve dentro de Caja, con sus subpestañas y sin aviso de «solo en este navegador»", () => {
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
    expect(screen.queryByText(/solo en este navegador/)).not.toBeInTheDocument();
    expect(screen.queryByText("Esta sección no está en el menú")).not.toBeInTheDocument();
  });

  it("Cuentas volvió al menú, en Caja", () => {
    mockPathname = "/administracion/cuentas";
    render(<AdminLayout>contenido</AdminLayout>);
    const subpestanas = screen.getByRole("list", { name: "Subsecciones de Caja" });
    expect(within(subpestanas).getByRole("link", { name: "Cuentas por cobrar y pagar" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByText("Esta sección no está en el menú")).not.toBeInTheDocument();
  });

  it("el aviso para subir lo guardado en el navegador va arriba del contenido de cada página", () => {
    mockPathname = "/administracion/resumen";
    render(<AdminLayout>contenido</AdminLayout>);
    expect(screen.getByText("aviso de importación")).toBeInTheDocument();
  });
});
