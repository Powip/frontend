import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { ComisionesPageContent } from "@/app/partners/comisiones/_components/comisiones-page-content";
import { PlanPageContent } from "@/app/partners/plan/_components/plan-page-content";
import { CasuisticaPageContent } from "@/app/partners/admin/casuistica/_components/casuistica-page-content";
import { EmailTemplatesCard } from "@/app/partners/admin/reglas/_components/email-templates-card";
import { UnopenedInvitationsTable } from "@/app/partners/admin/cola/_components/unopened-invitations-table";
import { PartnersListPageContent } from "@/app/partners/admin/partners/_components/partners-list-page-content";
import { LiquidacionesPageContent } from "@/app/partners/admin/liquidaciones/_components/liquidaciones-page-content";
import { PartnerSectionError } from "@/components/partners/partner-section-error";
import { partnersKeys } from "@/features/partners/keys/partners.keys";
import { PartnersFeatureUnavailableError } from "@/features/partners/utils/unavailable-partners-feature";
import { UNOPENED_INVITATIONS_MOCK } from "@/features/partners/mocks/unopened-invitations.mock";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "fixture-unavailable", user: { id: "fixture", permissions: ["PARTNERS_VIEW"] } } }) }));
jest.mock("@/features/partners/hooks/use-admin-partners", () => ({
  useAdminPartners: () => ({ isError: false, isLoading: false, data: { pages: [{ items: [] }] }, hasNextPage: false }),
}));

function renderWithQuery(component: React.ReactNode, seed?: (client: QueryClient) => void) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  seed?.(client);
  return render(<QueryClientProvider client={client}>{component}</QueryClientProvider>);
}

afterEach(() => jest.clearAllMocks());

describe("Partners pending UI functions fail closed", () => {
  it("shows permanent unavailability without an inappropriate retry button", () => {
    render(
      <PartnerSectionError
        message="Network failure"
        error={new PartnersFeatureUnavailableError("Consultar pagos")}
        onRetry={jest.fn()}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/todavía no está implementado/);
    expect(screen.queryByRole("button", { name: /reintentar/i })).not.toBeInTheDocument();
  });

  it("keeps retry for ordinary network failures", () => {
    render(
      <PartnerSectionError
        message="Network failure"
        error={new Error("Network failure")}
        onRetry={jest.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeEnabled();
  });

  it("does not show default effective plan terms or estimated money", () => {
    renderWithQuery(<PlanPageContent />);
    expect(screen.getByText(/Condiciones efectivas: no configuradas/)).toBeInTheDocument();
    expect(screen.getByText(/MRR atribuido y nivel del programa: no disponibles/)).toBeInTheDocument();
    expect(screen.queryByText("Standard")).not.toBeInTheDocument();
    expect(screen.queryByText(/10%|S\/|Simulador de ingresos/)).not.toBeInTheDocument();
  });

  it("does not present unapproved financial case rules as actual behavior", () => {
    render(<CasuisticaPageContent />);
    expect(screen.getByRole("alert")).toHaveTextContent(/reglas requieren confirmación/);
    expect(
      screen.queryByText(/Clawback|Sin comisión|Reverso en el siguiente ciclo/),
    ).not.toBeInTheDocument();
  });

  it("cannot save a mail template or announce a local success", async () => {
    render(<EmailTemplatesCard />);
    const save = screen.getByRole("button", { name: "Guardar" });
    expect(save).toBeDisabled();
    await userEvent.click(save);
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/todavía no están implementadas/);
  });

  it("cannot resend with VIEW alone or announce that a mail was sent", async () => {
    renderWithQuery(
      <UnopenedInvitationsTable
        invitations={UNOPENED_INVITATIONS_MOCK}
        isLoading={false}
      />,
    );
    expect(screen.queryByRole("button", { name: /reenvío/i })).not.toBeInTheDocument();
    expect(screen.getByText(/requiere PARTNERS_APPROVE/)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("blocks partner invitations without APPROVE while preserving the real applications link", async () => {
    renderWithQuery(<PartnersListPageContent />);
    expect(screen.getByRole("button", { name: /Invitar partner/ })).toBeDisabled();
    expect(screen.getByRole("link", { name: /Revisar solicitudes/ })).toHaveAttribute(
      "href",
      "/partners/admin/solicitudes",
    );
    await waitFor(() =>
      expect(screen.getByText(/Todavía no hay partners/)).toBeInTheDocument(),
    );
  });

  it("blocks pay-all and does not display a made-up zero payout total", async () => {
    renderWithQuery(<LiquidacionesPageContent />);
    expect(screen.getByRole("button", { name: /Pagar todo/ })).toBeDisabled();
    expect(screen.queryByText(/S\/\s*0/)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(3));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("ignores old successful mock cache entries rather than rendering them", async () => {
    renderWithQuery(<ComisionesPageContent />, (client) => {
      client.setQueryData(partnersKeys.summary(), { fakeFinancialValue: 123456789 });
      client.setQueryData(partnersKeys.commissions(), [
        {
          id: "test-only",
          businessName: "OLD MOCK MUST NOT SHOW",
          firstMonthCommission: 123456789,
        },
      ]);
    });
    expect(screen.queryByText("OLD MOCK MUST NOT SHOW")).not.toBeInTheDocument();
    expect(screen.queryByText("Cómo se calcula")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/Resumen financiero no disponible/);
    expect(screen.queryByText("OLD MOCK MUST NOT SHOW")).not.toBeInTheDocument();
  });
});
