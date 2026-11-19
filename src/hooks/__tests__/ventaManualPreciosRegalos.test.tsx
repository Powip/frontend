/**
 * FEAT-24 H9 — venta manual: precio sugerido por la lista de la tienda y el canal (respeta lo que escribió
 * el usuario) y regalos que suma el backend al guardar (`/promos/evaluate`), y el contenido de las líneas
 * de pack en el editor.
 */
import type { ComponentProps, Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import CartLines from "@/components/registrar-venta/CartLines";
import PromoGiftsPanel from "@/components/registrar-venta/PromoGiftsPanel";
import { packComponentsForReceiptItem } from "@/components/packs/PackLineContents";
import { applySuggestedPrices, useSuggestedPrices } from "@/hooks/useSuggestedPrices";
import { cartToEvaluateItems, usePromoGifts } from "@/hooks/usePromoGifts";
import { evaluatePromotions, resolvePrices } from "@/services/promotionsService";
import type { CartItem } from "@/interfaces/IOrder";

jest.mock("@/services/promotionsService", () => ({ resolvePrices: jest.fn(), evaluatePromotions: jest.fn() }));
jest.mock("@/components/registrar-venta/Thumb", () => ({ __esModule: true, default: () => null }));

const line = (id: string, variantId: string, patch: Partial<CartItem> = {}): CartItem => ({
  id, inventoryItemId: `inv-${variantId}`, variantId, productName: `Producto ${variantId}`, sku: `SKU-${variantId}`,
  quantity: 1, price: 59.9, pvp: 59.9, discount: 0, packId: null, priceSource: "catalog", ...patch,
});

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function useCartWithPrices(initial: CartItem[], storeId: string, channel: string) {
  const [cart, setCart] = useState(initial);
  useSuggestedPrices({ cart, setCart: setCart as Dispatch<SetStateAction<CartItem[]>>, storeId, channel });
  return cart;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("precio sugerido (H9-D6)", () => {
  it("pone el precio de la lista de la tienda y el canal en las líneas con precio del catálogo", async () => {
    jest.mocked(resolvePrices).mockResolvedValue([
      { variantId: "v1", price: 49.9, compareAtPrice: 69.9, listId: "l-wsp" },
      { variantId: "v2", price: 30, compareAtPrice: null, listId: "l-wsp" },
    ]);
    const { result } = renderHook(
      () => useCartWithPrices([
        line("a", "v1"),
        line("b", "v2", { price: 25, discMode: "man", discValue: 25, priceSource: "manual" }),
        line("c", "v3", { priceSource: undefined, price: 80, pvp: 80 }),
      ], "s1", "WHATSAPP"),
      { wrapper },
    );
    await waitFor(() => expect(result.current[0]).toMatchObject({ price: 49.9, pvp: 49.9, priceSource: "list" }));
    expect(resolvePrices).toHaveBeenCalledWith({ storeId: "s1", channel: "WHATSAPP", variantIds: ["v1"] }, expect.anything());
    // El precio escrito a mano y la línea de un pedido cargado no se tocan.
    expect(result.current[1]).toMatchObject({ price: 25, priceSource: "manual" });
    expect(result.current[2]).toMatchObject({ price: 80 });
  });

  it("respeta descuentos, packs y regalos; sin respuesta del servicio queda el precio del catálogo", () => {
    const cart = [
      line("a", "v1", { discMode: "pct", discValue: 10, price: 53.91 }),
      line("b", "v1", { packId: "promo-1", price: 45 }),
      line("c", "v1", { isGift: true, price: 0 }),
    ];
    expect(applySuggestedPrices(cart, [{ variantId: "v1", price: 49.9, compareAtPrice: null, listId: "l" }])).toBe(cart);
    expect(applySuggestedPrices([line("d", "v1")], [])[0].price).toBe(59.9);
  });
});

describe("regalos de promociones (H9-D5)", () => {
  it("evalúa el carrito con la tienda y el canal y muestra los regalos que se suman al guardar", async () => {
    jest.mocked(evaluatePromotions).mockResolvedValue({
      gifts: [{ promoId: "pr-1", name: "Gorra de regalo", variantId: "v-gorra", quantity: 1, sku: "GOR", productName: "Gorra", giftValue: 39.9 }],
    });
    const cart = [line("a", "v1", { quantity: 2, price: 50, pvp: 59.9 }), line("g", "v-old", { isGift: true, price: 0 })];
    const { result } = renderHook(() => usePromoGifts({ cart, storeId: "s1", channel: "INSTAGRAM", enabled: true }), { wrapper });
    await waitFor(() => expect(result.current.gifts).toHaveLength(1), { timeout: 2000 });
    expect(evaluatePromotions).toHaveBeenCalledWith(
      { storeId: "s1", channel: "INSTAGRAM", items: [{ productVariantId: "v1", quantity: 2, unitPrice: 59.9, discountAmount: 19.8 }] },
      expect.anything(),
    );
    render(<PromoGiftsPanel gifts={result.current.gifts} />);
    expect(screen.getByRole("region", { name: "Regalos de promociones" })).toHaveTextContent("Regalos que se suman al guardar1 × GorraGORGorra de regalo · S/ 0.00");
  });

  it("al editar un pedido no evalúa (el backend solo suma regalos al crear) y los regalos del carrito no cuentan", async () => {
    const { result } = renderHook(() => usePromoGifts({ cart: [line("a", "v1")], storeId: "s1", channel: "WHATSAPP", enabled: false }), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(evaluatePromotions).not.toHaveBeenCalled();
    expect(result.current.gifts).toEqual([]);
    expect(cartToEvaluateItems([line("g", "v2", { isGift: true })])).toEqual([]);
  });
});

describe("líneas de pack (H9-D2)", () => {
  const components = [
    { variantId: "v-polo", quantity: 2, sku: "POL-M", productName: "Polo M" },
    { variantId: "v-gorra", quantity: 1, sku: "GOR", productName: "Gorra" },
  ];

  it("el editor muestra «Pack» y su contenido multiplicado por las unidades de la línea", () => {
    const noop = jest.fn();
    const props: ComponentProps<typeof CartLines> = {
      cart: [line("p", "v-kit", { productName: "Kit verano", quantity: 2, packComponents: components, priceSource: undefined })],
      packs: [], appliedPacks: {}, isAdmin: false,
      onQtyChange: noop, onRemove: noop, onSetPrice: noop, onApplyDiscount: noop,
      onClearDiscount: noop, onBulkPrice: noop, onBulkDiscount: noop,
      onRestorePvp: noop, onUndoPack: noop, pvsOpen: null, pvsLoading: false,
      pvsTotal: 0, onPvsChg: noop, onPvsConfirm: noop, onPvsCancel: noop,
      giftOpen: null, onChooseGift: noop, onChangeGift: noop, onGiftCancel: noop,
    };
    render(<CartLines {...props} />);
    const contents = screen.getByTestId("pack-line-contents");
    expect(screen.getByText("Kit verano")).toBeInTheDocument();
    expect(contents).toHaveTextContent("Pack × 2 · contiene:");
    expect(contents).toHaveTextContent("4 × Polo M (POL-M)");
    expect(contents).toHaveTextContent("2 × Gorra (GOR)");
  });

  it("el detalle toma el contenido de la línea del pedido que coincide (el comprobante no lo trae)", () => {
    const orderItems = [
      { sku: "POL-M", productName: "Polo M", quantity: 1, packComponents: null },
      { sku: "KIT-1", productName: "Kit verano", quantity: 1, packComponents: components },
    ];
    expect(packComponentsForReceiptItem({ sku: "KIT-1", productName: "Kit verano" }, 1, orderItems)).toBe(components);
    expect(packComponentsForReceiptItem({ sku: "KIT-1", productName: "Kit verano" }, 0, orderItems)).toBe(components);
    expect(packComponentsForReceiptItem({ sku: "POL-M", productName: "Polo M" }, 0, orderItems)).toBeNull();
    expect(packComponentsForReceiptItem({ sku: "KIT-1", productName: "Kit verano" }, 0, undefined)).toBeNull();
  });
});
