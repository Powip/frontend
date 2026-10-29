import { render, screen, within } from "@testing-library/react";
import { CompanyOnboardingSummary } from "../CompanyOnboardingSummary";

describe("CompanyOnboardingSummary", () => {
  it("leaves a legacy business pending instead of treating operational channels as an answer", () => {
    const company = {
      onboarding_sales_channels: null,
      monthly_order_volume: null,
      sales_channels: ["WhatsApp"],
    };
    render(<CompanyOnboardingSummary company={company} />);

    expect(screen.getByRole("region", { name: "Perfil del negocio" })).toBeInTheDocument();
    expect(screen.getAllByText("Pendiente de responder")).toHaveLength(3);
    expect(screen.queryByText("WhatsApp")).not.toBeInTheDocument();
    expect(screen.queryByText("Completo")).not.toBeInTheDocument();
  });

  it("shows POS and other declared channels with the human-readable monthly range", () => {
    render(
      <CompanyOnboardingSummary company={{
        onboarding_sales_channels: ["POS (Punto de venta)", "TikTok Live"],
        monthly_order_volume: "FROM_2000_TO_6000",
      }} />,
    );

    expect(screen.getByText("Completo")).toBeVisible();
    const channels = screen.getByRole("list", { name: "Canales declarados" });
    expect(within(channels).getAllByRole("listitem")).toHaveLength(2);
    expect(within(channels).getByText("POS (Punto de venta)")).toBeVisible();
    expect(within(channels).getByText("TikTok Live")).toBeVisible();
    expect(screen.getByText("2,000 a 6,000")).toBeVisible();
    expect(screen.queryByText("FROM_2000_TO_6000")).not.toBeInTheDocument();
    expect(screen.queryByText("Pendiente de responder")).not.toBeInTheDocument();
  });

  it.each([
    { onboarding_sales_channels: ["Mercado Libre"], monthly_order_volume: null },
    { onboarding_sales_channels: [], monthly_order_volume: "OVER_6000" },
    { onboarding_sales_channels: ["Mercado Libre"], monthly_order_volume: "UNKNOWN" },
    { onboarding_sales_channels: ["Unknown channel"], monthly_order_volume: "OVER_6000" },
  ])("keeps incomplete or invalid answers pending (%j)", (company) => {
    render(<CompanyOnboardingSummary company={company} />);

    expect(screen.getAllByText("Pendiente de responder").length).toBeGreaterThan(0);
    expect(screen.queryByText("Completo")).not.toBeInTheDocument();
  });

  it("handles an absent business without claiming a completed profile", () => {
    render(<CompanyOnboardingSummary company={null} />);

    expect(screen.getAllByText("Pendiente de responder")).toHaveLength(3);
    expect(screen.queryByText("Completo")).not.toBeInTheDocument();
  });
});
