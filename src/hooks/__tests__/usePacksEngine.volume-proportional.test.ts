import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { usePacksEngine, volumeNetPrices } from "../usePacksEngine";
import type { Pack, VolumePack } from "@/interfaces/IPack";
import type { CartItem } from "@/interfaces/IOrder";

// FEAT-33 D6 (ORD-157320): «3 chompas por S/ 199» con chompas de S/ 115 y S/ 89 ponía S/ 66.33 a cada una.
// La promo se reparte en proporción al precio normal, como ya hacía el pack de productos distintos.
const CHANNEL = "WHATSAPP";
const pack: VolumePack = {
  id: "chompas-3x199",
  type: "VOLUME",
  name: "3 chompas por S/ 199",
  active: true,
  channels: [CHANNEL],
  product: { productKey: "Chompa", productName: "Chompa", price: 115 },
  variantFree: false,
  minQty: 3,
  packPrice: 199,
};
const line = (variantId: string, price: number, quantity = 1): CartItem => ({
  id: `line-${variantId}`,
  inventoryItemId: `inventory-${variantId}`,
  variantId,
  sku: `SKU-${variantId}`,
  productName: "Chompa",
  quantity,
  price,
  pvp: price,
  discount: 0,
});

describe("volumeNetPrices", () => {
  test("different prices share the promo in proportion and add up to the promo price", () => {
    const nets = volumeNetPrices(pack, [
      { pvp: 115, quantity: 1 },
      { pvp: 89, quantity: 2 },
    ]);
    expect(nets[0]).toBeCloseTo(78.11, 2);
    expect(nets[1]).toBeCloseTo(60.45, 2);
    expect(nets[0] + nets[1] * 2).toBeCloseTo(199, 6);
    expect(nets[0]).toBeLessThan(115);
    expect(nets[1]).toBeLessThan(89);
  });

  test("equal prices keep the price per unit of the promo", () => {
    const nets = volumeNetPrices(pack, [
      { pvp: 89, quantity: 2 },
      { pvp: 89, quantity: 1 },
    ]);
    nets.forEach((net) => expect(net).toBeCloseTo(199 / 3, 6));
  });

  test("more units than the promo keep charging the promo price per unit", () => {
    const nets = volumeNetPrices(pack, [{ pvp: 89, quantity: 4 }]);
    expect(nets[0] * 4).toBeCloseTo((199 / 3) * 4, 6);
  });
});

test("applying the promo to a cart with different prices never gives a cheaper chompa a higher price", () => {
  const cart = [line("chompa-azul", 115), line("chompa-gris", 89, 2)];
  const { result } = renderHook(() => {
    const [current, setCart] = useState(cart);
    const engine = usePacksEngine({
      packs: [pack] as Pack[],
      channel: CHANNEL,
      cart: current,
      setCart,
      getVariantsForProduct: jest.fn().mockResolvedValue([]),
    });
    return { ...engine, cart: current };
  });
  act(() => {
    result.current.applyPack(pack);
  });
  const [blue, grey] = result.current.cart;
  expect(blue).toMatchObject({ pvp: 115, packId: pack.id });
  expect(grey).toMatchObject({ pvp: 89, packId: pack.id });
  expect(blue.price).toBeCloseTo(78.11, 2);
  expect(grey.price).toBeCloseTo(60.45, 2);
});
