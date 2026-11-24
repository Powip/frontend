/**
 * FEAT-32 M6a — precios de la venta nueva con el motor de promociones: elegibilidad, precio de lista y de promo,
 * descuento manual sobre la promo, totales, SKU y «Agregar pack».
 */
import type { CartItem } from "@/interfaces/IOrder";
import type { PackSuggestion, SaleEngineLine } from "@/services/promotionsService";
import type { PackView } from "@/services/packsService";
import {
  addSuggestedPackLine,
  applyEngineResult,
  buildEngineRequest,
  isEngineEligible,
  linesWithoutSku,
  priceEngineLine,
  promoBadgeLabel,
  saleDiscountBreakdown,
} from "../saleEnginePricing";

const line = (id: string, variantId: string, patch: Partial<CartItem> = {}): CartItem => ({
  id, inventoryItemId: `inv-${variantId}`, variantId, productName: `Producto ${variantId}`, sku: `SKU-${variantId}`,
  quantity: 1, price: 89, pvp: 89, discount: 0, packId: null, priceSource: "catalog", ...patch,
});

const engineLine = (index: number, variantId: string, patch: Partial<SaleEngineLine> = {}): SaleEngineLine => ({
  index, variantId, quantity: 1, listPrice: 89, unitPrice: 89, lineTotal: 89, promoId: null, promoIds: [], labels: [], isGift: false, ...patch,
});

describe("elegibilidad y cuerpo del motor", () => {
  it("el motor no toca precio manual, bundle anterior ni regalo", () => {
    expect(isEngineEligible(line("a", "v1"))).toBe(true);
    expect(isEngineEligible(line("b", "v2", { priceSource: "manual" }))).toBe(false);
    expect(isEngineEligible(line("c", "v3", { discMode: "man", discValue: 50 }))).toBe(false);
    expect(isEngineEligible(line("d", "v4", { packId: "bundle-1" }))).toBe(false);
    expect(isEngineEligible(line("e", "v5", { isGift: true }))).toBe(false);
    expect(isEngineEligible(line("f", "v6", { discMode: "pct", discValue: 10 }))).toBe(true);
  });

  it("manda todas las líneas vendidas con su precio sugerido, el canal y el almacén", () => {
    const request = buildEngineRequest(
      [line("a", "v1", { quantity: 2 }), line("b", "v2", { price: 80, discMode: "pct", discValue: 10 }), line("g", "v3", { isGift: true })],
      { storeId: "s1", channel: "WHATSAPP", inventoryId: "w1" },
    );
    expect(request).toEqual({
      storeId: "s1",
      channel: "WHATSAPP",
      inventoryId: "w1",
      lines: [
        { id: "a", productVariantId: "v1", quantity: 2, unitPrice: 89, discountAmount: 0 },
        { id: "b", productVariantId: "v2", quantity: 1, unitPrice: 89, discountAmount: 9 },
      ],
    });
    expect(buildEngineRequest([line("a", "v1")], { storeId: null })).toBeNull();
    expect(buildEngineRequest([], { storeId: "s1" })).toBeNull();
  });
});

describe("precio de una línea con motor", () => {
  it("lista tachada, precio de promo y descuento de promos de la línea", () => {
    const priced = priceEngineLine(line("a", "v1", { quantity: 2 }), { listPrice: 89, promoTotal: 142.4, promoId: "p1", labels: ["Cyber Wow"] });
    expect(priced).toMatchObject({ pvp: 89, listPrice: 89, promoUnitPrice: 71.2, price: 71.2, lineTotal: 142.4, promoId: "p1", promoDiscountAmount: 35.6 });
  });

  it("el descuento manual en % y en S/ se aplica sobre el precio de promo", () => {
    const pct = priceEngineLine(line("a", "v1", { discMode: "pct", discValue: 10 }), { listPrice: 100, promoTotal: 80, promoId: "p1", labels: [] });
    expect(pct).toMatchObject({ promoUnitPrice: 80, lineTotal: 72, price: 72, promoDiscountAmount: 20 });
    const amt = priceEngineLine(line("b", "v2", { quantity: 3, discMode: "amt", discValue: 5 }), { listPrice: 100, promoTotal: 210, promoId: "p2", labels: [] });
    expect(amt).toMatchObject({ lineTotal: 195, promoDiscountAmount: 90 });
  });

  it("aplica el resultado solo a las líneas elegibles", () => {
    const cart = [
      line("a", "v1"),
      line("b", "v2", { price: 50, discMode: "man", discValue: 50, priceSource: "manual" }),
      line("c", "v3", { price: 60, packId: "bundle-1" }),
    ];
    const request = buildEngineRequest(cart, { storeId: "s1" })!;
    const result = [
      engineLine(0, "v1", { unitPrice: 70, lineTotal: 70, promoId: "vol", labels: ["Volumen: 3 por S/ 210"] }),
      engineLine(1, "v2", { unitPrice: 70, lineTotal: 70, promoId: "vol" }),
      engineLine(2, "v3", { unitPrice: 70, lineTotal: 70, promoId: "vol" }),
    ];
    const [eligible, manual, bundle] = applyEngineResult(cart, request, result);
    expect(eligible).toMatchObject({ price: 70, listPrice: 89, promoId: "vol", promoLabels: ["Volumen: 3 por S/ 210"], lineTotal: 70 });
    expect(manual).toBe(cart[1]);
    expect(bundle).toBe(cart[2]);
  });

  it("mientras llega la respuesta nueva usa el precio por unidad de la anterior; otra variante queda como está", () => {
    const request = buildEngineRequest([line("a", "v1"), line("b", "v2")], { storeId: "s1" })!;
    const result = [engineLine(0, "v1", { unitPrice: 71.2, lineTotal: 71.2, promoId: "p1" }), engineLine(1, "v2", { unitPrice: 50, lineTotal: 50 })];
    const now = [line("a", "v1", { quantity: 3 }), line("b", "v9"), line("c", "v3")];
    const [moreUnits, otherVariant, added] = applyEngineResult(now, request, result);
    expect(moreUnits).toMatchObject({ lineTotal: 213.6, price: 71.2, promoId: "p1" });
    expect(otherVariant).toBe(now[1]);
    expect(added).toBe(now[2]);
  });
});

describe("totales con motor", () => {
  it("Subtotal a precio de lista, descuentos por promociones y descuento manual aparte", () => {
    const promo = priceEngineLine(line("a", "v1", { discMode: "pct", discValue: 10 }), { listPrice: 100, promoTotal: 80, promoId: "p1", labels: [] });
    const manual = line("b", "v2", { pvp: 50, price: 40, discMode: "man", discValue: 40, priceSource: "manual" });
    const bundle = line("c", "v3", { pvp: 30, price: 25, packId: "bundle-1" });
    expect(saleDiscountBreakdown([promo, manual, bundle])).toEqual({
      listSubtotal: 180,
      promoDiscount: 25,
      manualDiscount: 18,
      subtotal: 137,
    });
  });
});

describe("SKU y badges", () => {
  it("detecta las líneas sin SKU (los regalos no cuentan)", () => {
    const cart = [line("a", "v1"), line("b", "v2", { sku: "  " }), line("g", "v3", { sku: "", isGift: true })];
    expect(linesWithoutSku(cart).map((item) => item.id)).toEqual(["b"]);
  });

  it("a una campaña sola le suma el %; el volumen va con su nombre", () => {
    expect(promoBadgeLabel("Cyber Wow", { promoLabels: ["Cyber Wow"], listPrice: 89, promoUnitPrice: 71.2 })).toBe("Cyber Wow −20%");
    expect(promoBadgeLabel("Volumen: 3 por S/ 210", { promoLabels: ["Volumen: 3 por S/ 210"], listPrice: 89, promoUnitPrice: 70 })).toBe("Volumen: 3 por S/ 210");
    expect(promoBadgeLabel("Cyber Wow", { promoLabels: ["Cyber Wow", "Volumen: x"], listPrice: 89, promoUnitPrice: 60 })).toBe("Cyber Wow");
  });
});

describe("«Agregar pack» desde una sugerencia", () => {
  const suggestion: PackSuggestion = {
    kind: "PACK", packVariantId: "pk1", name: "Pantalón Jimena + Blusa Sofía", packPrice: 199, looseTotal: 238,
    sku: "PK1", components: [{ variantId: "jim-m", quantity: 1 }, { variantId: "sof-m", quantity: 1 }],
    text: "Pantalón Jimena + Blusa Sofía a S/ 199.00 (suelto S/ 238.00).",
  };

  it("agrega la línea del pack con su variante, SKU, precio y contenido", () => {
    const [added] = addSuggestedPackLine([], suggestion, null, () => "new");
    expect(added).toMatchObject({
      id: "new", variantId: "pk1", inventoryItemId: "pk1", productName: "Pantalón Jimena + Blusa Sofía", sku: "PK1",
      price: 199, pvp: 199, quantity: 1, priceSource: "catalog", trackingMode: "NONE",
      packComponents: [{ variantId: "jim-m", quantity: 1 }, { variantId: "sof-m", quantity: 1 }],
    });
  });

  it("con el pack de ms-products el contenido lleva nombre y SKU; si ya está, suma uno", () => {
    const pack = {
      variantId: "pk1", imageUrl: "pk.png",
      components: [{ variantId: "jim-m", quantity: 1, productName: "Pantalón Jimena", sku: "JIM-M-CEL" }],
    } as unknown as PackView;
    const [added] = addSuggestedPackLine([], suggestion, pack, () => "new");
    expect(added.packComponents).toEqual([{ variantId: "jim-m", quantity: 1, productName: "Pantalón Jimena", sku: "JIM-M-CEL" }]);
    expect(added.imageUrl).toBe("pk.png");
    expect(addSuggestedPackLine([added], suggestion)[0].quantity).toBe(2);
  });
});
