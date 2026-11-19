import { render, screen } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import ConfiguracionPage from "../page";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/components/header/HeaderConfig", () => ({ HeaderConfig: () => null }));
jest.mock("../_components/HelpSection", () => ({ HelpHeaderLink: () => null, HelpSection: () => null }));

const asRole = (role: string) =>
  jest.mocked(useAuth).mockReturnValue({ auth: { user: { role } } } as unknown as ReturnType<typeof useAuth>);

describe("Configuración (hub)", () => {
  it("el administrador ve 'Empresa' y 'Plan y facturación'", () => {
    asRole("ADMINISTRADOR");
    render(<ConfiguracionPage />);
    expect(screen.getByText("Empresa")).toBeInTheDocument();
    expect(screen.queryByText("Empresa + Suscripción")).not.toBeInTheDocument();
    expect(screen.getByText("Plan y facturación").closest("a")).toHaveAttribute("href", "/configuracion/plan");
  });

  it("otros roles no ven la tarjeta de plan", () => {
    asRole("USUARIO");
    render(<ConfiguracionPage />);
    expect(screen.queryByText("Plan y facturación")).not.toBeInTheDocument();
  });

  it("solo el administrador ve «Usuarios y almacenes» (FEAT-24 H6)", () => {
    asRole("ADMINISTRADOR");
    const { unmount } = render(<ConfiguracionPage />);
    expect(screen.getByText("Usuarios y almacenes").closest("a")).toHaveAttribute("href", "/configuracion/usuarios-almacenes");
    unmount();
    asRole("OPERACIONES");
    render(<ConfiguracionPage />);
    expect(screen.queryByText("Usuarios y almacenes")).not.toBeInTheDocument();
  });
});
