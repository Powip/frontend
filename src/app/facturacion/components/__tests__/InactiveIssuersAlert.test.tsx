import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  getOverLimitProfiles,
  InactiveIssuersAlert,
} from "@/app/facturacion/components/InactiveIssuersAlert";
import type {
  ExtraRucPurchase,
  ExtraRucSummary,
} from "@/features/sunat/extra-ruc/models/extra-ruc";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";

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

function profile(id: string, ruc: string, overrides: Partial<SunatProfile> = {}): SunatProfile {
  return {
    id,
    ruc,
    razonSocial: `EMPRESA ${id}`,
    isActive: true,
    isDefault: false,
    deactivationReason: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  } as SunatProfile;
}

function paidPurchase(ruc: string): ExtraRucPurchase {
  return {
    id: `p-${ruc}`,
    ruc,
    razonSocial: "X",
    amount: 30,
    currency: "PEN",
    status: "PAID",
    redirectUrl: null,
    createdAt: "2026-11-01T00:00:00.000Z",
    paidAt: "2026-11-01T00:00:00.000Z",
    activeUntil: "2999-12-31",
    renewing: true,
  };
}

const main = profile("main", "20100000001", {
  isDefault: true,
  createdAt: "2026-01-01T00:00:00.000Z",
});

describe("getOverLimitProfiles", () => {
  it("sin resumen o con empresa sin límite no marca nada", () => {
    const profiles = [main, profile("b", "20100000002")];

    expect(getOverLimitProfiles(profiles, undefined)).toEqual([]);
    expect(getOverLimitProfiles(profiles, summary({ unlimited: true }))).toEqual([]);
  });

  it("dentro del cupo no marca nada", () => {
    const profiles = [main, profile("b", "20100000002")];

    expect(getOverLimitProfiles(profiles, summary({ maxRucs: 2 }))).toEqual([]);
  });

  it("marca primero los RUC sin cupo propio y, entre ellos, el más nuevo; nunca el principal", () => {
    const old = profile("old", "20100000002", { createdAt: "2026-11-02T00:00:00.000Z" });
    const newer = profile("new", "20100000003", { createdAt: "2026-11-10T00:00:00.000Z" });
    const withSlot = profile("slot", "20100000004", { createdAt: "2026-11-20T00:00:00.000Z" });
    const profiles = [main, old, newer, withSlot];

    const result = getOverLimitProfiles(
      profiles,
      summary({ maxRucs: 2, purchases: [paidPurchase("20100000004")] }),
    );

    expect(result.map((p) => p.id)).toEqual(["new", "old"]);
  });
});

describe("InactiveIssuersAlert", () => {
  it("no muestra nada si no hay RUC desactivados ni exceso", () => {
    const { container } = render(
      <InactiveIssuersAlert
        profiles={[main]}
        pricePerRuc={30}
        summary={summary({})}
        onManage={jest.fn()}
        onPay={jest.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("avisa de los RUC desactivados por falta de pago y paga el cupo de ese RUC", async () => {
    const onPay = jest.fn();
    const unpaid = profile("b", "20100000002", { isActive: false, deactivationReason: "UNPAID" });
    render(
      <InactiveIssuersAlert
        profiles={[main, unpaid]}
        pricePerRuc={30}
        summary={summary({})}
        onManage={jest.fn()}
        onPay={onPay}
      />,
    );

    expect(screen.getByText(/Desactivamos 1 RUC por falta de pago/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Pagar y reactivar/ }));

    expect(onPay).toHaveBeenCalledWith(unpaid);
  });

  it("avisa de los RUC activos por encima de los cupos pagados", async () => {
    const onPay = jest.fn();
    const extra = profile("b", "20100000002");
    render(
      <InactiveIssuersAlert
        profiles={[main, extra]}
        pricePerRuc={30}
        summary={summary({ maxRucs: 1 })}
        onManage={jest.fn()}
        onPay={onPay}
      />,
    );

    expect(screen.getByText(/Tienes 2 RUC activos y 1 cupo pagado/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Pagar cupo/ }));

    expect(onPay).toHaveBeenCalledWith(extra);
  });

  it("los RUC que desactivó el usuario siguen con el aviso de siempre", async () => {
    const onManage = jest.fn();
    render(
      <InactiveIssuersAlert
        profiles={[main, profile("b", "20100000002", { isActive: false })]}
        pricePerRuc={30}
        summary={summary({})}
        onManage={onManage}
        onPay={jest.fn()}
      />,
    );

    expect(screen.getByText(/Tienes 1 RUC desactivado/)).toBeInTheDocument();
    expect(screen.queryByText(/falta de pago/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Ver Emisores \(RUC\)/ }));

    expect(onManage).toHaveBeenCalled();
  });
});
