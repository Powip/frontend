"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { Sale } from "./types";

/**
 * Ida y vuelta entre la revisión de "Generar guía" (Por Despachar) y
 * /registrar-venta para editar el tipo de entrega de un pedido.
 *
 * - Al salir se codifica en `returnTo` solo lo necesario para restaurar la
 *   vista: IDs seleccionados (`sel`) y día (`day`). Nunca objetos: al volver
 *   se resuelven contra los pedidos recién recargados.
 * - /registrar-venta agrega `updated=<orderId>` SOLO tras guardar con éxito.
 *   Sin `updated` (botón "Volver" sin guardar) se restaura la selección pero
 *   no se reabre la revisión ni se anuncia ningún cambio.
 * - Los parámetros se consumen una única vez y se limpian de la URL.
 */

export const PEDIDOS_DESPACHAR_PATH = "/operaciones/pedidos?tab=despachar";

export function buildGuideReviewReturnTo(
  selectedIds: string[],
  dayKey?: string,
): string {
  const params = new URLSearchParams({ tab: "despachar" });
  if (selectedIds.length) params.set("sel", selectedIds.join(","));
  if (dayKey) params.set("day", dayKey);
  return `/operaciones/pedidos?${params.toString()}`;
}

export interface GuideReviewReturn {
  /** IDs de la selección original que siguen en Por Despachar. */
  selectedIds: string[];
  /** Pedido guardado con éxito en /registrar-venta (si sigue en la pestaña). */
  updatedId: string | null;
  dayKey: string | null;
}

export function parseGuideReviewReturn(params: URLSearchParams): {
  selectedIds: string[];
  updatedId: string | null;
  dayKey: string | null;
} | null {
  const sel = params.get("sel");
  const updatedId = params.get("updated");
  if (!sel && !updatedId) return null;
  const selectedIds = (sel ?? "").split(",").filter(Boolean);
  if (updatedId && !selectedIds.includes(updatedId)) selectedIds.push(updatedId);
  const day = params.get("day");
  return {
    selectedIds,
    updatedId,
    dayKey: day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null,
  };
}

/** `ready` = los pedidos ya se cargaron (datos frescos de esta visita). */
export function useGuideReviewReturn(ready: boolean, despacharSales: Sale[]) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const handledRef = useRef<string | null>(null);
  const [pending, setPending] = useState<GuideReviewReturn | null>(null);

  const query = searchParams.toString();
  useEffect(() => {
    if (!ready) return;
    const parsed = parseGuideReviewReturn(new URLSearchParams(query));
    if (!parsed) return;
    if (handledRef.current === query) return;
    handledRef.current = query;

    const present = new Set(despacharSales.map((s) => s.id));
    const selectedIds = parsed.selectedIds.filter((id) => present.has(id));
    const updatedId =
      parsed.updatedId && present.has(parsed.updatedId)
        ? parsed.updatedId
        : null;

    if (parsed.updatedId && !updatedId)
      toast.info("El pedido se actualizó, pero ya no figura en Por Despachar.");
    const missing =
      parsed.selectedIds.length -
      selectedIds.length -
      (parsed.updatedId && !updatedId ? 1 : 0);
    if (missing > 0)
      toast.info(
        `${missing} pedido(s) de la selección ya no figuran en Por Despachar.`,
      );

    setPending({ selectedIds, updatedId, dayKey: parsed.dayKey });
    router.replace(PEDIDOS_DESPACHAR_PATH, { scroll: false });
  }, [ready, query, despacharSales, router]);

  const clear = useCallback(() => setPending(null), []);
  return { pending, clear };
}
