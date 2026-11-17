import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EstablishmentCodeModal } from "@/app/facturacion/components/modals/EstablishmentCodeModal";
import { useUpdateSunatProfileEstablishmentCode } from "@/features/sunat/sunat-profile/hooks/use-update-sunat-profile-establishment-code";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";

jest.mock("@/features/sunat/sunat-profile/hooks/use-update-sunat-profile-establishment-code");

const mutate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useUpdateSunatProfileEstablishmentCode as jest.Mock).mockReturnValue({
    mutate,
    isPending: false,
  });
});

function profile(establishmentCode: string): SunatProfile {
  return {
    id: "profile-1",
    razonSocial: "EMPRESA UNO S.A.C.",
    ruc: "20123456789",
    establishmentCode,
  } as SunatProfile;
}

describe("EstablishmentCodeModal", () => {
  it("con el código vacío propone 0000 y lo guarda", async () => {
    const onClose = jest.fn();
    render(<EstablishmentCodeModal profile={profile("")} onClose={onClose} />);

    const input = screen.getByLabelText(/código de local anexo/i);
    expect(input).toHaveValue("0000");

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(mutate).toHaveBeenCalledWith(
      { id: "profile-1", establishmentCode: "0000" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("muestra el código actual y guarda el nuevo", async () => {
    render(<EstablishmentCodeModal profile={profile("0001")} onClose={jest.fn()} />);

    const input = screen.getByLabelText(/código de local anexo/i);
    expect(input).toHaveValue("0001");

    await userEvent.clear(input);
    await userEvent.type(input, "0002");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(mutate).toHaveBeenCalledWith(
      { id: "profile-1", establishmentCode: "0002" },
      expect.anything(),
    );
  });

  it("no guarda un código que no tiene 4 dígitos", async () => {
    render(<EstablishmentCodeModal profile={profile("0000")} onClose={jest.fn()} />);

    const input = screen.getByLabelText(/código de local anexo/i);
    await userEvent.clear(input);
    await userEvent.type(input, "12");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(screen.getByText(/debe tener 4 dígitos/i)).toBeInTheDocument();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("solo acepta números", async () => {
    render(<EstablishmentCodeModal profile={profile("")} onClose={jest.fn()} />);

    const input = screen.getByLabelText(/código de local anexo/i);
    await userEvent.clear(input);
    await userEvent.type(input, "a1b2");

    expect(input).toHaveValue("12");
  });
});
