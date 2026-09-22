/**
 * Tests: PartnerLinkCard
 *
 * Comportamiento verificado:
 * 1. Mientras carga, muestra skeletons y no el link/código.
 * 2. Con datos, muestra el link, el código y las 3 estadísticas.
 * 3. "Copiar" copia el link al portapapeles y muestra un toast de éxito.
 * 4. "Copiar código" copia el código y muestra un toast con el código incluido.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { PartnerLinkCard } from "../partner-link-card";
import type { PartnerLink } from "@/features/partners/models/partner-link";

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const LINK: PartnerLink = {
  url: "powip.com/r/joel-coila",
  code: "JOEL10",
  discountPct: 10,
  clicks: 312,
  codeUses: 47,
  conversions: 7,
};

function setupUserWithClipboardSpy() {
  const user = userEvent.setup();
  const writeTextMock = jest.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
  return { user, writeTextMock };
}

beforeEach(() => {
  jest.mocked(toast.success).mockReset();
});

describe("PartnerLinkCard", () => {
  it("muestra skeletons mientras carga", () => {
    render(<PartnerLinkCard link={undefined} isLoading={true} />);
    expect(screen.queryByText("JOEL10")).not.toBeInTheDocument();
  });

  it("muestra el link, el código y las estadísticas", () => {
    render(<PartnerLinkCard link={LINK} isLoading={false} />);
    expect(screen.getByText(LINK.url)).toBeInTheDocument();
    expect(screen.getByText(LINK.code)).toBeInTheDocument();
    expect(screen.getByText("312")).toBeInTheDocument();
    expect(screen.getByText("47")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it('"Copiar" copia el link y muestra un toast de éxito', async () => {
    const { user, writeTextMock } = setupUserWithClipboardSpy();
    render(<PartnerLinkCard link={LINK} isLoading={false} />);

    await user.click(screen.getByRole("button", { name: /^copiar$/i }));

    expect(writeTextMock).toHaveBeenCalledWith(LINK.url);
    expect(toast.success).toHaveBeenCalledWith("Link copiado");
  });

  it('"Copiar código" copia el código y el toast incluye el código', async () => {
    const { user, writeTextMock } = setupUserWithClipboardSpy();
    render(<PartnerLinkCard link={LINK} isLoading={false} />);

    await user.click(screen.getByRole("button", { name: /copiar código/i }));

    expect(writeTextMock).toHaveBeenCalledWith(LINK.code);
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining(LINK.code));
  });
});
