import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddIssuerFlow } from "@/app/facturacion/components/modals/AddIssuerFlow";
import { useBuyExtraRuc } from "@/features/sunat/extra-ruc/hooks/use-buy-extra-ruc";
import { useExtraRucSummary } from "@/features/sunat/extra-ruc/hooks/use-extra-ruc-summary";
import type { ExtraRucSummary } from "@/features/sunat/extra-ruc/models/extra-ruc";
import { useActivateSunatProfile } from "@/features/sunat/sunat-profile/hooks/use-activate-sunat-profile";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";
import { goToExternalPage } from "@/lib/browserNavigation";

const push = jest.fn();
jest.mock("@/lib/browserNavigation", () => ({ goToExternalPage: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), info: jest.fn(), success: jest.fn() } }));
jest.mock("@/features/sunat/extra-ruc/hooks/use-buy-extra-ruc");
jest.mock("@/features/sunat/extra-ruc/hooks/use-extra-ruc-summary");
jest.mock("@/features/sunat/sunat-profile/hooks/use-activate-sunat-profile");
jest.mock("@/app/facturacion/components/VerifyIdentityButton", () => ({
  VerifyIdentityButton: () => null,
}));
jest.mock("@/app/facturacion/components/modals/CertificadoUploadModal", () => ({
  __esModule: true,
  default: ({
    isOpen,
    initialIdentity,
  }: {
    isOpen: boolean;
    initialIdentity?: { ruc: string; razonSocial: string };
  }) =>
    isOpen ? (
      <div>
        Subir certificado de {initialIdentity?.ruc} {initialIdentity?.razonSocial}
      </div>
    ) : null,
}));

const buyMutate = jest.fn();
const activateMutate = jest.fn();

function summary(overrides: Partial<ExtraRucSummary>): ExtraRucSummary {
  return {
    includedRucs: 1,
    extraRucsPaid: 0,
    renewingRucs: 0,
    maxRucs: 1,
    unlimited: false,
    pricePerRuc: 30,
    monthlyExtraTotal: 0,
    currency: "PEN",
    purchases: [],
    ...overrides,
  };
}

function profile(id: string, ruc: string, isActive: boolean): SunatProfile {
  return { id, ruc, razonSocial: `EMPRESA ${id}`, isActive } as SunatProfile;
}

function givenSummary(value: ExtraRucSummary | undefined) {
  (useExtraRucSummary as jest.Mock).mockReturnValue({ data: value });
}

async function fillAndConfirm(buttonName: RegExp) {
  await userEvent.type(screen.getByLabelText("RUC"), "20999999999");
  await userEvent.type(screen.getByLabelText("Razón social"), "NUEVA SAC");
  await userEvent.click(screen.getByRole("button", { name: buttonName }));
}

beforeEach(() => {
  jest.clearAllMocks();
  (useBuyExtraRuc as jest.Mock).mockReturnValue({ mutate: buyMutate, isPending: false });
  (useActivateSunatProfile as jest.Mock).mockReturnValue({
    mutate: activateMutate,
    isPending: false,
  });
});

describe("AddIssuerFlow", () => {
  it("con un RUC libre (cupo 2, 1 activo) no cobra y pasa a subir el certificado con ese RUC", async () => {
    givenSummary(summary({ maxRucs: 2, extraRucsPaid: 1 }));
    render(
      <AddIssuerFlow isOpen onClose={jest.fn()} profiles={[profile("a", "20111111111", true)]} />,
    );

    await fillAndConfirm(/Agregar RUC \(incluido\)/);

    expect(buyMutate).not.toHaveBeenCalled();
    expect(screen.getByText(/Subir certificado de 20999999999 NUEVA SAC/)).toBeInTheDocument();
  });

  it("sin cupo libre pide el pago por adelantado y manda a la pasarela de Flow", async () => {
    givenSummary(summary({ maxRucs: 1 }));
    buyMutate.mockImplementation((_values, options) =>
      options.onSuccess({ redirectUrl: "https://sandbox.flow.cl/pay?token=abc" }),
    );
    render(
      <AddIssuerFlow isOpen onClose={jest.fn()} profiles={[profile("a", "20111111111", true)]} />,
    );

    await fillAndConfirm(/Agregar RUC \(\+S\/ 30\/mes\)/);

    expect(buyMutate).toHaveBeenCalledWith(
      { ruc: "20999999999", razonSocial: "NUEVA SAC" },
      expect.anything(),
    );
    expect(goToExternalPage).toHaveBeenCalledWith("https://sandbox.flow.cl/pay?token=abc");
  });

  it("si la cuenta no está en Flow la manda a /pasate-a-flow", async () => {
    givenSummary(summary({ maxRucs: 1 }));
    const onClose = jest.fn();
    buyMutate.mockImplementation((_values, options) =>
      options.onError({
        isAxiosError: true,
        response: { data: { code: "NO_FLOW_PLAN" } },
      }),
    );
    render(
      <AddIssuerFlow isOpen onClose={onClose} profiles={[profile("a", "20111111111", true)]} />,
    );

    await fillAndConfirm(/Agregar RUC \(\+S\/ 30\/mes\)/);

    expect(push).toHaveBeenCalledWith("/pasate-a-flow");
    expect(onClose).toHaveBeenCalled();
  });

  it("al volver de pagar (cupo pagado) abre directo la subida del certificado con el RUC pagado", () => {
    givenSummary(summary({ maxRucs: 2, extraRucsPaid: 1 }));
    render(
      <AddIssuerFlow
        isOpen
        onClose={jest.fn()}
        profiles={[profile("a", "20111111111", true)]}
        paidIdentity={{ ruc: "20888888888", razonSocial: "PAGADA SAC" }}
      />,
    );

    expect(screen.getByText(/Subir certificado de 20888888888 PAGADA SAC/)).toBeInTheDocument();
    expect(screen.queryByText("Agregar RUC emisor")).not.toBeInTheDocument();
  });

  it("para reactivar un RUC desactivado sin cupo muestra sus datos y paga el cupo", async () => {
    givenSummary(summary({ maxRucs: 1 }));
    buyMutate.mockImplementation(() => undefined);
    render(
      <AddIssuerFlow
        isOpen
        onClose={jest.fn()}
        profiles={[profile("a", "20111111111", true), profile("b", "20222222222", false)]}
        reactivate={{ ruc: "20222222222", razonSocial: "EMPRESA b", profileId: "b" }}
      />,
    );

    expect(screen.getByLabelText("RUC")).toHaveValue("20222222222");

    await userEvent.click(screen.getByRole("button", { name: /Agregar RUC \(\+S\/ 30\/mes\)/ }));

    expect(buyMutate).toHaveBeenCalledWith(
      { ruc: "20222222222", razonSocial: "EMPRESA b" },
      expect.anything(),
    );
  });

  it("para reactivar un RUC cuando ya hay cupo libre solo lo activa, sin cobrar", async () => {
    givenSummary(summary({ maxRucs: 2, extraRucsPaid: 1 }));
    render(
      <AddIssuerFlow
        isOpen
        onClose={jest.fn()}
        profiles={[profile("a", "20111111111", true), profile("b", "20222222222", false)]}
        reactivate={{ ruc: "20222222222", razonSocial: "EMPRESA b", profileId: "b" }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Agregar RUC \(incluido\)/ }));

    expect(activateMutate).toHaveBeenCalledWith("b", expect.anything());
    expect(buyMutate).not.toHaveBeenCalled();
  });

  it("para volver a pagar un cupo siempre cobra, aunque haya cupo libre", async () => {
    givenSummary(summary({ maxRucs: 3, extraRucsPaid: 2 }));
    buyMutate.mockImplementation(() => undefined);
    render(
      <AddIssuerFlow
        isOpen
        onClose={jest.fn()}
        profiles={[profile("a", "20111111111", true)]}
        repay={{ ruc: "20333333333", razonSocial: "VENCIDA SAC" }}
      />,
    );

    expect(screen.getByLabelText("RUC")).toHaveValue("20333333333");

    await userEvent.click(screen.getByRole("button", { name: /Agregar RUC \(\+S\/ 30\/mes\)/ }));

    expect(buyMutate).toHaveBeenCalledWith(
      { ruc: "20333333333", razonSocial: "VENCIDA SAC" },
      expect.anything(),
    );
    expect(activateMutate).not.toHaveBeenCalled();
  });
});
