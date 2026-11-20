import { isCourierDelivery } from "../courier-delivery";

describe("isCourierDelivery", () => {
  it("DOMICILIO siempre es de courier, con o sin courier", () => {
    expect(isCourierDelivery({ deliveryType: "DOMICILIO" })).toBe(true);
    expect(isCourierDelivery({ deliveryType: "domicilio", courier: null })).toBe(true);
  });

  it.each([
    [{ courier: "Shalom" }],
    [{ courierId: "c-1" }],
    [{ courier: "Shalom", courierId: "c-1" }],
  ])("PUNTO_EXTERNO con courier %o es de courier", (fields) => {
    expect(isCourierDelivery({ deliveryType: "PUNTO_EXTERNO", ...fields })).toBe(true);
  });

  it("acepta la etiqueta con espacio que deja mapOrderToSale", () => {
    expect(isCourierDelivery({ deliveryType: "PUNTO EXTERNO", courier: "Shalom" })).toBe(true);
  });

  it.each([
    [{ deliveryType: "PUNTO_EXTERNO" }],
    [{ deliveryType: "PUNTO_EXTERNO", courier: "" }],
    [{ deliveryType: "PUNTO_EXTERNO", courier: null, courierId: null }],
    [{ deliveryType: "RETIRO_TIENDA", courier: "Shalom" }],
    [{ deliveryType: "RETIRO TIENDA", courierId: "c-1" }],
    [{ deliveryType: "", courier: "Shalom" }],
    [{ deliveryType: null, courier: "Shalom" }],
    [{}],
  ])("%o no es de courier", (order) => {
    expect(isCourierDelivery(order)).toBe(false);
  });
});
