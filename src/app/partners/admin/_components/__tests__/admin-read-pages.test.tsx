import { act, cleanup, render as renderComponent, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import type { AdminPage, AdminPartner } from "@/features/partners/models/admin-partner";
import type { AdminPartnerActivity } from "@/features/partners/models/admin-partner-activity";
import type { AdminPartnerReferral } from "@/features/partners/models/admin-partner-referral";
import {
  ADMIN_PARTNER_ID,
  ADMIN_USER_A,
  buildAdminActivity,
  buildAdminPage,
  buildAdminPartner,
  buildAdminReferral,
  buildAdminSummary,
} from "@/features/partners/test-utils/admin-partners.fixture";
import { buildAxiosError } from "@/features/partners/test-utils/axios-error";
import {
  clearAdminReadDenial,
  denyAdminReadSession,
} from "@/features/partners/utils/admin-read-session-state";
import { PartnersListPageContent } from "../../partners/_components/partners-list-page-content";
import { PartnerDetailPageContent } from "../../partners/[partnerId]/_components/partner-detail-page-content";
import { DashboardPageContent } from "../dashboard-page-content";

const clients: QueryClient[] = [];
function render(component: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  return renderComponent(component, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
}

function query<T>(data: T | undefined) {
  return {
    data,
    isError: false,
    isLoading: false,
    isSuccess: true,
    error: null as Error | null,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: jest.fn(),
    refetch: jest.fn(),
  };
}
let mockAuth = {
  accessToken: "A",
  user: { id: ADMIN_USER_A, permissions: ["PARTNERS_VIEW"], email: "staff@review.invalid" },
};
let mockList = query<{ pages: AdminPage<AdminPartner>[] }>({ pages: [buildAdminPage()] });
let mockDetail = query(buildAdminPartner());
let mockReferrals = query<{ pages: AdminPage<AdminPartnerReferral>[] }>({
  pages: [{ ...buildAdminPage(), items: [buildAdminReferral()] }],
});
let mockActivity = query<{ pages: AdminPage<AdminPartnerActivity>[] }>({
  pages: [{ ...buildAdminPage(), items: [buildAdminActivity()] }],
});
let mockSummary = query(buildAdminSummary());
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: mockAuth }) }));
jest.mock("@/features/partners/hooks/use-admin-partners", () => ({
  useAdminPartners: () => mockList,
}));
jest.mock("@/features/partners/hooks/use-admin-partner", () => ({
  useAdminPartner: () => mockDetail,
}));
jest.mock("@/features/partners/hooks/use-admin-partner-referrals", () => ({
  useAdminPartnerReferrals: () => mockReferrals,
}));
jest.mock("@/features/partners/hooks/use-admin-partner-activity", () => ({
  useAdminPartnerActivity: () => mockActivity,
}));
jest.mock("@/features/partners/hooks/use-admin-dashboard-summary", () => ({
  useAdminDashboardSummary: () => mockSummary,
}));

beforeEach(() => {
  clearAdminReadDenial();
  mockAuth = {
    accessToken: "A",
    user: { id: ADMIN_USER_A, permissions: ["PARTNERS_VIEW"], email: "staff@review.invalid" },
  };
  mockList = query({ pages: [buildAdminPage()] });
  mockDetail = query(buildAdminPartner());
  mockReferrals = query({ pages: [{ ...buildAdminPage(), items: [buildAdminReferral()] }] });
  mockActivity = query({ pages: [{ ...buildAdminPage(), items: [buildAdminActivity()] }] });
  mockSummary = query(buildAdminSummary());
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  clearAdminReadDenial();
});

it("renders actual operations separately from unavailable finances", () => {
  render(<DashboardPageContent />);
  expect(screen.getByText("Partners (activos y suspendidos)").nextElementSibling).toHaveTextContent(
    "5",
  );
  expect(screen.getByText("Referidos manuales").nextElementSibling).toHaveTextContent("11");
  expect(screen.getByText("Atribuciones LINK").nextElementSibling).toHaveTextContent("6");
  expect(screen.getByRole("status")).toHaveTextContent(
    /Métricas monetarias todavía no disponibles/,
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    /libro contable.*no confirman liquidaciones ni pagos/,
  );
  expect(
    screen.queryByText(/motor financiero todavía no está implementado/),
  ).not.toBeInTheDocument();
  expect(screen.queryByText(/S\/\s*0|Top partners|Embudo|clic→pago|×/)).not.toBeInTheDocument();
});

it("renders a paginated list and asks for the next real page", async () => {
  mockList.data = {
    pages: [
      buildAdminPage(),
      buildAdminPage(
        buildAdminPartner({ id: ADMIN_USER_A, displayName: "Segunda página", status: "SUSPENDED" }),
      ),
    ],
  };
  mockList.hasNextPage = true;
  render(<PartnersListPageContent />);
  expect(screen.getByText("Segunda página")).toBeInTheDocument();
  expect(screen.getByText("Suspendido", { selector: "span" })).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Cargar más partners" }));
  expect(mockList.fetchNextPage).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/Bronce|Standard|S\/|MRR generado/)).not.toBeInTheDocument();
});

it.each([401, 403, 503])(
  "hides retained list data after HTTP %s and shows the correct error",
  (status) => {
    mockList.isError = true;
    mockList.error = buildAxiosError(status);
    render(<PartnersListPageContent />);
    expect(screen.queryByText("Partner de prueba")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      status === 401 ? /sesión expiró/ : status === 403 ? /No tenés permiso/ : /no está disponible/,
    );
    if (status !== 503)
      expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  },
);

it("does not grant an email privileged user VIEW or reveal previously cached data", () => {
  const { rerender } = render(<PartnersListPageContent />);
  expect(screen.getByText("Partner de prueba")).toBeInTheDocument();
  mockAuth.user.permissions = [];
  mockAuth.user.email = "tognolimauricio@gmail.com";
  rerender(<PartnersListPageContent />);
  expect(screen.getByRole("alert")).toHaveTextContent("PARTNERS_VIEW");
  expect(screen.queryByText("Partner de prueba")).not.toBeInTheDocument();
});

it("shows nullable partner facts and real operational counts without a default tier", () => {
  mockDetail.data = buildAdminPartner({ status: "APPLIED", activatedAt: null, referralCode: null });
  render(<PartnerDetailPageContent partnerId={ADMIN_PARTNER_ID} />);
  expect(screen.getByText("Por aprobar")).toBeInTheDocument();
  expect(screen.getByText("Activado").nextElementSibling).toHaveTextContent("No disponible");
  expect(
    screen.getByRole("link", { name: "Consultar libro y saldo contable · solo lectura" }),
  ).toHaveAttribute("href", `/partners/admin/partners/${ADMIN_PARTNER_ID}/libro`);
  expect(screen.queryByText(/Bronce|Standard|S\/|0%/)).not.toBeInTheDocument();
});

it("renders manual and LINK records with equal UUIDs as distinct evidence", () => {
  const manual = buildAdminReferral();
  mockReferrals.data = {
    pages: [
      {
        ...buildAdminPage(),
        items: [
          manual,
          buildAdminReferral({
            id: manual.id,
            source: "LINK_ATTRIBUTION",
            origin: "LINK",
            state: "LINK_ATTRIBUTED",
            businessName: null,
            companyId: ADMIN_USER_A,
            companyCreatedAt: "2026-10-03T10:00:00Z",
            attributedAt: "2026-10-03T10:00:00Z",
          }),
        ],
      },
    ],
  };
  render(<PartnerDetailPageContent partnerId={ADMIN_PARTNER_ID} />);
  expect(screen.getByText("Negocio prueba")).toBeInTheDocument();
  expect(screen.getByText("Nombre no disponible")).toBeInTheDocument();
  expect(screen.getByText("REGISTERED")).toBeInTheDocument();
  expect(screen.getByText("LINK_ATTRIBUTED")).toBeInTheDocument();
  expect(screen.queryByText(/Pagando|Comisión activa/)).not.toBeInTheDocument();
});

it("renders only audit events and never derives joined or tier events", async () => {
  render(<PartnerDetailPageContent partnerId={ADMIN_PARTNER_ID} />);
  await userEvent.click(screen.getByRole("tab", { name: "Actividad" }));
  expect(screen.getByText("PARTNER_APPROVED")).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(1);
  expect(screen.queryByText(/Se unió|Nivel actual|Registró a/)).not.toBeInTheDocument();
});

it("renders an empty audit history as empty rather than inventing partner lifecycle events", async () => {
  mockActivity.data = { pages: [{ ...buildAdminPage(), items: [] }] };
  render(<PartnerDetailPageContent partnerId={ADMIN_PARTNER_ID} />);
  await userEvent.click(screen.getByRole("tab", { name: "Actividad" }));
  expect(screen.getByText("Sin eventos registrados.")).toBeInTheDocument();
  expect(screen.queryAllByRole("listitem")).toHaveLength(0);
});

it("shows an unknown partner as 404 and hides any retained detail", () => {
  mockDetail.isError = true;
  mockDetail.error = buildAxiosError(404);
  render(<PartnerDetailPageContent partnerId={ADMIN_PARTNER_ID} />);
  expect(screen.getByRole("status")).toHaveTextContent("No encontramos este partner.");
  expect(screen.queryByText("Partner de prueba")).not.toBeInTheDocument();
});

it("does not show retained summary values after the service fails", () => {
  mockSummary.isError = true;
  mockSummary.error = buildAxiosError(503);
  render(<DashboardPageContent />);
  expect(screen.queryByText("Partners activos")).not.toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(/no está disponible/);
});

it.each([401, 403])(
  "hides all cached partner facts and sibling audit data after a known session denial %s",
  async (status) => {
    render(<PartnerDetailPageContent partnerId={ADMIN_PARTNER_ID} />);
    await userEvent.click(screen.getByRole("tab", { name: "Actividad" }));
    expect(screen.getByText("Partner de prueba")).toBeInTheDocument();
    expect(screen.getByText("PARTNER_APPROVED")).toBeInTheDocument();
    act(() => {
      denyAdminReadSession(ADMIN_USER_A, "A", buildAxiosError(status));
    });
    expect(screen.queryByText("Partner de prueba")).not.toBeInTheDocument();
    expect(screen.queryByText("PARTNER_APPROVED")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      status === 401 ? /sesión expiró/ : /No tenés permiso/,
    );
  },
);
