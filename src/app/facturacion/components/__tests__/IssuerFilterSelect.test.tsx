import { render, screen } from "@testing-library/react";
import { ALL_ISSUERS, IssuerFilterSelect } from "@/app/facturacion/components/IssuerFilterSelect";
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
    certificateValidUntil: null,
    isDefault: true,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

const segunda = profile({
  id: "p2",
  ruc: "20222222222",
  razonSocial: "SEGUNDA E.I.R.L.",
  isDefault: false,
});

describe("IssuerFilterSelect", () => {
  it("no se muestra con un solo RUC activo", () => {
    const { container } = render(
      <IssuerFilterSelect
        profiles={[profile({}), { ...segunda, isActive: false }]}
        value={ALL_ISSUERS}
        onChange={jest.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("muestra el RUC seleccionado con varios RUC", () => {
    render(
      <IssuerFilterSelect profiles={[profile({}), segunda]} value="p2" onChange={jest.fn()} />,
    );

    expect(screen.getByRole("combobox", { name: "RUC emisor" })).toHaveTextContent(
      "SEGUNDA E.I.R.L. · 20222222222",
    );
  });
});
