/**
 * Tests: credenciales GRE por RUC en Facturación › Certificado Digital (FEAT-24 H12).
 *
 * 1. Cada RUC muestra si tiene la guía de remisión configurada (client_id, serie y próximo número).
 * 2. Configurar: valida client_id, client_secret y serie (T + 3) y guarda contra ms-sunat.
 * 3. Actualizar: el secreto se vuelve a escribir y el próximo número no retrocede (también el 409).
 * 4. Aviso de modo de pruebas mientras ms-sunat no envía a SUNAT.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CertificadoTab } from "@/app/facturacion/components/tabs/CertificadoTab";
import { getGreSettingsApi, upsertGreCredentialApi } from "@/features/sunat/despatch-advice/api/despatch-advice.api";
import type { GreSettings } from "@/features/sunat/despatch-advice/types/despatch-advice.types";
import { useDeleteSunatProfile } from "@/features/sunat/sunat-profile/hooks/use-delete-sunat-profile";
import { useReplaceSunatProfileCertificate } from "@/features/sunat/sunat-profile/hooks/use-replace-sunat-profile-certificate";
import { useSetDefaultSunatProfile } from "@/features/sunat/sunat-profile/hooks/use-set-default-sunat-profie";
import { useSunatProfiles } from "@/features/sunat/sunat-profile/hooks/use-sunat-profiles";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t", company: { id: "c-1" }, user: { id: "u-1" } } }),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/features/sunat/sunat-profile/hooks/use-sunat-profiles");
jest.mock("@/features/sunat/sunat-profile/hooks/use-set-default-sunat-profie");
jest.mock("@/features/sunat/sunat-profile/hooks/use-delete-sunat-profile");
jest.mock("@/features/sunat/sunat-profile/hooks/use-replace-sunat-profile-certificate");
jest.mock("@/app/facturacion/components/modals/CertificadoUploadModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/features/sunat/despatch-advice/api/despatch-advice.api", () => ({
  getGreSettingsApi: jest.fn(),
  upsertGreCredentialApi: jest.fn(),
}));

function profile(id: string, ruc: string, razonSocial: string, isDefault: boolean): SunatProfile {
  return {
    id,
    companyId: "c-1",
    name: razonSocial,
    description: null,
    ruc,
    razonSocial,
    countryCode: "PE",
    ubigeo: "150101",
    address: "Av. 1",
    establishmentCode: "0000",
    logoUrl: null,
    certificateSubject: "CN=X",
    certificateSerial: "01",
    certificateValidFrom: new Date("2026-01-01"),
    certificateValidUntil: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000),
    isDefault,
    isActive: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  };
}

const SETTINGS: GreSettings = {
  sunatConnection: "SUNAT_PRODUCTION",
  profiles: [
    {
      sunatProfileId: "p1",
      ruc: "20111111111",
      razonSocial: "ACME S.A.C.",
      isDefault: true,
      isActive: true,
      configured: true,
      clientId: "client-acme",
      series: "T001",
      nextCorrelative: 9,
      updatedAt: "2026-11-17T10:00:00Z",
    },
    {
      sunatProfileId: "p2",
      ruc: "20222222222",
      razonSocial: "BETA E.I.R.L.",
      isDefault: false,
      isActive: true,
      configured: false,
      clientId: null,
      series: null,
      nextCorrelative: null,
      updatedAt: null,
    },
  ],
};

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CertificadoTab />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const greBlock = (ruc: string) => screen.findByTestId(`gre-credentials-${ruc}`);

beforeEach(() => {
  jest.clearAllMocks();
  (useSunatProfiles as jest.Mock).mockReturnValue({
    data: [profile("p1", "20111111111", "ACME S.A.C.", true), profile("p2", "20222222222", "BETA E.I.R.L.", false)],
    isLoading: false,
    isError: false,
  });
  (useSetDefaultSunatProfile as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
  (useDeleteSunatProfile as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
  (useReplaceSunatProfileCertificate as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
  jest.mocked(getGreSettingsApi).mockResolvedValue(SETTINGS);
  jest.mocked(upsertGreCredentialApi).mockResolvedValue({
    sunatProfileId: "p2",
    clientId: "client-beta",
    hasClientSecret: true,
    series: "T002",
    nextCorrelative: 1,
    updatedAt: "2026-11-18T10:00:00Z",
  });
});

describe("CertificadoTab: credenciales GRE", () => {
  it("muestra por RUC si la guía de remisión está configurada", async () => {
    setup();
    const acme = await greBlock("20111111111");
    await waitFor(() => expect(acme).toHaveTextContent("configurada"));
    expect(acme).toHaveTextContent("client_id client-acme · serie T001 · próximo número 9");
    expect(within(acme).getByRole("button", { name: "Actualizar credenciales GRE" })).toBeInTheDocument();

    const beta = await greBlock("20222222222");
    expect(beta).toHaveTextContent("falta configurar");
    expect(within(beta).getByRole("button", { name: "Configurar credenciales GRE" })).toBeInTheDocument();
    expect(screen.queryByTestId("gre-mode-banner")).not.toBeInTheDocument();
  });

  it("configura un RUC: valida los campos y guarda en ms-sunat", async () => {
    const user = setup();
    const beta = await greBlock("20222222222");
    await user.click(await within(beta).findByRole("button", { name: "Configurar credenciales GRE" }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("BETA E.I.R.L. · RUC 20222222222");
    await user.clear(within(dialog).getByLabelText("Serie"));
    await user.type(within(dialog).getByLabelText("Serie"), "F001");
    await user.click(within(dialog).getByRole("button", { name: "Guardar credenciales" }));
    expect(within(dialog).getByText("Escribe el client_id que te dio SOL.")).toBeInTheDocument();
    expect(within(dialog).getByText("Escribe el client_secret que te dio SOL.")).toBeInTheDocument();
    expect(within(dialog).getByText(/empieza con T/)).toBeInTheDocument();
    expect(upsertGreCredentialApi).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText("client_id"), "client-beta");
    await user.type(within(dialog).getByLabelText("client_secret"), "s3cr3t");
    await user.clear(within(dialog).getByLabelText("Serie"));
    await user.type(within(dialog).getByLabelText("Serie"), "t002");
    await user.click(within(dialog).getByRole("button", { name: "Guardar credenciales" }));

    await waitFor(() => expect(upsertGreCredentialApi).toHaveBeenCalledWith("p2", { clientId: "client-beta", clientSecret: "s3cr3t", series: "T002" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("al actualizar pide de nuevo el secreto y no deja retroceder el número", async () => {
    jest.mocked(upsertGreCredentialApi).mockRejectedValueOnce({ response: { status: 409, data: { code: "GRE_SEQUENCE_CANNOT_MOVE_BACK" } } });
    const user = setup();
    const acme = await greBlock("20111111111");
    await user.click(await within(acme).findByRole("button", { name: "Actualizar credenciales GRE" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("client_id")).toHaveValue("client-acme");
    expect(within(dialog).getByLabelText("client_secret")).toHaveValue("");
    await user.clear(within(dialog).getByLabelText("Próximo número (opcional)"));
    await user.type(within(dialog).getByLabelText("Próximo número (opcional)"), "3");
    await user.click(within(dialog).getByRole("button", { name: "Guardar credenciales" }));
    expect(within(dialog).getByText(/Vuelve a escribir el client_secret/)).toBeInTheDocument();
    expect(within(dialog).getByText("No puede ser menor que 9: esos números ya se usaron.")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("client_secret"), "nuevo");
    await user.clear(within(dialog).getByLabelText("Próximo número (opcional)"));
    await user.type(within(dialog).getByLabelText("Próximo número (opcional)"), "12");
    await user.click(within(dialog).getByRole("button", { name: "Guardar credenciales" }));

    await waitFor(() =>
      expect(upsertGreCredentialApi).toHaveBeenCalledWith("p1", { clientId: "client-acme", clientSecret: "nuevo", series: "T001", nextCorrelative: 12 }),
    );
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Ese número ya se usó en la serie");
  });

  it("mientras ms-sunat no envía a SUNAT muestra el aviso de modo de pruebas", async () => {
    jest.mocked(getGreSettingsApi).mockResolvedValue({ ...SETTINGS, sunatConnection: "NOT_CONFIGURED" });
    setup();
    expect(await screen.findByTestId("gre-mode-banner")).toHaveTextContent("La emisión real de guías de remisión se habilita con la empresa piloto.");
  });
});
