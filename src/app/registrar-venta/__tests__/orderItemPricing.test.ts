import type { CartItem } from "@/interfaces/IOrder";
import { buildOrderItem, getOrderItemPricing, loadedPromoTrace } from "../orderItemPricing";

function line(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "line-1",
    inventoryItemId: "inventory-1",
    variantId: "variant-1",
    productName: "Pulsera",
    sku: "PULSERA",
    quantity: 1,
    price: 45,
    pvp: 45,
    discount: 0,
    ...overrides,
  };
}

describe("precios de líneas enviados al guardar una venta", () => {
  it("conserva el precio manual de 50 aunque el PVP anterior sea 45", () => {
    expect(buildOrderItem(line({ price: 50, discMode: "man", discValue: 50 }))).toMatchObject({
      unitPrice: 50,
      discountType: "NONE",
      discountAmount: 0,
    });
  });

  it.each([
    { pvp: 45, price: 40, quantity: 1, unitPrice: 45, discountAmount: 5 },
    { pvp: 45, price: 0, quantity: 2, unitPrice: 45, discountAmount: 90 },
    { pvp: 45, price: 50, quantity: 3, unitPrice: 50, discountAmount: 0 },
    { pvp: undefined, price: 50, quantity: 2, unitPrice: 50, discountAmount: 0 },
    { pvp: 10, price: 8.87, quantity: 3, unitPrice: 10, discountAmount: 3.39 },
  ])("el importe guardado coincide con el precio de cierre: %o", (example) => {
    const item = line(example);
    const pricing = getOrderItemPricing(item);

    expect(pricing.unitPrice).toBe(example.unitPrice);
    expect(pricing.discountAmount).toBe(example.discountAmount);
    expect(pricing.unitPrice * item.quantity - pricing.discountAmount).toBeCloseTo(
      item.price * item.quantity,
      2,
    );
  });

  it("guarda 149 y saldo 119 en la venta del video con descuentos y precio manual", () => {
    const cart = [
      line({ productName: "Caja", pvp: 99, price: 87.2 }),
      line({ productName: "Grabado", pvp: 20, price: 11.8 }),
      line({ productName: "Pulsera", pvp: 45, price: 50 }),
    ];
    const saved = cart.map(buildOrderItem);
    const gross = saved.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const discounts = saved.reduce((sum, item) => sum + item.discountAmount, 0);

    expect(gross).toBe(169);
    expect(discounts).toBe(20);
    expect(gross - discounts).toBe(149);
    expect(gross - discounts - 30).toBe(119);
  });

  it("conserva los datos de la variante y del regalo al serializar la línea", () => {
    expect(
      buildOrderItem(
        line({
          price: 0,
          packId: "gift-pack",
          isGift: true,
          giftValue: 45,
          attributes: { color: "Dorado" },
        }),
      ),
    ).toMatchObject({
      productVariantId: "variant-1",
      sku: "PULSERA",
      productName: "Pulsera",
      quantity: 1,
      unitPrice: 45,
      discountType: "FIXED",
      discountAmount: 45,
      attributes: { color: "Dorado" },
      packId: "gift-pack",
      isGift: true,
      giftValue: 45,
    });
  });
});

describe("FEAT-32 M6a — origen del precio de la línea", () => {
  it("con motor: bruto = precio de lista, descuento = promos + manual, y manda listPrice, promoId y promoDiscountAmount", () => {
    const item = buildOrderItem(line({
      quantity: 3, pvp: 89, price: 63, listPrice: 89, lineTotal: 189, promoId: "promo-vol", promoDiscountAmount: 57,
    }));
    expect(item).toMatchObject({
      unitPrice: 89, discountType: "FIXED", discountAmount: 78,
      listPrice: 89, promoId: "promo-vol", promoDiscountAmount: 57,
    });
    expect(item.unitPrice * item.quantity - item.discountAmount).toBe(189);
  });

  it("con motor sin promo: precio de lista, sin descuento y promoId null", () => {
    expect(buildOrderItem(line({ listPrice: 45, lineTotal: 45, promoId: null, promoDiscountAmount: 0 }))).toMatchObject({
      unitPrice: 45, discountType: "NONE", discountAmount: 0, listPrice: 45, promoId: null, promoDiscountAmount: 0,
    });
  });

  it("sin motor ni pedido cargado no manda nada nuevo", () => {
    const item = buildOrderItem(line());
    expect(item).not.toHaveProperty("listPrice");
    expect(item).not.toHaveProperty("promoId");
    expect(item).not.toHaveProperty("promoDiscountAmount");
  });

  it("al editar lee el origen del precio del pedido (decimales como texto) y lo devuelve si la línea no cambió", () => {
    const trace = loadedPromoTrace({ listPrice: "45.00", promoId: "promo-cyber", promoDiscountAmount: "9.00", quantity: 1 }, 36);
    expect(trace).toEqual({ listPrice: 45, promoId: "promo-cyber", promoDiscountAmount: 9, promoTraceFor: { quantity: 1, price: 36 } });
    expect(buildOrderItem(line({ price: 36, ...trace }))).toMatchObject({ listPrice: 45, promoId: "promo-cyber", promoDiscountAmount: 9 });
    expect(loadedPromoTrace({ listPrice: null, promoId: null, promoDiscountAmount: "0.00", quantity: 1 }, 45)).toEqual({});
  });

  it("al editar, si cambió la cantidad o el precio, queda solo el precio de lista", () => {
    const trace = loadedPromoTrace({ listPrice: 45, promoId: "promo-cyber", promoDiscountAmount: 9, quantity: 1 }, 36);
    for (const changed of [line({ price: 30, ...trace }), line({ price: 36, quantity: 2, ...trace })]) {
      const item = buildOrderItem(changed);
      expect(item).toMatchObject({ listPrice: 45 });
      expect(item).not.toHaveProperty("promoId");
      expect(item).not.toHaveProperty("promoDiscountAmount");
    }
  });
});
