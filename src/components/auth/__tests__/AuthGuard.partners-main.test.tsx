import { render, screen } from "@testing-library/react";
import AuthGuard from "../AuthGuard";
import { useAuth } from "@/contexts/AuthContext";

let mockPathname = "/partners/referidos";
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };
let mockSession: Pick<ReturnType<typeof useAuth>, "auth" | "loading">;

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => mockRouter,
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockSession }));
jest.mock("@/components/shared/PowipPulseLoader", () => ({
  PowipPulseLoader: () => <p>Cargando sesión</p>,
}));

function authenticated(status: string | null = null, companyId?: string) {
  mockSession = {
    loading: false,
    auth: {
      accessToken: "synthetic-ui-fixture",
      exp: 0,
      user: { id: "fixture-user", email: "fixture@review.invalid", role: "USUARIO", permissions: [], companyId },
      company: null,
      subscription: status ? { id: "fixture-subscription", status, plan: { id: "fixture-plan", name: "Fixture" } } : null,
    },
  };
}

function renderGuard(pathname: string) {
  mockPathname = pathname;
  return render(<AuthGuard><p>Contenido protegido</p></AuthGuard>);
}

beforeEach(() => {
  mockPush.mockReset();
  mockReplace.mockReset();
  authenticated();
});

it.each(["/partners", "/partners/referidos", "/partners/link"])(
  "%s omite sólo el gate Company/plan con sesión", (pathname) => {
    renderGuard(pathname);
    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  },
);

it.each(["/partners", "/partners/referidos", "/partners/admin/solicitudes"])(
  "%s sin sesión no muestra contenido ni concede acceso", (pathname) => {
    mockSession = { auth: null, loading: false };
    renderGuard(pathname);
    expect(mockPush).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
    expect(mockReplace).not.toHaveBeenCalled();
  },
);

it.each(["/partnersxx", "/partners-extra", "/configuracion", "/ventas"])(
  "%s sin plan conserva el paywall de main", (pathname) => {
    renderGuard(pathname);
    expect(mockReplace).toHaveBeenCalledWith("/sin-plan");
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  },
);

it.each(["ACTIVE", "PENDING_RENEWAL"])(
  "el plan %s sin Company conserva /new-company fuera de Partners", (status) => {
    authenticated(status);
    renderGuard("/ventas");
    expect(mockReplace).toHaveBeenCalledWith("/new-company");
    expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  },
);

it.each(["/onboarding", "/onboarding/callback", "/partners/solicitud"])(
  "%s conserva acceso público", (pathname) => {
    mockSession = { auth: null, loading: false };
    renderGuard(pathname);
    expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  },
);

it("la excepción pública no acepta un prefijo parecido a solicitud", () => {
  mockSession = { auth: null, loading: false };
  renderGuard("/partners/solicitud-extra");
  expect(mockPush).toHaveBeenCalledWith("/login");
  expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
});

it("companyId del staff conserva su ruta normal aunque Company no esté cargada", () => {
  authenticated(null, "fixture-company");
  renderGuard("/ventas");
  expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
  expect(mockReplace).not.toHaveBeenCalled();
});

it("la excepción de plan no concede PARTNERS_VIEW a un usuario común", () => {
  renderGuard("/partners/admin/solicitudes");
  expect(screen.getByText("Acceso Denegado")).toBeInTheDocument();
  expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  expect(mockReplace).not.toHaveBeenCalled();
});

it("no renderiza Partners mientras Auth está cargando", () => {
  mockSession.loading = true;
  renderGuard("/partners");
  expect(screen.getByText("Cargando sesión")).toBeInTheDocument();
  expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
});
