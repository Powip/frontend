import { render, screen } from "@testing-library/react";
import RucPagoClient from "@/app/facturacion/ruc-pago/RucPagoClient";
import { useExtraRucPurchase } from "@/features/sunat/extra-ruc/hooks/use-extra-ruc-purchase";
import type { ExtraRucPurchase } from "@/features/sunat/extra-ruc/models/extra-ruc";
import { useActivateSunatProfile } from "@/features/sunat/sunat-profile/hooks/use-activate-sunat-profile";
import { useSunatProfiles } from "@/features/sunat/sunat-profile/hooks/use-sunat-profiles";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";

const replace = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
jest.mock("@/features/sunat/extra-ruc/hooks/use-extra-ruc-purchase");
jest.mock("@/features/sunat/sunat-profile/hooks/use-sunat-profiles");
jest.mock("@/features/sunat/sunat-profile/hooks/use-activate-sunat-profile");

const activateMutate = jest.fn();
const refetch = jest.fn();

function purchase(status: ExtraRucPurchase["status"]): ExtraRucPurchase {
  return {
    id: "pur-1",
    ruc: "20888888888",
    razonSocial: "PAGADA SAC",
    amount: 30,
    currency: "PEN",
    status,
    redirectUrl: null,
    createdAt: "2026-11-18T10:00:00",
    paidAt: null,
    activeUntil: null,
    renewing: false,
  };
}

function givenPurchase(value: ExtraRucPurchase | undefined) {
  (useExtraRucPurchase as jest.Mock).mockReturnValue({ data: value, isError: false, refetch });
}

function givenProfiles(profiles: Partial<SunatProfile>[]) {
  (useSunatProfiles as jest.Mock).mockReturnValue({ data: profiles, isLoading: false });
}

function setUrl(search: string) {
  window.history.pushState({}, "", `/facturacion/ruc-pago${search}`);
}

beforeEach(() => {
  jest.clearAllMocks();
  (useActivateSunatProfile as jest.Mock).mockReturnValue({ mutate: activateMutate });
  givenProfiles([{ id: "a", ruc: "20111111111", isActive: true }]);
});

describe("RucPagoClient", () => {
  it("mientras el pago está pendiente muestra que se está confirmando", () => {
    setUrl("?purchase=pur-1");
    givenPurchase(purchase("PENDING"));

    render(<RucPagoClient />);

    expect(screen.getByText(/Estamos confirmando tu pago con Flow/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("con el pago confirmado de un RUC nuevo vuelve a Facturación con el RUC para subir su certificado", () => {
    setUrl("?purchase=pur-1");
    givenPurchase(purchase("PAID"));

    render(<RucPagoClient />);

    expect(screen.getByText(/Pago confirmado/)).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith(
      "/facturacion?nuevoRuc=20888888888&razonSocial=PAGADA+SAC",
    );
    expect(activateMutate).not.toHaveBeenCalled();
  });

  it("con el pago confirmado de un RUC que ya existía desactivado lo activa solo", () => {
    setUrl("?purchase=pur-1");
    givenPurchase(purchase("PAID"));
    givenProfiles([{ id: "b", ruc: "20888888888", isActive: false }]);

    render(<RucPagoClient />);

    expect(activateMutate).toHaveBeenCalledWith(
      "b",
      expect.objectContaining({ onSettled: expect.any(Function) }),
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("si el pago falló lo dice y no agrega nada", () => {
    setUrl("?purchase=pur-1");
    givenPurchase(purchase("FAILED"));

    render(<RucPagoClient />);

    expect(screen.getByText(/El pago no se completó/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("sin identificador de compra avisa y ofrece volver", () => {
    setUrl("");
    givenPurchase(undefined);

    render(<RucPagoClient />);

    expect(screen.getByText(/No encontramos el pago/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver a Facturación" })).toBeInTheDocument();
  });
});
