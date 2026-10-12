import { render, screen } from "@testing-library/react";
import { PartnerHeroCard } from "@/app/partners/_components/partner-hero-card";
import { AdminDashboardKpiRow } from "@/app/partners/admin/_components/admin-dashboard-kpi-row";
import { ReferralDetailDrawer } from "@/app/partners/referidos/_components/referral-detail-drawer";
import { buildAdminSummary } from "@/features/partners/test-utils/admin-partners.fixture";
import type { PartnerReferral } from "@/features/partners/models/partner-referral";

describe("Partners copy without unapproved financial promises", () => {
  it("does not promise two earnings during the first loading render", () => {
    render(<PartnerHeroCard commissionOption={undefined} isLoading />);
    expect(screen.getByRole("heading", { name: "Programa de Partners" })).toBeInTheDocument();
    expect(
      screen.queryByText(/Ganas dos veces|primer mes|recurrente|Se activa/),
    ).not.toBeInTheDocument();
  });

  it("does not infer a commission activation condition from supplied percentages", () => {
    render(
      <PartnerHeroCard
        commissionOption={{ code: "A", firstMonthPct: 40, recurringPct: 6 }}
        isLoading={false}
      />,
    );
    expect(screen.queryByText(/Ganas dos veces|Se activa cuando/)).not.toBeInTheDocument();
  });

  it("shows only skeletons while admin totals load, without fixed discounts or formulas", () => {
    const { container } = render(<AdminDashboardKpiRow summary={undefined} isLoading />);
    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(11);
    expect(
      screen.queryByText(/10%|15 meses|LTV \/ costo|1er mes \+ recurrente/),
    ).not.toBeInTheDocument();
  });

  it("labels actual operational counts without inferring financial values", () => {
    const summary = buildAdminSummary();
    render(<AdminDashboardKpiRow summary={summary} isLoading={false} />);
    expect(screen.getByText("Referidos manuales")).toBeInTheDocument();
    expect(screen.getByText("Atribuciones LINK")).toBeInTheDocument();
    expect(screen.queryByText(/S\/|MRR|ROI/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/10%|15 meses|LTV \/ costo|1er mes \+ recurrente/),
    ).not.toBeInTheDocument();
  });

  it.each(["activo_sin_pago", "pagando"] as const)(
    "%s shows financial unavailability, not mock amounts or an implemented commissions page",
    (status) => {
      const referral: PartnerReferral = {
        id: "test-referral",
        businessName: "Test business",
        origin: "manual",
        status,
        registeredAt: "2026-10-01T10:00:00Z",
        planName: null,
        firstMonthCommission: 987654,
        recurringCommission: 123456,
      };
      render(<ReferralDetailDrawer referral={referral} onClose={jest.fn()} />);
      expect(screen.getByText("Estado reportado")).toBeInTheDocument();
      expect(screen.getByText(/El historial de eventos no está disponible/)).toBeInTheDocument();
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
      expect(screen.queryByText("Invitación enviada")).not.toBeInTheDocument();
      expect(screen.queryByText("Cuenta creada")).not.toBeInTheDocument();
      expect(screen.queryByText("Registrado")).not.toBeInTheDocument();
      if (status === "activo_sin_pago") {
        expect(screen.queryByText("Pago calificado registrado")).not.toBeInTheDocument();
      }
      expect(screen.getByRole("status")).toHaveTextContent(
        /comisiones todavía no están implementadas/,
      );
      expect(screen.getByRole("status")).toHaveTextContent(/Crear una empresa no confirma un pago/);
      expect(
        screen.queryByText(
          /Activó un plan|Pagó · activa|comisión activa|1er mes|recurrente|S\/|987654|123456/,
        ),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/El detalle de tus comisiones está/)).not.toBeInTheDocument();
    },
  );
});
