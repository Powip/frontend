/**
 * Sidebar rendering regression for the Partners merge with current main.
 * Auth and Next navigation are test doubles; this is not an authorization
 * or browser/API integration test. The component and route mapping are real.
 */
import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "../Sidebar";

let mockPathname = "/administracion/pauta";
let mockUser = {
  id: "sidebar-fixture-user",
  email: "sidebar-user@partners.invalid",
  name: "Fixture",
  surname: "User",
  role: "ADMINISTRADOR",
  permissions: [] as string[],
};

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: { user: mockUser },
    logout: jest.fn(),
    hasPermission: (permission: string) => mockUser.permissions.includes(permission),
  }),
}));

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: jest.fn() }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: (props: ComponentProps<"a">) => <a {...props} />,
}));

describe("Sidebar · Partners with current main", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
    mockPathname = "/administracion/pauta";
    mockUser = {
      id: "sidebar-fixture-user",
      email: "sidebar-user@partners.invalid",
      name: "Fixture",
      surname: "User",
      role: "ADMINISTRADOR",
      permissions: [],
    };
  });

  it("preserves main's advertising label and Partners portal link together", () => {
    render(<Sidebar />);

    expect(screen.getByRole("link", { name: /^Inversión publicitaria$/i }))
      .toHaveAttribute("href", "/administracion/pauta");
    expect(screen.queryByRole("link", { name: /^Pauta por canal$/i }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Partners$/i }))
      .toHaveAttribute("href", "/partners");
  });

  it("an administrative role alone does not show Partners staff navigation", () => {
    render(<Sidebar />);

    expect(screen.queryByRole("link", { name: /^Partners Admin$/i }))
      .not.toBeInTheDocument();
  });

  it("PARTNERS_VIEW points to applications, not the legacy admin hub", () => {
    mockUser.permissions = ["PARTNERS_VIEW"];
    render(<Sidebar />);

    expect(screen.getByRole("link", { name: /^Partners Admin$/i }))
      .toHaveAttribute("href", "/partners/admin/solicitudes");
    expect(screen.getByRole("link", { name: /^Partners$/i }))
      .toHaveAttribute("href", "/partners");
  });

  it("PARTNERS_APPROVE alone does not imply applications-list navigation", () => {
    mockUser.permissions = ["PARTNERS_APPROVE"];
    render(<Sidebar />);

    expect(screen.queryByRole("link", { name: /^Partners Admin$/i }))
      .not.toBeInTheDocument();
  });

  it("the legacy UI hint keeps its existing applications destination", () => {
    mockUser.permissions = ["VIEW_PARTNERS_ADMIN"];
    render(<Sidebar />);

    expect(screen.getByRole("link", { name: /^Partners Admin$/i }))
      .toHaveAttribute("href", "/partners/admin/solicitudes");
  });

  it("removes staff navigation when the rendered session loses its hint", () => {
    mockUser.permissions = ["PARTNERS_VIEW"];
    const { rerender } = render(<Sidebar />);
    expect(screen.getByRole("link", { name: /^Partners Admin$/i }))
      .toBeInTheDocument();

    mockUser = { ...mockUser, permissions: [] };
    rerender(<Sidebar />);

    expect(screen.queryByRole("link", { name: /^Partners Admin$/i }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Inversión publicitaria$/i }))
      .toHaveAttribute("href", "/administracion/pauta");
  });
});
