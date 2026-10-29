import type { LiveProduct } from "./types";

export type LiveProductGroup = { id: string; name: string; variants: LiveProduct[] };
export type LiveCartItem = { variantId: string; quantity: number };

/** A missing parent identity must never combine unrelated products by their name. */
export function groupLiveProducts(products: LiveProduct[]): LiveProductGroup[] {
  const groups = new Map<string, LiveProductGroup>();
  for (const product of products) {
    const id = product.productId || product.variantId;
    let group = groups.get(id);
    if (!group) {
      group = { id, name: product.name, variants: [] };
      groups.set(id, group);
    }
    group.variants.push(product);
  }
  return [...groups.values()];
}

export function removePurchasedItems(cart: LiveCartItem[], purchased: LiveCartItem[]) {
  const quantities = new Map(purchased.map((item) => [item.variantId, item.quantity]));
  return cart.flatMap((item) => {
    const quantity = item.quantity - (quantities.get(item.variantId) ?? 0);
    return quantity > 0 ? [{ ...item, quantity }] : [];
  });
}
