import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ALL_ISSUERS, IssuerBar } from "@/app/facturacion/components/IssuerBar";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";

function profile(overrides: Partial<SunatProfile>): SunatProfile {
  return {
    id: "p1",
    companyId: "c1",
    name: "Perfil",
    description: null,
    ruc: "20111111111",
    razonSocial: "PRINCIPAL S.A.C.",
    countryCode: "PE",
    ubigeo: "150101",
    address: "Av. 1",
    establishmentCode: "0000",
    logoUrl: null,
    certificateSubject: null,
    certificateSerial: null,
    certificateValidFrom: null,
    certificateValidUntil: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000),
    isDefault: true,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("IssuerBar", () => {
  it("no se muestra con un solo RUC activo", () => {
    const { container } = render(
      <IssuerBar
        profiles={[profile({}), profile({ id: "p9", isActive: false, isDefault: false })]}
        value={ALL_ISSUERS}
        onChange={jest.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("filtra por RUC al elegir un emisor", async () => {
    const onChange = jest.fn();
    render(
      <IssuerBar
        profiles={[
          profile({}),
          profile({
            id: "p2",
            ruc: "20222222222",
            razonSocial: "SEGUNDA E.I.R.L.",
            isDefault: false,
          }),
        ]}
        value={ALL_ISSUERS}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("radio", { name: /Todos los RUC/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await userEvent.click(screen.getByRole("radio", { name: /SEGUNDA/ }));

    expect(onChange).toHaveBeenCalledWith("p2");
  });
});
