import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { Sidebar } from "../Sidebar";

let mockView = false;
let mockPermissions: string[] = [];
jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: { capabilities: { view: mockView } }, isError: false }),
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    auth: {
      accessToken: "local-test-token",
      company: { id: "company", stores: [] },
      user: { id: "actor", name: "Usuario", role: "ADMINISTRADOR", permissions: mockPermissions },
    },
    logout: jest.fn(),
    hasPermission: (permission: string) => mockPermissions.includes(permission),
  }),
}));
jest.mock("next/navigation", () => ({
  usePathname: () => "/publicidad",
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: jest.fn() }) }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: (props: ComponentProps<"a">) => <a {...props} />,
}));

describe("Publicidad integrated into the existing navigation", () => {
  beforeEach(() => {
    mockView = false;
    mockPermissions = [];
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
  });
  it("uses the live role matrix independently of a finance permission", () => {
    const view = render(<Sidebar />);
    expect(screen.queryByRole("link", { name: "Publicidad" })).not.toBeInTheDocument();
    mockPermissions = ["VIEW_FINANCES"];
    view.rerender(<Sidebar />);
    expect(screen.queryByRole("link", { name: "Publicidad" })).not.toBeInTheDocument();
    mockPermissions = [];
    mockView = true;
    view.rerender(<Sidebar />);
    expect(screen.getByRole("link", { name: "Publicidad" })).toHaveAttribute("href", "/publicidad");
    expect(screen.queryByRole("link", { name: "Conexiones" })).not.toBeInTheDocument();
  });
  it("preserves the existing quotation link and advertising finance label", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole("button", { name: "Comercial" }));
    expect(screen.getByRole("link", { name: "Cotizaciones" })).toHaveAttribute(
      "href",
      "/cotizaciones",
    );
    fireEvent.click(screen.getByRole("button", { name: "Administración" }));
    expect(screen.getByRole("link", { name: "Inversión publicitaria" })).toHaveAttribute(
      "href",
      "/administracion/pauta",
    );
  });
  it("removes Publicidad when the current role loses access", () => {
    mockView = true;
    const view = render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Publicidad" })).toBeInTheDocument();
    mockView = false;
    view.rerender(<Sidebar />);
    expect(screen.queryByRole("link", { name: "Publicidad" })).not.toBeInTheDocument();
  });
});
