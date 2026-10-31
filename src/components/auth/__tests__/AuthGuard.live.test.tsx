import { render, screen } from "@testing-library/react";
import AuthGuard from "../AuthGuard";
import { useAuth } from "@/contexts/AuthContext";

let mockPathname = "/live";
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };
let mockSession: Pick<ReturnType<typeof useAuth>, "auth" | "loading">;
const publicCatalog = "/live/ee2f3613-9735-4c56-a73e-88ed264a4c1d";

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => mockRouter,
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockSession }));
jest.mock("@/components/shared/PowipPulseLoader", () => ({
  PowipPulseLoader: () => <p>Cargando sesión</p>,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockSession = { auth: null, loading: false };
});

test.each([publicCatalog, `${publicCatalog}/`])("anonymous catalog %s loads during session recovery", (pathname) => {
  mockPathname = pathname;
  mockSession.loading = true;
  render(<AuthGuard><p>Catálogo público</p></AuthGuard>);
  expect(screen.getByText("Catálogo público")).toBeInTheDocument();
  expect(mockPush).not.toHaveBeenCalled();
  expect(mockReplace).not.toHaveBeenCalled();
});

test.each(["/live", "/live/config", "/live/invalid!slug", "/live/admin", "/live/settings", `${publicCatalog}/payments`, "/live-extra"])(
  "%s remains private", (pathname) => {
    mockPathname = pathname;
    render(<AuthGuard><p>Privado</p></AuthGuard>);
    expect(mockPush).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("Privado")).not.toBeInTheDocument();
  },
);

test.each(["/live", "/ventas"])("%s preserves the existing Flow company gate", (pathname) => {
  mockPathname = pathname;
  mockSession = {
    loading: false,
    auth: {
      accessToken: "synthetic-session",
      exp: 0,
      user: { id: "admin", email: "admin@fixture.invalid", role: "ADMINISTRADOR", permissions: [] },
      company: { id: "company", name: "Fixture" },
      subscription: null,
      access: { state: "BLOQUEADO", owner: true },
    },
  };
  render(<AuthGuard><p>Privado</p></AuthGuard>);
  expect(mockReplace).toHaveBeenCalledWith("/pasate-a-flow");
  expect(screen.queryByText("Privado")).not.toBeInTheDocument();
});
