import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  canRepay,
  ExtraRucSlotsCard,
  isExpired,
} from "@/app/facturacion/components/ExtraRucSlotsCard";
import { useCancelExtraRuc } from "@/features/sunat/extra-ruc/hooks/use-cancel-extra-ruc";
import { useExtraRucSummary } from "@/features/sunat/extra-ruc/hooks/use-extra-ruc-summary";
import type {
  ExtraRucPurchase,
  ExtraRucSummary,
} from "@/features/sunat/extra-ruc/models/extra-ruc";

jest.mock("@/features/sunat/extra-ruc/hooks/use-cancel-extra-ruc");
jest.mock("@/features/sunat/extra-ruc/hooks/use-extra-ruc-summary");

const TODAY = "2026-11-23";

function purchase(overrides: Partial<ExtraRucPurchase>): ExtraRucPurchase {
  return {
    id: "p1",
    ruc: "20100000002",
    razonSocial: "EXTRA SAC",
    amount: 30,
    currency: "PEN",
    status: "PAID",
    redirectUrl: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    paidAt: "2026-10-01T00:00:00.000Z",
    activeUntil: "2026-12-01",
    renewing: true,
    ...overrides,
  };
}

function givenPurchases(purchases: ExtraRucPurchase[]) {
  const value: ExtraRucSummary = {
    includedRucs: 1,
    extraRucsPaid: purchases.length,
    renewingRucs: purchases.filter((p) => p.renewing).length,
    maxRucs: 1 + purchases.length,
    unlimited: false,
    pricePerRuc: 30,
    monthlyExtraTotal: 30,
    currency: "PEN",
    purchases,
  };
  (useExtraRucSummary as jest.Mock).mockReturnValue({ data: value });
}

beforeEach(() => {
  jest.clearAllMocks();
  (useCancelExtraRuc as jest.Mock).mockReturnValue({ mutate: jest.fn(), isPending: false });
});

describe("isExpired / canRepay", () => {
  it("vencido es cuando el último día pagado ya pasó", () => {
    expect(isExpired(purchase({ activeUntil: "2026-11-22" }), TODAY)).toBe(true);
    expect(isExpired(purchase({ activeUntil: "2026-11-23" }), TODAY)).toBe(false);
  });

  it("un cupo vigente que se renueva no se vuelve a pagar", () => {
    const current = purchase({});

    expect(canRepay(current, [current], TODAY)).toBe(false);
  });

  it("un cupo dado de baja o vencido se puede volver a pagar", () => {
    const canceled = purchase({ renewing: false });
    const expired = purchase({ id: "p2", ruc: "20100000003", activeUntil: "2026-11-01" });

    expect(canRepay(canceled, [canceled, expired], TODAY)).toBe(true);
    expect(canRepay(expired, [canceled, expired], TODAY)).toBe(true);
  });

  it("no se vuelve a pagar si ese RUC ya tiene un cupo vigente o uno más nuevo", () => {
    const old = purchase({ id: "old", activeUntil: "2026-10-01", renewing: false });
    const current = purchase({ id: "new", createdAt: "2026-11-02T00:00:00.000Z" });
    const newerCanceled = purchase({
      id: "newer",
      createdAt: "2026-11-02T00:00:00.000Z",
      renewing: false,
    });

    expect(canRepay(old, [old, current], TODAY)).toBe(false);
    expect(canRepay(old, [old, newerCanceled], TODAY)).toBe(false);
    expect(canRepay(newerCanceled, [old, newerCanceled], TODAY)).toBe(true);
  });
});

describe("ExtraRucSlotsCard", () => {
  it("muestra Vencido y Volver a pagar en un cupo vencido", async () => {
    const onRepay = jest.fn();
    const expired = purchase({ activeUntil: "2020-01-01" });
    givenPurchases([expired]);
    render(<ExtraRucSlotsCard onRepay={onRepay} />);

    expect(screen.getByText("Vencido")).toBeInTheDocument();
    expect(screen.getByText(/venció el 01\/01\/2020/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dar de baja" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Volver a pagar" }));

    expect(onRepay).toHaveBeenCalledWith(expired);
  });

  it("un cupo vigente que se renueva solo se puede dar de baja", () => {
    givenPurchases([purchase({ activeUntil: "2999-12-31" })]);
    render(<ExtraRucSlotsCard onRepay={jest.fn()} />);

    expect(screen.getByText("Se renueva cada mes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dar de baja" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Volver a pagar" })).not.toBeInTheDocument();
  });

  it("un cupo dado de baja muestra Volver a pagar", () => {
    givenPurchases([purchase({ activeUntil: "2999-12-31", renewing: false })]);
    render(<ExtraRucSlotsCard onRepay={jest.fn()} />);

    expect(screen.getByText("Dado de baja")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver a pagar" })).toBeInTheDocument();
  });
});
