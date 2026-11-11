import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CertificadoTab } from "@/app/facturacion/components/tabs/CertificadoTab";
import { useDeleteSunatProfile } from "@/features/sunat/sunat-profile/hooks/use-delete-sunat-profile";
import { useReplaceSunatProfileCertificate } from "@/features/sunat/sunat-profile/hooks/use-replace-sunat-profile-certificate";
import { useSetDefaultSunatProfile } from "@/features/sunat/sunat-profile/hooks/use-set-default-sunat-profie";
import { useSunatProfiles } from "@/features/sunat/sunat-profile/hooks/use-sunat-profiles";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";

jest.mock("@/features/sunat/sunat-profile/hooks/use-sunat-profiles");
jest.mock("@/features/sunat/sunat-profile/hooks/use-set-default-sunat-profie");
jest.mock("@/features/sunat/sunat-profile/hooks/use-delete-sunat-profile");
jest.mock("@/features/sunat/sunat-profile/hooks/use-replace-sunat-profile-certificate");
jest.mock("@/app/facturacion/components/modals/CertificadoUploadModal", () => ({
  __esModule: true,
  default: () => null,
}));

function buildProfile(overrides: Partial<SunatProfile> = {}): SunatProfile {
  return {
    id: "p1",
    companyId: "c1",
    name: "Perfil",
    description: null,
    ruc: "20123456789",
    razonSocial: "ACME S.A.C.",
    countryCode: "PE",
    ubigeo: "150101",
    address: "Av. 1",
    establishmentCode: "0000",
    logoUrl: null,
    certificateSubject: "CN=ACME",
    certificateSerial: "01",
    certificateValidFrom: new Date("2026-01-01"),
    certificateValidUntil: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000),
    isDefault: false,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

const deleteMutate = jest.fn();
const replaceMutate = jest.fn();

function givenProfiles(profiles: SunatProfile[]) {
  (useSunatProfiles as jest.Mock).mockReturnValue({
    data: profiles,
    isLoading: false,
    isError: false,
  });
}

describe("CertificadoTab: acciones sobre el certificado", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSetDefaultSunatProfile as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });
    (useDeleteSunatProfile as jest.Mock).mockReturnValue({
      mutate: deleteMutate,
      isPending: false,
    });
    (useReplaceSunatProfileCertificate as jest.Mock).mockReturnValue({
      mutate: replaceMutate,
      isPending: false,
    });
  });

  it("muestra Reemplazar y Eliminar en cada certificado", () => {
    givenProfiles([
      buildProfile({ id: "p1", isDefault: true }),
      buildProfile({ id: "p2", ruc: "20999999999" }),
    ]);

    render(<CertificadoTab />);

    expect(screen.getAllByRole("button", { name: /reemplazar certificado/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /eliminar certificado/i })).toHaveLength(2);
  });

  it("elimina un certificado no predeterminado tras confirmar", async () => {
    givenProfiles([
      buildProfile({ id: "p1", isDefault: true }),
      buildProfile({ id: "p2", ruc: "20999999999" }),
    ]);

    render(<CertificadoTab />);

    const deleteButtons = screen.getAllByRole("button", { name: /eliminar certificado/i });
    await userEvent.click(deleteButtons[1]);

    const dialog = await screen.findByRole("alertdialog");

    expect(within(dialog).getByText(/de forma definitiva/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/usuario y la clave sol/i)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: /^eliminar$/i }));

    expect(deleteMutate).toHaveBeenCalledTimes(1);
    expect(deleteMutate.mock.calls[0][0]).toBe("p2");
  });

  it("bloquea eliminar el predeterminado mientras existan otros certificados", async () => {
    givenProfiles([
      buildProfile({ id: "p1", isDefault: true }),
      buildProfile({ id: "p2", ruc: "20999999999" }),
    ]);

    render(<CertificadoTab />);

    await userEvent.click(screen.getAllByRole("button", { name: /eliminar certificado/i })[0]);

    const dialog = await screen.findByRole("alertdialog");

    expect(
      within(dialog).getByText(/marca otro certificado como predeterminado/i),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /^eliminar$/i })).toBeDisabled();
  });

  it("permite eliminar el predeterminado cuando es el único", async () => {
    givenProfiles([buildProfile({ id: "p1", isDefault: true })]);

    render(<CertificadoTab />);

    await userEvent.click(screen.getByRole("button", { name: /eliminar certificado/i }));

    const dialog = await screen.findByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: /^eliminar$/i });

    expect(confirm).toBeEnabled();

    await userEvent.click(confirm);

    expect(deleteMutate.mock.calls[0][0]).toBe("p1");
  });

  it("reemplaza el certificado con el archivo y la contraseña indicados", async () => {
    givenProfiles([buildProfile({ id: "p1", isDefault: true })]);

    render(<CertificadoTab />);

    await userEvent.click(screen.getByRole("button", { name: /reemplazar certificado/i }));

    const dialog = await screen.findByRole("dialog");
    const file = new File(["p12-bytes"], "correcto.p12", { type: "application/x-pkcs12" });

    await userEvent.type(within(dialog).getByLabelText(/contraseña del certificado/i), "secreto");
    await userEvent.upload(within(dialog).getByLabelText(/certificado digital/i), file);
    await userEvent.click(within(dialog).getByRole("button", { name: /validar y reemplazar/i }));

    expect(replaceMutate).toHaveBeenCalledTimes(1);
    expect(replaceMutate.mock.calls[0][0]).toEqual({
      id: "p1",
      certificate: file,
      certificatePassword: "secreto",
    });
  });

  it("no envía el reemplazo si falta el archivo o la contraseña", async () => {
    givenProfiles([buildProfile({ id: "p1", isDefault: true })]);

    render(<CertificadoTab />);

    await userEvent.click(screen.getByRole("button", { name: /reemplazar certificado/i }));

    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /validar y reemplazar/i }));

    expect(replaceMutate).not.toHaveBeenCalled();
  });
});
