/**
 * Tests: PartnerLinkCard
 *
 * Comportamiento verificado:
 * 1. Muestra el link y el código reales del perfil, nunca los del mock de métricas.
 * 2. Sin link ni código asignados, lo indica en lugar de inventarlos.
 * 3. Las métricas quedan identificadas como datos simulados.
 * 4. Mientras cargan las métricas, muestra un skeleton; si fallan, permite reintentar.
 * 5. "Copiar" copia el link y "Copiar código" copia el código, con toast de éxito.
 */

import type React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { PartnerLinkCard } from "../partner-link-card";
import type { PartnerLink } from "@/features/partners/models/partner-link";

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
    metrics: METRICS,
    isLoadingMetrics: false,
    isMetricsError: false,
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

  it("marca las métricas como datos simulados", () => {
    renderCard();

    expect(screen.getByRole("note")).toHaveTextContent(/datos simulados/i);
    expect(screen.getByText("312")).toBeInTheDocument();
    expect(screen.getByText("47")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("muestra un skeleton mientras cargan las métricas, sin ocultar el link real", () => {
    renderCard({ metrics: undefined, isLoadingMetrics: true });

    expect(screen.getByText(REFERRAL_LINK)).toBeInTheDocument();
    expect(screen.queryByText("312")).not.toBeInTheDocument();
  });

  it("si fallan las métricas, Reintentar llama a onRetryMetrics", async () => {
    const user = userEvent.setup();
    const props = renderCard({ metrics: undefined, isMetricsError: true });

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
