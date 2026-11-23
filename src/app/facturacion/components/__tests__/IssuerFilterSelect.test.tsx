import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("muestra un chip por RUC y marca el seleccionado", () => {
    render(
      <IssuerFilterSelect profiles={[profile({}), segunda]} value="p2" onChange={jest.fn()} />,
    );

    expect(screen.getByRole("group", { name: "RUC emisor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Todos los RUC/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: /SEGUNDA/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("RUC 20222222222")).toBeInTheDocument();
  });

  it("elegir un chip llama a onChange con el id del RUC y con Todos", async () => {
    const onChange = jest.fn();
    render(<IssuerFilterSelect profiles={[profile({}), segunda]} value="p1" onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /SEGUNDA/ }));
    expect(onChange).toHaveBeenCalledWith("p2");

    await userEvent.click(screen.getByRole("button", { name: /Todos los RUC/ }));
    expect(onChange).toHaveBeenCalledWith(ALL_ISSUERS);
  });

  it("muestra los fallos de cada RUC y el chip Agregar RUC", async () => {
    const onAddIssuer = jest.fn();
    render(
      <IssuerFilterSelect
        profiles={[profile({}), segunda]}
        value={ALL_ISSUERS}
        onChange={jest.fn()}
        failuresByRuc={{ "20222222222": 3 }}
        onAddIssuer={onAddIssuer}
      />,
    );

    expect(screen.getByLabelText("3 con fallos")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Agregar RUC/ }));
    expect(onAddIssuer).toHaveBeenCalled();
  });
});
