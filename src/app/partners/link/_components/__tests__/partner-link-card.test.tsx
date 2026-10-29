/**
 * Tests: PartnerLinkCard
 *
 * Comportamiento verificado:
 * 1. Muestra el link y el código reales del perfil.
 * 2. Sin link ni código asignados, lo indica en lugar de inventarlos.
 * 3. Muestra solo capturas, claims vinculados y empresas atribuidas reales.
 * 4. Los errores de acceso no ofrecen Reintentar; los errores normales sí.
 * 5. "Copiar" copia el link y "Copiar código" copia el código, con toast de éxito.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { toast } from "sonner";
import type { PartnerReferralMetrics } from "@/features/partners/models/partner-referral-metrics";
import { buildAxiosError } from "@/features/partners/test-utils/axios-error";
import { PartnerLinkCard } from "../partner-link-card";

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const REFERRAL_LINK = "https://www.powip.tech/r/partner-demo-code";
const REFERRAL_CODE = "PARTNERDEMO";

const METRICS: PartnerReferralMetrics = {
  claimCaptures: 12,
  attachedClaims: 7,
  attributedCompanies: 4,
  asOf: "2026-10-11T10:00:00Z",
};

function renderCard(overrides: Partial<React.ComponentProps<typeof PartnerLinkCard>> = {}) {
  const props: React.ComponentProps<typeof PartnerLinkCard> = {
    referralLink: REFERRAL_LINK,
    referralCode: REFERRAL_CODE,
    metrics: undefined,
    isLoadingMetrics: false,
    isMetricsError: true,
    metricsError: new Error("Fixture network failure"),
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
  it("muestra solo los tres contadores y el instante UTC, sin inferir navegación ni pagos", () => {
    renderCard({ metrics: METRICS, isMetricsError: false, metricsError: undefined });
    expect(screen.getByRole("region", { name: "Contadores de referido" })).toBeInTheDocument();
    expect(screen.getByText("Capturas de referido")).toBeInTheDocument();
    expect(screen.getByText("Claims vinculados")).toBeInTheDocument();
    expect(screen.getByText("Empresas atribuidas")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText(METRICS.asOf)).toHaveAttribute("datetime", METRICS.asOf);
    expect(screen.getByText(/No representan visitas de navegación/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Clics link|Usos del código|Cerraron|descuento el primer mes/),
    ).not.toBeInTheDocument();
  });

  it("muestra ceros solamente cuando llegan explícitamente en la respuesta", () => {
    renderCard({
      metrics: { ...METRICS, claimCaptures: 0, attachedClaims: 0, attributedCompanies: 0 },
      isMetricsError: false,
    });
    expect(screen.getAllByText("0")).toHaveLength(3);
  });

  it.each([401, 403])(
    "la denegación %s oculta contadores cacheados y no ofrece reintento",
    (status) => {
      renderCard({ metrics: METRICS, metricsError: buildAxiosError(status) });
      expect(screen.getByRole("alert")).toHaveTextContent(
        /No tenés acceso a los contadores de un Partner activo/,
      );
      expect(screen.queryByText("12")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /reintentar/i })).not.toBeInTheDocument();
    },
  );

  it("muestra el link y el código del perfil real", () => {
    renderCard();

    expect(screen.getByText(REFERRAL_LINK)).toBeInTheDocument();
    expect(screen.getByText(REFERRAL_CODE)).toBeInTheDocument();
  });

  it("indica que no hay link ni código cuando el perfil no los tiene", () => {
    renderCard({ referralLink: null, referralCode: null });

    expect(screen.getByText(/todavía no tenés un link asignado/i)).toBeInTheDocument();
    expect(screen.getByText(/todavía no tenés un código asignado/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /copiar/i })).not.toBeInTheDocument();
  });

  it("un error oculta los contadores antiguos y no promete descuentos aplicados", () => {
    renderCard({ metrics: METRICS });

    expect(screen.getByRole("alert")).toHaveTextContent(
      /No pudimos cargar los contadores de referido/i,
    );
    expect(screen.getByText(REFERRAL_LINK)).toBeInTheDocument();
    expect(screen.getByText(REFERRAL_CODE)).toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(screen.queryByText("12")).not.toBeInTheDocument();
    expect(screen.queryByText("4")).not.toBeInTheDocument();
    expect(screen.queryByText("7")).not.toBeInTheDocument();
    expect(screen.queryByText(/descuento el primer mes/)).not.toBeInTheDocument();
  });

  it("muestra un skeleton mientras cargan las métricas, sin ocultar el link real", () => {
    renderCard({ metrics: undefined, isLoadingMetrics: true, isMetricsError: false });

    expect(screen.getByText(REFERRAL_LINK)).toBeInTheDocument();
    expect(screen.queryByText("12")).not.toBeInTheDocument();
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
