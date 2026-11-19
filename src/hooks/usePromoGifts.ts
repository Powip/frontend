import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { CartItem } from "@/interfaces/IOrder";
import { evaluatePromotions, type EvaluateItem, type EvaluatedGift } from "@/services/promotionsService";
import { getOrderItemPricing } from "@/app/registrar-venta/orderItemPricing";

/**
 * Ítems del carrito tal como los ve `/promos/evaluate` (precio bruto y descuento de la línea). Las líneas
 * sin variante (las manuales de una cotización) no van: el backend exige la variante.
 */
export function cartToEvaluateItems(cart: CartItem[]): EvaluateItem[] {
  return cart
    .filter((line) => line.quantity > 0 && !line.isGift && !!line.variantId)
    .map((line) => {
      const { unitPrice, discountAmount } = getOrderItemPricing(line);
      return { productVariantId: line.variantId, quantity: line.quantity, unitPrice, discountAmount };
    });
}

/**
 * FEAT-24 H9 (H9-D5) — regalos que el backend va a sumar al guardar la venta manual (`/promos/evaluate`,
 * con la tienda y el canal del pedido). Solo se muestran: el backend agrega las líneas al crear la venta.
 * Al editar un pedido no se evalúa (el backend solo suma regalos al crear). Cotizaciones lo usa sin canal
 * (el canal se elige al convertir), así que solo ve las promos sin canales.
 */
export function usePromoGifts({
  cart,
  storeId,
  channel,
  enabled,
}: {
  cart: CartItem[];
  storeId: string | null | undefined;
  channel: string | null | undefined;
  enabled: boolean;
}): { gifts: EvaluatedGift[]; loading: boolean; failed: boolean } {
  const items = useMemo(() => cartToEvaluateItems(cart), [cart]);
  const signature = JSON.stringify(items);
  const [debounced, setDebounced] = useState(signature);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(signature), 400);
    return () => clearTimeout(timer);
  }, [signature]);
  const query = useQuery({
    queryKey: ["sale-promo-gifts", storeId ?? null, channel ?? null, debounced],
    queryFn: ({ signal }) =>
      evaluatePromotions({ storeId: storeId as string, channel: channel ?? undefined, items: JSON.parse(debounced) as EvaluateItem[] }, signal),
    enabled: enabled && !!storeId && debounced !== "[]",
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  });
  const active = enabled && !!storeId && items.length > 0;
  return {
    gifts: active ? query.data?.gifts ?? [] : [],
    loading: active && query.isFetching,
    failed: active && query.isError,
  };
}
