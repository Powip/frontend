import { render, screen } from "@testing-library/react";
import AuthGuard from "../AuthGuard";
import { useAuth } from "@/contexts/AuthContext";

type Auth = NonNullable<ReturnType<typeof useAuth>["auth"]>;
let mockPathname = "/ventas";
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { push: mockPush, replace: mockReplace };
let mockSession: Pick<ReturnType<typeof useAuth>, "auth" | "loading">;

jest.mock("next/navigation", () => ({ usePathname: () => mockPathname, useRouter: () => mockRouter }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => mockSession }));
jest.mock("@/components/shared/PowipPulseLoader", () => ({
  PowipPulseLoader: () => <p>Cargando sesión</p>,
}));

function ownerSession(): Auth {
  return {
    accessToken: "session-fixture",
    exp: 0,
    user: { id: "owner-a", email: "owner@example.test", role: "ADMINISTRADOR", permissions: [], companyId: "company-a" },
    company: { id: "company-a", name: "Mi negocio", userId: "owner-a", onboarding_sales_channels: null, monthly_order_volume: null },
    subscription: null,
    access: { state: "OK", owner: true, deadline: null, firstChargeDate: null },
  };
}

function renderGuard(pathname = "/ventas") {
  mockPathname = pathname;
  return render(<AuthGuard><p>Contenido protegido</p></AuthGuard>);
}

beforeEach(() => {
  jest.resetAllMocks();
  mockSession = { auth: ownerSession(), loading: false };
});

it("requires an existing company's owner to answer before showing private content", () => {
  renderGuard();
  expect(mockReplace).toHaveBeenCalledWith("/completar-negocio");
  expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
});

it.each(["owner-a", "admin-a"])("allows respondent %s normal access after the company has answered", (userId) => {
  mockSession.auth!.user.id = userId;
  mockSession.auth!.company = {
    ...mockSession.auth!.company!,
    onboarding_sales_channels: ["POS (Punto de venta)"],
    monthly_order_volume: "OVER_6000",
  };
  renderGuard();
  expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
  expect(mockReplace).not.toHaveBeenCalled();
});

it("preserves normal staff access", () => {
  mockSession.auth!.user.id = "staff-sales";
  mockSession.auth!.user.role = "VENTAS";
  renderGuard();
  expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
  expect(mockReplace).not.toHaveBeenCalled();
});

it("prompts a same-company administrator to complete the company's profile", () => {
  mockSession.auth!.user.id = "admin-a";
  renderGuard();
  expect(mockReplace).toHaveBeenCalledWith("/completar-negocio");
  expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
});

it.each([
  ["ADMINISTRADOR", "another-company"],
  ["ADMINISTRADOR", null],
  ["ADMIN", "company-a"],
  ["SUPERADMIN", "company-a"],
] as const)("does not collect answers from non-owner role %s with membership %s", (role, companyId) => {
  mockSession.auth!.user = { ...mockSession.auth!.user, id: "non-owner", role, companyId };
  renderGuard();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
});

it("still prompts the actual owner without a company claim or admin role", () => {
  mockSession.auth!.user.role = "USUARIO";
  mockSession.auth!.user.companyId = null;
  renderGuard();
  expect(mockReplace).toHaveBeenCalledWith("/completar-negocio");
});

it.each(["/ventas", "/completar-negocio"])("payment blocking wins for the owner on %s", (pathname) => {
  mockSession.auth!.access = { state: "BLOQUEADO", owner: true, deadline: null, firstChargeDate: null };
  renderGuard(pathname);
  expect(mockReplace).toHaveBeenCalledWith("/pasate-a-flow");
  expect(mockReplace).not.toHaveBeenCalledWith("/completar-negocio");
  expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
});

it("preserves the suspension route for blocked staff", () => {
  mockSession.auth!.user.id = "staff-a";
  mockSession.auth!.access = { state: "BLOQUEADO", owner: false, deadline: null, firstChargeDate: null };
  renderGuard();
  expect(mockReplace).toHaveBeenCalledWith("/cuenta-suspendida");
  expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
});

it.each([
  "/onboarding", "/onboarding/callback", "/login",
  "/configuracion/integraciones/publicidad/callback",
  "/partners", "/partners/referidos", "/partners/solicitud",
])("does not interrupt the auth, OAuth or Partners flow at %s", (pathname) => {
  renderGuard(pathname);
  expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
  expect(mockReplace).not.toHaveBeenCalled();
  expect(mockPush).not.toHaveBeenCalled();
});

it("preserves superadmin access", () => {
  mockSession.auth!.user.email = "joel@aranni.com.pe";
  renderGuard();
  expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
  expect(mockReplace).not.toHaveBeenCalled();
});

it("does not guess profile completion or ownership when company lookup returned no data", () => {
  mockSession.auth!.company = null;
  renderGuard();
  expect(screen.getByText("Contenido protegido")).toBeInTheDocument();
  expect(mockReplace).not.toHaveBeenCalled();
});

it("waits for authentication loading before deciding whether questions are required", () => {
  mockSession.loading = true;
  renderGuard();
  expect(screen.getByText("Cargando sesión")).toBeInTheDocument();
  expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
  expect(mockReplace).not.toHaveBeenCalled();
});

it.each([
  [null, "/sin-plan"],
  ["ACTIVE", "/new-company"],
] as const)("a user with plan %s and no company follows existing payment onboarding", (status, target) => {
  mockSession.auth!.company = null;
  mockSession.auth!.user.companyId = null;
  mockSession.auth!.subscription = status ? { id: "plan-a", status, plan: { id: "plan-a", name: "Plan" } } : null;
  renderGuard("/completar-negocio");
  expect(mockReplace).toHaveBeenCalledWith(target);
  expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
});

it("requires a session for the questionnaire route", () => {
  mockSession.auth = null;
  renderGuard("/completar-negocio");
  expect(mockPush).toHaveBeenCalledWith("/login");
  expect(screen.queryByText("Contenido protegido")).not.toBeInTheDocument();
});
