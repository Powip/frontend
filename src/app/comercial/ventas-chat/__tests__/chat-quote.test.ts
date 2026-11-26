import {
  cartLineFromAi,
  paymentFromPolicy,
  quoteDraftError,
  quotePayload,
  resolveStoreId,
  type QuoteDraft,
} from "@/components/ventas-chat/chatQuote";
import type { StorePolicy } from "@/types/crmOrderPanel";

const line = { productVariantId: "v1", name: "Polo", variant: "M", sku: "", unitPrice: 50, quantity: 2, stock: 5 };
const draft = (over: Partial<QuoteDraft> = {}): QuoteDraft => ({
  name: "Ana",
  phone: "51999111222",
  storeId: "st1",
  inventoryId: "inv1",
  cart: [line],
  paymentType: "COMPLETO",
  deposit: "",
  client: null,
  ...over,
});
const policy = (over: Partial<StorePolicy>) =>
  ({ firstOffer: "dep", depositEnabled: true, depositAmount: 20, ...over }) as StorePolicy;

describe("chatQuote", () => {
  it.each<[string, Partial<QuoteDraft>, RegExp | null]>([
    ["completo", {}, null],
    ["sin nombre", { name: " " }, /nombre/],
    ["sin teléfono", { phone: null }, /teléfono/],
    ["sin tienda", { storeId: "" }, /tienda/],
    ["sin almacén", { inventoryId: "" }, /almacén/],
    ["sin productos", { cart: [] }, /al menos un producto/],
    ["cantidad cero", { cart: [{ ...line, quantity: 0 }] }, /cantidad entera/],
    ["más que el stock", { cart: [{ ...line, quantity: 6 }] }, /stock suficiente/],
    ["adelanto cero", { paymentType: "ADELANTO", deposit: "0" }, /mayor a cero/],
    ["adelanto mayor al total", { paymentType: "ADELANTO", deposit: "101" }, /mayor al total/],
  ])("borrador %s", (_name, over, expected) => {
    expect(quoteDraftError(draft(over)) ?? "").toMatch(expected ?? /^$/);
  });

  it("sin adelanto escrito sugiere el 30 % del total", () => {
    expect(quotePayload(draft({ paymentType: "ADELANTO" })).suggestedDeposit).toBe(30);
    expect(quotePayload(draft()).suggestedDeposit).toBeUndefined();
  });

  it("manda el teléfono oculto tal cual y el visible en 9 dígitos", () => {
    expect(quotePayload(draft({ phone: "+51 999 *** 222" })).customerPhone).toBe("+51 999 *** 222");
    expect(quotePayload(draft()).customerPhone).toBe("999111222");
  });

  it("la política decide el tipo de pago; sin adelanto activo cobra completo", () => {
    expect(paymentFromPolicy(policy({}))).toEqual({ paymentType: "ADELANTO", deposit: "20" });
    expect(paymentFromPolicy(policy({ depositEnabled: false })).paymentType).toBe("COMPLETO");
    expect(paymentFromPolicy(policy({ depositAmount: 0 })).paymentType).toBe("COMPLETO");
  });

  it("una línea leída sin stock conocido cuenta como 0", () => {
    const l = cartLineFromAi({ productVariantId: "v1", name: "Polo", quantity: 1, unitPrice: 10 } as never);
    expect(l.stock).toBe(0);
  });

  it("solo elige tiendas del usuario", () => {
    expect(resolveStoreId([{ id: "a" }, { id: "b" }], ["x", null, "b"])).toBe("b");
    expect(resolveStoreId([{ id: "a" }], ["x"])).toBe("a");
    expect(resolveStoreId([], ["x"])).toBe("");
  });
});
