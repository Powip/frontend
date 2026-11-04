"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { Sale } from "./types";

/**
 * Ida y vuelta entre la revisión de "Asignar a guía" (Preparados) y
 * /registrar-venta para editar el tipo de entrega de un pedido.
 *
 * - Al salir se codifica en `returnTo` solo lo necesario para restaurar la
 *   vista: los IDs seleccionados (`sel`). Nunca objetos: al volver se piden al
 *   servidor, así la elegibilidad nunca usa datos viejos.
 * - /registrar-venta agrega `updated=<orderId>` SOLO tras guardar con éxito.
 *   Sin `updated` (botón "Volver" sin guardar) se restaura la selección pero
 *   no se reabre la revisión ni se anuncia ningún cambio.
 * - Los parámetros se consumen una única vez y se limpian de la URL.
 */

export const PEDIDOS_PREPARADOS_PATH = "/operaciones/pedidos?tab=preparados";

export function buildGuideReviewReturnTo(selectedIds: string[]): string {
  const params = new URLSearchParams({ tab: "preparados" });
  if (selectedIds.length) params.set("sel", selectedIds.join(","));
  return `/operaciones/pedidos?${params.toString()}`;
}

export interface GuideReviewReturn {
  /** Pedidos de la selección original que siguen en Preparados, ya cargados. */
  sales: Sale[];
  /** Pedido guardado con éxito en /registrar-venta (si sigue en la pestaña). */
  updatedId: string | null;
}

export function parseGuideReviewReturn(params: URLSearchParams): {
  selectedIds: string[];
  updatedId: string | null;
} | null {
  const sel = params.get("sel");
  const updatedId = params.get("updated");
  if (!sel && !updatedId) return null;
  const selectedIds = (sel ?? "").split(",").filter(Boolean);
  if (updatedId && !selectedIds.includes(updatedId)) selectedIds.push(updatedId);
  return { selectedIds, updatedId };
}

/** `ready` = el alcance de tiendas ya está resuelto; `loadSalesByIds` pide esos pedidos al servidor. */
export function useGuideReviewReturn(ready: boolean, loadSalesByIds: (ids: string[]) => Promise<Sale[]>) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const handledRef = useRef<string | null>(null);
  // Una referencia estable: si `loadSalesByIds` cambia mientras se carga, no se cancela ni se repite la restauración.
  const loadRef = useRef(loadSalesByIds);
  loadRef.current = loadSalesByIds;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const [pending, setPending] = useState<GuideReviewReturn | null>(null);

  const query = searchParams.toString();
  useEffect(() => {
    if (!ready) return;
    const parsed = parseGuideReviewReturn(new URLSearchParams(query));
    if (!parsed) return;
    if (handledRef.current === query) return;
    handledRef.current = query;

    (async () => {
      let sales: Sale[] = [];
      try {
        sales = await loadRef.current(parsed.selectedIds);
      } catch {
        toast.error("No se pudo restaurar la selección de pedidos.");
      }
      if (!mountedRef.current) return;
      const present = new Set(sales.map((s) => s.id));
      const updatedId = parsed.updatedId && present.has(parsed.updatedId) ? parsed.updatedId : null;
      if (parsed.updatedId && !updatedId) toast.info("El pedido se actualizó, pero ya no figura en Preparados.");
      const missing = parsed.selectedIds.length - sales.length - (parsed.updatedId && !updatedId ? 1 : 0);
      if (missing > 0) toast.info(`${missing} pedido(s) de la selección ya no figuran en Preparados.`);
      setPending({ sales, updatedId });
      router.replace(PEDIDOS_PREPARADOS_PATH, { scroll: false });
    })();
  }, [ready, query, router]);

  const clear = useCallback(() => setPending(null), []);
  return { pending, clear };
}
