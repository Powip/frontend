import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CartItem } from "@/interfaces/IOrder";
import {
  evaluateSaleEngine,
  type PackSuggestion,
  type SaleEngineGift,
  type SaleEngineResult,
  type SaleSuggestion,
} from "@/services/promotionsService";
import { listPacks } from "@/services/packsService";
import {
  addSuggestedPackLine,
  applyEngineResult,
  buildEngineRequest,
  lineNet,
  type EngineRequest,
} from "@/app/registrar-venta/saleEnginePricing";

const ENGINE_KEY = "sale-promo-engine";
const DEBOUNCE_MS = 400;

interface EngineData {
  request: EngineRequest;
  result: SaleEngineResult;
}

async function runEngine(signature: string, signal?: AbortSignal): Promise<EngineData> {
  const request = JSON.parse(signature) as EngineRequest;
  const result = await evaluateSaleEngine(
    {
      storeId: request.storeId,
      ...(request.channel ? { channel: request.channel } : {}),
      ...(request.inventoryId ? { inventoryId: request.inventoryId } : {}),
      items: request.lines.map(({ productVariantId, quantity, unitPrice, discountAmount }) => ({ productVariantId, quantity, unitPrice, discountAmount })),
    },
    signal,
  );
  return { request, result };
}

const cents = (lines: readonly CartItem[]) => Math.round(lines.reduce((sum, line) => sum + lineNet(line), 0) * 100);

export interface SaleEngine {
  /** Venta nueva (sin pedido ni lead): el motor manda en los precios, sugerencias y regalo. */
  enabled: boolean;
  /** Carrito con el precio del motor en las líneas elegibles (el mismo carrito si no hay motor). */
  cart: CartItem[];
  suggestions: SaleSuggestion[];
  /** Regalos que se suman (el principal y, si son combinables, los demás). */
  gifts: SaleEngineGift[];
  /** Regalos cumplidos que no se suman («no se suma», «sin stock en este almacén»). */
  skippedGifts: SaleEngineGift[];
  /** El motor falló: las líneas quedan con su precio sugerido (no bloquea la venta). */
  failed: boolean;
  /** Hay un cambio del carrito, canal, tienda o almacén que el motor todavía no calculó. */
  pending: boolean;
  /**
   * Al registrar: si el motor está recalculando, espera su respuesta. `changed` = el neto cambió respecto de lo
   * que se ve (hay que mostrarlo antes de guardar). Si falla, devuelve el carrito con su precio sugerido.
   */
  settle: () => Promise<{ cart: CartItem[]; changed: boolean }>;
  /** «Agregar pack» de una sugerencia (sin SKU no se agrega). */
  addPack: (suggestion: PackSuggestion) => Promise<void>;
}

/**
 * FEAT-32 M6a — motor de promociones en Registrar venta (venta nueva). Reemplaza al volumen del navegador y a
 * `usePromoGifts`: manda el carrito a `POST /promos/evaluate` (tienda, canal y almacén de salida, con un
 * debounce de 400 ms) y aplica el precio de lista, la promo y el neto a las líneas elegibles.
 */
export function useSaleEngine({
  cart,
  setCart,
  storeId,
  channel,
  inventoryId,
  enabled,
}: {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  storeId: string | null | undefined;
  channel: string | null | undefined;
  inventoryId: string | null | undefined;
  enabled: boolean;
}): SaleEngine {
  const queryClient = useQueryClient();
  const request = useMemo(
    () => (enabled ? buildEngineRequest(cart, { storeId, channel, inventoryId }) : null),
    [enabled, cart, storeId, channel, inventoryId],
  );
  const signature = request ? JSON.stringify(request) : "";
  const [debounced, setDebounced] = useState(signature);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(signature), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [signature]);

  const query = useQuery({
    queryKey: [ENGINE_KEY, debounced],
    queryFn: ({ signal }) => runEngine(debounced, signal),
    enabled: !!request && debounced !== "",
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  });

  const active = !!request;
  const failed = active && query.isError;
  const data = active && !query.isError ? query.data : undefined;
  const priced = useMemo(
    () => (data ? applyEngineResult(cart, data.request, data.result.lines) : cart),
    [cart, data],
  );
  const result = data?.result;
  const given = result?.giftOptions.filter((gift) => gift.status === "GIVEN") ?? [];

  const settle = useCallback(async () => {
    if (!request) return { cart, changed: false };
    if (signature === debounced && !query.isFetching && (query.data || query.isError)) return { cart: priced, changed: false };
    let fresh = cart;
    try {
      const latest = await queryClient.fetchQuery({
        queryKey: [ENGINE_KEY, signature],
        queryFn: ({ signal }) => runEngine(signature, signal),
        staleTime: 30_000,
        retry: false,
      });
      fresh = applyEngineResult(cart, latest.request, latest.result.lines);
    } catch {
      // Sin motor: el precio sugerido de siempre.
    }
    setDebounced(signature);
    return { cart: fresh, changed: cents(fresh) !== cents(priced) };
  }, [request, signature, debounced, query.isFetching, query.data, query.isError, cart, priced, queryClient]);

  const addPack = useCallback(
    async (suggestion: PackSuggestion) => {
      if (!suggestion.sku) return;
      // Con el pack de ms-products la línea muestra el nombre y el SKU de cada componente; si no responde,
      // va con el contenido de la sugerencia.
      const pack = await listPacks({ q: suggestion.sku, active: true, limit: 12 })
        .then((page) => page.data.find((row) => row.variantId === suggestion.packVariantId) ?? null)
        .catch(() => null);
      setCart((current) => addSuggestedPackLine(current, suggestion, pack));
    },
    [setCart],
  );

  return {
    enabled,
    cart: priced,
    suggestions: active ? result?.suggestions ?? [] : [],
    gifts: active ? (given.length ? given : result?.gift ? [result.gift] : []) : [],
    skippedGifts: active ? result?.giftOptions.filter((gift) => gift.status !== "GIVEN") ?? [] : [],
    failed,
    pending: active && (signature !== debounced || query.isFetching),
    settle,
    addPack,
  };
}
