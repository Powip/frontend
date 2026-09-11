"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { OrderHeader } from "@/interfaces/IOrder";
import {
  trackShalomMassive,
  type ShalomMassiveTrackResult,
} from "@/services/shalomService";

/**
 * Pasos del tracking en vivo de Shalom — más granular que `order.shalomStatus`
 * (que solo se actualiza por webhook y puede no haber sincronizado todavía).
 * Extraído de `ShalomOrderTrackingView` para poder mostrar el mismo estado en
 * vivo en cualquier tabla de pedidos despachados por Shalom, no solo en su
 * pestaña dedicada.
 */
export const SHALOM_STEPS = [
  { key: "registrado", label: "Registrado" },
  { key: "origen", label: "En Origen" },
  { key: "transito", label: "En Tránsito" },
  { key: "destino", label: "En Destino" },
  { key: "reparto", label: "En Reparto" },
  { key: "entregado", label: "Entregado" },
] as const;

export const SHALOM_STEP_STYLES: Record<string, string> = {
  "Registrado": "bg-green-50 text-green-700 border-green-200",
  "En Origen": "bg-teal-50 text-teal-700 border-teal-200",
  "En Tránsito": "bg-blue-50 text-blue-700 border-blue-200",
  "En Destino": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "En Reparto": "bg-violet-50 text-violet-700 border-violet-200",
  "Entregado": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export const SHALOM_STEP_ICONS: Record<string, string> = {
  "Registrado": "✅",
  "En Origen": "📦",
  "En Tránsito": "🚚",
  "En Destino": "📍",
  "En Reparto": "🛵",
  "Entregado": "🎉",
};

/** Límite del proveedor para `POST /shalom/track-massive`. */
const MASSIVE_TRACK_CHUNK_SIZE = 50;

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    groups.push(items.slice(i, i + size));
  }
  return groups;
}

/**
 * Clave de reasociación respuesta→pedido. Normaliza (trim + upper) los DOS
 * lados del Map: en prod se vio `shippingCode` con espacio final ("CHJN ") y el
 * proveedor puede ecoar el código trimmeado o en otro case. Sin normalizar, el
 * `Map.get` falla en silencio y la fila cae al fallback `order.shalomStatus`.
 */
function makeKey(orderNumber: unknown, orderCode: unknown): string {
  const n = String(orderNumber ?? "").trim().toUpperCase();
  const c = String(orderCode ?? "").trim().toUpperCase();
  return `${n}::${c}`;
}

/**
 * Deriva el último paso alcanzado recorriendo `SHALOM_STEPS` de atrás para
 * adelante sobre `statuses.data`. Acepta tanto la respuesta cruda de
 * `POST /shalom/track` (con `data` anidado) como un ítem del array de
 * `POST /shalom/track-massive` (que ya trae `statuses` en la raíz).
 */
function getLatestShalomStep(rawResponse: Record<string, unknown>): string | null {
  let payload: Record<string, unknown> = rawResponse;
  for (let i = 0; i < 3; i++) {
    if (payload?.statuses) break;
    if (payload?.data) {
      payload = payload.data as Record<string, unknown>;
      continue;
    }
    break;
  }
  const statuses = (payload?.statuses as { data?: Record<string, unknown> } | undefined)?.data;
  if (!statuses) return null;
  for (let i = SHALOM_STEPS.length - 1; i >= 0; i--) {
    if (statuses[SHALOM_STEPS[i].key]) return SHALOM_STEPS[i].label;
  }
  return null;
}

/**
 * Consulta el estado en vivo de Shalom para los pedidos elegibles (los que
 * tienen `externalTrackingNumber` + `shippingCode`) — el resto se queda sin
 * entrada en `liveStatuses`, y el caller debe caer de vuelta a
 * `order.shalomStatus` (ver `ShalomStatusBadge`).
 *
 * El rastreo se hace EN LOTE (`POST /shalom/track-massive`, chunks de ≤50
 * llamados en secuencia), no con N requests sueltos en paralelo: eso floodeaba
 * la API del proveedor y devolvía 429 que también rompían cotización y agencias
 * (comparten la misma API key global). El caller es responsable de pasar solo
 * el subconjunto visible (página actual), no toda la tienda.
 */
export function useShalomLiveStatuses(orders: OrderHeader[]) {
  const { auth } = useAuth();
  const [liveStatuses, setLiveStatuses] = useState<Record<string, string>>({});
  const [loadingLiveStatuses, setLoadingLiveStatuses] = useState(false);

  const fetchLiveStatuses = useCallback(
    async (list: OrderHeader[]) => {
      if (!auth?.accessToken) return;
      const eligible = list.filter(
        (o) => o.externalTrackingNumber && o.shippingCode,
      );
      if (!eligible.length) return;

      // Índice orderNumber+orderCode → orderId para reasociar la respuesta plana.
      const orderIdByTrackKey = new Map<string, string>();
      eligible.forEach((o) => {
        orderIdByTrackKey.set(
          makeKey(o.externalTrackingNumber, o.shippingCode),
          o.id,
        );
      });

      setLoadingLiveStatuses(true);
      try {
        for (const group of chunk(eligible, MASSIVE_TRACK_CHUNK_SIZE)) {
          let results: ShalomMassiveTrackResult[];
          try {
            results = await trackShalomMassive(
              auth.accessToken,
              group.map((o) => ({
                orderNumber: o.externalTrackingNumber!,
                orderCode: o.shippingCode!,
              })),
            );
          } catch {
            // Lote fallido (429/5xx del proveedor): se conservan los demás
            // lotes (y los badges ya resueltos) y el caller cae de vuelta a
            // `order.shalomStatus`.
            continue;
          }

          const chunkUpdates: Record<string, string> = {};
          results.forEach((item) => {
            const orderId = orderIdByTrackKey.get(
              makeKey(item.orderNumber, item.orderCode),
            );
            if (!orderId) return;
            const label = getLatestShalomStep(
              item as unknown as Record<string, unknown>,
            );
            if (label) chunkUpdates[orderId] = label;
          });

          // Merge por lote: feedback progresivo con muchos pedidos y un refetch
          // que termine en 429 no borra los badges buenos previos.
          if (Object.keys(chunkUpdates).length > 0) {
            setLiveStatuses((prev) => ({ ...prev, ...chunkUpdates }));
          }
        }
      } finally {
        setLoadingLiveStatuses(false);
      }
    },
    [auth?.accessToken],
  );

  useEffect(() => {
    if (orders.length > 0) fetchLiveStatuses(orders);
    // `fetchLiveStatuses` cambia de identidad cuando llega `auth.accessToken`
    // (auth cargando en la primera corrida) → re-dispara el rastreo al tenerlo.
  }, [orders, fetchLiveStatuses]);

  return { liveStatuses, loadingLiveStatuses };
}
