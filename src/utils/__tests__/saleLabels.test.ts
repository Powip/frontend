import { channelLabel, deliveryLabel, saleOriginLabel, saleSourceKey } from "../saleLabels";

// FEAT-33 A6/A7: cómo se lee una venta en Ventas, Finanzas, Atención y el detalle.
describe("deliveryLabel", () => {
  test.each([
    [{ deliveryType: "PUNTO_EXTERNO", courier: "SHALOM" }, "AGENCIA SHALOM"],
    [{ deliveryType: "PUNTO_EXTERNO", courier: "Shalom" }, "AGENCIA SHALOM"],
    [{ deliveryType: "PUNTO_EXTERNO", courier: "OLVA" }, "AGENCIA OLVA COURIER"],
    [{ deliveryType: "PUNTO_EXTERNO", courier: "Olva Courier" }, "AGENCIA OLVA COURIER"],
    [{ deliveryType: "PUNTO_EXTERNO", courier: "marvisur" }, "AGENCIA MARVISUR"],
    [{ deliveryType: "PUNTO_EXTERNO", courier: null }, "PUNTO EXTERNO"],
    [{ deliveryType: "DOMICILIO", courier: "MOTORIZADO" }, "DOMICILIO"],
    [{ deliveryType: "RETIRO_TIENDA", courier: null }, "RETIRO TIENDA"],
    [{ deliveryType: null, courier: null }, "—"],
  ])("%j → %s", (order, label) => {
    expect(deliveryLabel(order)).toBe(label);
  });
});

describe("origin of a sale", () => {
  test.each([
    [{ externalSource: "POWIP_LIVE", closingChannel: "POWIP_LIVE" }, "POWIP_LIVE", "POWIP Live"],
    [{ externalSource: "POWIP_LIVE", closingChannel: "POWIP_LINK" }, "POWIP_LINK", "POWIP Link"],
    [{ externalSource: "SHOPIFY", closingChannel: "WEB" }, "SHOPIFY", null],
    [{ externalSource: null, closingChannel: "WHATSAPP" }, null, null],
  ])("%j", (order, key, label) => {
    expect(saleSourceKey(order)).toBe(key);
    expect(saleOriginLabel(order)).toBe(label);
  });
});

describe("channelLabel", () => {
  test.each([
    ["TIKTOK_LIVE", "TIKTOK LIVE"],
    ["POWIP_LINK", "POWIP LINK"],
    ["whatsapp", "WHATSAPP"],
    [null, "—"],
    ["", "—"],
  ])("%p → %s", (value, label) => {
    expect(channelLabel(value)).toBe(label);
  });
});
