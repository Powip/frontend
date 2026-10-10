/**
 * Tests: PartnerLinkCard
 *
 * Comportamiento verificado:
 * 1. Muestra el link y el código reales del perfil, nunca los del mock de métricas.
 * 2. Sin link ni código asignados, lo indica en lugar de inventarlos.
 * 3. Las métricas pendientes se indican no implementadas, sin muestras ni descuentos.
 * 4. Los errores permanentes no ofrecen Reintentar; los errores normales sí.
 * 5. "Copiar" copia el link y "Copiar código" copia el código, con toast de éxito.
 */

import type React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { PartnerLinkCard } from "../partner-link-card";
import type { PartnerLink } from "@/features/partners/models/partner-link";
import { PartnersFeatureUnavailableError } from "@/features/partners/utils/unavailable-partners-feature";

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const REFERRAL_LINK = "https://www.powip.tech/r/partner-demo-code";
const REFERRAL_CODE = "PARTNERDEMO";

const METRICS: PartnerLink = {
  url: "powip.com/r/joel-coila",
  code: "JOEL10",
  discountPct: 10,
  clicks: 312,
  codeUses: 47,
  conversions: 7,
};

function renderCard(overrides: Partial<React.ComponentProps<typeof PartnerLinkCard>> = {}) {
  const props: React.ComponentProps<typeof PartnerLinkCard> = {
    referralLink: REFERRAL_LINK,
    referralCode: REFERRAL_CODE,
    metrics: undefined,
    isLoadingMetrics: false,
    isMetricsError: true,
    metricsError: new PartnersFeatureUnavailableError("Consultar descuento y métricas del link"),
    onRetryMetrics: jest.fn(),
    ...overrides,
  };
  render(<PartnerLinkCard {...props} />);
  return props;
}

function setupUserWithClipboardSpy() {
  const user = userEvent.setup();
  const writeTextMock = jest.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
  return { user, writeTextMock };
}

beforeEach(() => {
  jest.mocked(toast.success).mockReset();
});

describe("PartnerLinkCard", () => {
  it("muestra el link y el código del perfil real y no los del mock", () => {
    renderCard();

    expect(screen.getByText(REFERRAL_LINK)).toBeInTheDocument();
    expect(screen.getByText(REFERRAL_CODE)).toBeInTheDocument();
    expect(screen.queryByText(METRICS.code)).not.toBeInTheDocument();
    expect(screen.queryByText(METRICS.url)).not.toBeInTheDocument();
  });

  it("indica que no hay link ni código cuando el perfil no los tiene", () => {
    renderCard({ referralLink: null, referralCode: null });

    expect(screen.getByText(/todavía no tenés un link asignado/i)).toBeInTheDocument();
    expect(screen.getByText(/todavía no tenés un código asignado/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copiar/i })).not.toBeInTheDocument();
  });

  it("indica métricas no implementadas sin mostrar datos antiguos, descuentos ni reintento", () => {
    renderCard({ metrics: METRICS });

    expect(screen.getByRole("alert")).toHaveTextContent(/todavía no está implementado/i);
    expect(screen.getByText(REFERRAL_LINK)).toBeInTheDocument();
    expect(screen.getByText(REFERRAL_CODE)).toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reintentar/i })).not.toBeInTheDocument();
    expect(screen.queryByText("312")).not.toBeInTheDocument();
    expect(screen.queryByText("47")).not.toBeInTheDocument();
    expect(screen.queryByText("7")).not.toBeInTheDocument();
    expect(screen.queryByText(/descuento el primer mes/)).not.toBeInTheDocument();
  });

  it("muestra un skeleton mientras cargan las métricas, sin ocultar el link real", () => {
    renderCard({ metrics: undefined, isLoadingMetrics: true, isMetricsError: false });

    expect(screen.getByText(REFERRAL_LINK)).toBeInTheDocument();
    expect(screen.queryByText("312")).not.toBeInTheDocument();
  });

  it("si fallan las métricas, Reintentar llama a onRetryMetrics", async () => {
    const user = userEvent.setup();
    const props = renderCard({
      metrics: undefined,
      isMetricsError: true,
      metricsError: new Error("network error"),
    });

    await user.click(screen.getByRole("button", { name: /reintentar/i }));

    expect(props.onRetryMetrics).toHaveBeenCalledTimes(1);
  });

  it('"Copiar" copia el link y muestra un toast de éxito', async () => {
    const { user, writeTextMock } = setupUserWithClipboardSpy();
    renderCard();

    await user.click(screen.getByRole("button", { name: /^copiar$/i }));

    expect(writeTextMock).toHaveBeenCalledWith(REFERRAL_LINK);
    expect(toast.success).toHaveBeenCalledWith("Link copiado");
  });

  it('"Copiar código" copia el código y el toast incluye el código', async () => {
    const { user, writeTextMock } = setupUserWithClipboardSpy();
    renderCard();

    await user.click(screen.getByRole("button", { name: /copiar código/i }));

    expect(writeTextMock).toHaveBeenCalledWith(REFERRAL_CODE);
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining(REFERRAL_CODE));
  });
});
