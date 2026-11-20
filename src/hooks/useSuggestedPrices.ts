import { useEffect, useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { CartItem } from "@/interfaces/IOrder";
import { resolvePrices, type ResolvedPrice } from "@/services/promotionsService";

/**
 * Línea con precio sugerido: se agregó con el precio del catálogo o de la lista, sin descuento ni precio
 * escrito a mano, y no es de un pack ni un regalo. Las líneas de un pedido cargado no tienen
 * `priceSource` y nunca se tocan.
 */
export function hasSuggestedPrice(line: CartItem): boolean {
  return (line.priceSource === "catalog" || line.priceSource === "list") && !line.discMode && !line.packId && !line.isGift;
}

/** Aplica los precios de la lista a las líneas con precio sugerido; devuelve el mismo carrito si nada cambia. */
export function applySuggestedPrices(cart: CartItem[], prices: readonly ResolvedPrice[]): CartItem[] {
  if (!prices.length) return cart;
  const byVariant = new Map(prices.map((row) => [row.variantId, row]));
  let changed = false;
  const next = cart.map((line) => {
    const resolved = hasSuggestedPrice(line) ? byVariant.get(line.variantId) : undefined;
    if (!resolved) return line;
    const price = Math.round(resolved.price * 100) / 100;
    if (line.price === price && line.pvp === price && line.priceSource === "list") return line;
    changed = true;
    return { ...line, price, pvp: price, priceSource: "list" as const };
  });
  return changed ? next : cart;
}

/**
 * FEAT-24 H9 (H9-D6) — precio sugerido en la venta manual: pide a `/ventas/prices/resolve` el precio de
 * la lista de la tienda y el canal del pedido y lo pone en las líneas con precio sugerido. Lo que el
 * usuario escribió (precio manual, descuento) se respeta. Si el servicio falla, queda el precio del
 * catálogo.
 */
export function useSuggestedPrices({
  cart,
  setCart,
  storeId,
  channel,
}: {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  storeId: string | null | undefined;
  channel: string | null | undefined;
}) {
  const variantIds = useMemo(
    () => [...new Set(cart.filter(hasSuggestedPrice).map((line) => line.variantId))].sort(),
    [cart],
  );
  const query = useQuery({
    queryKey: ["sale-suggested-prices", storeId ?? null, channel ?? null, variantIds],
    queryFn: ({ signal }) => resolvePrices({ storeId: storeId ?? undefined, channel: channel ?? undefined, variantIds }, signal),
    enabled: !!storeId && variantIds.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
  });
  const prices = query.data;
  const resolvedFor = query.isPlaceholderData ? null : prices;
  // Depende también del carrito: una línea nueva de una variante ya resuelta toma el precio sin otra
  // consulta. `applySuggestedPrices` devuelve el mismo carrito si no hay cambios (no re-renderiza).
  useEffect(() => {
    if (!resolvedFor?.length) return;
    setCart((current) => applySuggestedPrices(current, resolvedFor));
  }, [resolvedFor, cart, setCart]);
  return { loading: query.isFetching };
}
