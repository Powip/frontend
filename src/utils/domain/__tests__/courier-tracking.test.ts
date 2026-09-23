import type { OrderHeader } from "@/interfaces/IOrder";
import { isOrderTrackable } from "../courier-tracking";

function makeOrder(overrides: Partial<OrderHeader> = {}): OrderHeader {
  return {
    id: "order-1",
    status: "ENTREGADO",
    deliveryType: "DOMICILIO",
    courier: null,
    guideNumber: null,
    externalTrackingNumber: null,
    evaStatus: null,
    aliclikDispatchStatus: null,
    shalomStatus: null,
    ...overrides,
  } as unknown as OrderHeader;
}

describe("isOrderTrackable — ENTREGADO manual sin guía/tracking", () => {
  it("incluye ENTREGADO + DOMICILIO sin guía ni tracking", () => {
    expect(isOrderTrackable(makeOrder())).toBe(true);
  });

  it("incluye ENTREGADO + DOMICILIO con courier", () => {
    expect(isOrderTrackable(makeOrder({ courier: "Olva Courier" }))).toBe(true);
  });

  it("incluye ENTREGADO + DOMICILIO sin courier", () => {
    expect(isOrderTrackable(makeOrder({ courier: null }))).toBe(true);
  });

  it("excluye ENTREGADO + RETIRO_TIENDA sin guía", () => {
    expect(isOrderTrackable(makeOrder({ deliveryType: "RETIRO_TIENDA" }))).toBe(false);
  });

  it("excluye ENTREGADO + PUNTO_EXTERNO sin guía", () => {
    expect(isOrderTrackable(makeOrder({ deliveryType: "PUNTO_EXTERNO" }))).toBe(false);
  });

  it("incluye ENTREGADO + RETIRO_TIENDA si tiene guía", () => {
    expect(
      isOrderTrackable(makeOrder({ deliveryType: "RETIRO_TIENDA", guideNumber: "G-001" })),
    ).toBe(true);
  });
});

describe("isOrderTrackable — señales de despacho", () => {
  it.each([
    ["guideNumber", { guideNumber: "G-001" }],
    ["externalTrackingNumber", { externalTrackingNumber: "TRK-123" }],
    ["shalomStatus", { shalomStatus: "ENTREGADO" }],
    ["evaStatus", { evaStatus: "DELIVERED" }],
    ["aliclikDispatchStatus", { aliclikDispatchStatus: "DELIVERED" }],
  ] as const)("incluye ENTREGADO con %s", (_field, overrides) => {
    expect(
      isOrderTrackable(makeOrder({ deliveryType: "RETIRO_TIENDA", ...overrides })),
    ).toBe(true);
  });

  it("incluye EN_ENVIO con guideNumber", () => {
    expect(isOrderTrackable(makeOrder({ status: "EN_ENVIO", guideNumber: "G-001" }))).toBe(true);
  });

  it("incluye PAGADO con externalTrackingNumber", () => {
    expect(
      isOrderTrackable(makeOrder({ status: "PAGADO", externalTrackingNumber: "TRK-123" })),
    ).toBe(true);
  });
});

describe("isOrderTrackable — exclusiones", () => {
  it("excluye ANULADO con guideNumber", () => {
    expect(isOrderTrackable(makeOrder({ status: "ANULADO", guideNumber: "G-001" }))).toBe(false);
  });

  it("excluye ANULADO sin guía", () => {
    expect(isOrderTrackable(makeOrder({ status: "ANULADO" }))).toBe(false);
  });

  it("excluye EN_ENVIO + DOMICILIO + courier sin guía ni tracking", () => {
    expect(
      isOrderTrackable(makeOrder({ status: "EN_ENVIO", courier: "Olva Courier" })),
    ).toBe(false);
  });

  it.each(["PREPARADO", "LLAMADO", "ASIGNADO_A_GUIA", "PAGADO", "PREVENTA", "PENDIENTE", "INCOMPLETE"] as const)(
    "excluye %s + DOMICILIO sin guía ni tracking",
    (status) => {
      expect(isOrderTrackable(makeOrder({ status }))).toBe(false);
    },
  );
});
