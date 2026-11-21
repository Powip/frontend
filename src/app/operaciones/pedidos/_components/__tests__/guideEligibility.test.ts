/**
 * Tests: guideEligibility — la regla de elegibilidad para armar guía no
 * cambia (sin guía + DOMICILIO + PREPARADO/LLAMADO/ASIGNADO_A_GUIA); solo se
 * agrega el motivo de bloqueo, sin atribuir a "retiro en tienda" lo que no lo es.
 */

import type { OrderStatus } from "@/interfaces/IOrder";
import type { Sale } from "../types";
import {
  getGuideBlockReason,
  guideBlockReasonLabel,
  splitGuideEligibility,
} from "../guideEligibility";

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: "s-1",
    orderNumber: "ORD-1",
    status: "PREPARADO" as OrderStatus,
    deliveryType: "DOMICILIO",
    guideNumber: null,
    ...overrides,
  } as Sale;
}

describe("getGuideBlockReason", () => {
  it.each(["PREPARADO", "LLAMADO", "ASIGNADO_A_GUIA"] as OrderStatus[])(
    "%s a domicilio y sin guía es elegible",
    (status) => {
      expect(getGuideBlockReason(sale({ status }))).toBeNull();
    },
  );

  it("acepta DOMICILIO sin distinguir mayúsculas, igual que antes", () => {
    expect(getGuideBlockReason(sale({ deliveryType: "domicilio" }))).toBeNull();
  });

  it.each([
    [{ guideNumber: "G-1" }, "HAS_GUIDE"],
    [{ status: "PAGADO" as OrderStatus }, "STATUS_NOT_ALLOWED"],
    [{ deliveryType: "RETIRO TIENDA" }, "PICKUP_IN_STORE"],
    [{ deliveryType: "RETIRO_TIENDA" }, "PICKUP_IN_STORE"],
    [{ deliveryType: "" }, "MISSING_DELIVERY_TYPE"],
    [{ deliveryType: "PUNTO EXTERNO" }, "UNSUPPORTED_DELIVERY_TYPE"],
    [{ deliveryType: "PUNTO EXTERNO", courier: "" }, "UNSUPPORTED_DELIVERY_TYPE"],
  ])("%o → %s", (overrides, reason) => {
    expect(getGuideBlockReason(sale(overrides))).toBe(reason);
  });

  it.each([
    [{ courier: "Shalom" }],
    [{ courierId: "c-1" }],
    [{ courier: "Shalom", deliveryType: "PUNTO_EXTERNO" }],
  ])("PUNTO EXTERNO con courier (agencia) %o es elegible", (overrides) => {
    expect(
      getGuideBlockReason(sale({ deliveryType: "PUNTO EXTERNO", ...overrides })),
    ).toBeNull();
  });

  it("PUNTO EXTERNO con courier respeta guía y estado", () => {
    const base = { deliveryType: "PUNTO EXTERNO", courier: "Shalom" };
    expect(getGuideBlockReason(sale({ ...base, guideNumber: "G-1" }))).toBe("HAS_GUIDE");
    expect(
      getGuideBlockReason(sale({ ...base, status: "PAGADO" as OrderStatus })),
    ).toBe("STATUS_NOT_ALLOWED");
  });

  it("guía existente y estado prevalecen sobre el tipo de entrega", () => {
    expect(
      getGuideBlockReason(sale({ guideNumber: "G-1", deliveryType: "RETIRO TIENDA" })),
    ).toBe("HAS_GUIDE");
    expect(
      getGuideBlockReason(
        sale({ status: "PENDIENTE" as OrderStatus, deliveryType: "RETIRO TIENDA" }),
      ),
    ).toBe("STATUS_NOT_ALLOWED");
  });
});

describe("guideBlockReasonLabel", () => {
  it("nombra el tipo de entrega no compatible por su etiqueta", () => {
    const s = sale({ deliveryType: "PUNTO EXTERNO", courier: null });
    expect(guideBlockReasonLabel("UNSUPPORTED_DELIVERY_TYPE", s)).toBe(
      "Tipo de entrega «Recojo en tienda courier» no admite guía",
    );
  });
});

describe("splitGuideEligibility", () => {
  it("separa elegibles y bloqueados sin perder pedidos", () => {
    const ok = sale({ id: "ok" });
    const retiro = sale({ id: "r", deliveryType: "RETIRO TIENDA" });
    const { eligible, blocked } = splitGuideEligibility([ok, retiro]);
    expect(eligible.map((s) => s.id)).toEqual(["ok"]);
    expect(blocked).toEqual([{ sale: retiro, reason: "PICKUP_IN_STORE" }]);
  });
});
