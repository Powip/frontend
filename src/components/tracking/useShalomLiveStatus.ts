"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
// Labels en el mismo case que SHALOM_STATUS_LABELS (CourierStatusBadge.tsx) y
// ShalomStatusBadge.tsx — antes este mapa usaba Title Case ("En Tránsito") y
// esos dos usaban minúscula en la segunda palabra ("En tránsito"), mismo
// estado con dos textos distintos según si había tracking en vivo o no, lo
// que hacía parecer que el filtro de estados no matcheaba lo que se veía en
// pantalla.
export const SHALOM_STEPS = [
  { key: "registrado", label: "Registrado" },
  { key: "origen", label: "En origen" },
  { key: "transito", label: "En tránsito" },
  { key: "destino", label: "En destino" },
  { key: "reparto", label: "En reparto" },
  { key: "entregado", label: "Entregado" },
] as const;

export const SHALOM_STEP_STYLES: Record<string, string> = {
  "Registrado": "bg-green-50 text-green-700 border-green-200",
  "En origen": "bg-teal-50 text-teal-700 border-teal-200",
  "En tránsito": "bg-blue-50 text-blue-700 border-blue-200",
  "En destino": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "En reparto": "bg-violet-50 text-violet-700 border-violet-200",
  "Entregado": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export const SHALOM_STEP_ICONS: Record<string, string> = {
  "Registrado": "✅",
  "En origen": "📦",
  "En tránsito": "🚚",
  "En destino": "📍",
  "En reparto": "🛵",
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
 * `POST /track/batch` no devuelve la misma forma que `POST /track`:
 * el lote puede traer un único código en `statuses.estado` (por ejemplo
 * `EN_CAMINO`) en vez de la línea de tiempo `statuses.data`. Esta tabla
 * convierte ambos formatos al mismo label que usan los badges.
 */
function getShalomStateLabel(rawState: unknown): string | null {
  const state = String(rawState ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!state) return null;
  if (state.includes("ENTREGAD")) return "Entregado";
  if (state.includes("REPART")) return "En reparto";
  if (state.includes("DESTIN")) return "En destino";
  if (state.includes("CAMINO") || state.includes("TRANSIT")) {
    return "En tránsito";
  }
  if (state.includes("ORIGEN")) return "En origen";
  if (
    state.includes("REGISTR") ||
    state.includes("PENDIENT") ||
    state.includes("EXITOS") ||
    state.includes("CREAD") ||
    state.includes("GENERAD")
  ) {
    return "Registrado";
  }
  return null;
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
  const statuses = payload?.statuses as
    | {
        data?: Record<string, unknown>;
        estado?: unknown;
        status?: unknown;
      }
    | undefined;

  if (statuses?.data) {
    for (let i = SHALOM_STEPS.length - 1; i >= 0; i--) {
      if (statuses.data[SHALOM_STEPS[i].key]) return SHALOM_STEPS[i].label;
    }
  }

  // Forma real documentada por el backend para `POST /track/batch`.
  const batchLabel = getShalomStateLabel(statuses?.estado ?? statuses?.status);
  if (batchLabel) return batchLabel;

  // Forma defensiva para respuestas individuales/envueltas por Shalom.
  const searchData = (payload?.search as { data?: Record<string, unknown> } | undefined)?.data;
  return getShalomStateLabel(searchData?.estado ?? searchData?.status);
}

export interface ShalomLiveRefreshResult {
  requested: number;
  updated: number;
  failed: number;
  unresolved: number;
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
  const ordersRef = useRef(orders);
  ordersRef.current = orders;

  // Evita reconsultar si el caller reconstruye el mismo array durante un
  // render. Solo cambia cuando cambia un pedido o sus credenciales de tracking.
  const ordersKey = orders
    .map(
      (order) =>
        `${order.id}:${order.externalTrackingNumber ?? ""}:${order.shippingCode ?? ""}`,
    )
    .join("|");

  const fetchLiveStatuses = useCallback(
    async (list: OrderHeader[]): Promise<ShalomLiveRefreshResult> => {
      const emptyResult: ShalomLiveRefreshResult = {
        requested: 0,
        updated: 0,
        failed: 0,
        unresolved: 0,
      };
      if (!auth?.accessToken) return emptyResult;
      const eligible = list.filter(
        (o) => o.externalTrackingNumber && o.shippingCode,
      );
      if (!eligible.length) return emptyResult;

      // Índice orderNumber+orderCode → orderId para reasociar la respuesta plana.
      const orderIdByTrackKey = new Map<string, string>();
      eligible.forEach((o) => {
        orderIdByTrackKey.set(
          makeKey(o.externalTrackingNumber, o.shippingCode),
          o.id,
        );
      });

      // No conservar como "en vivo" un badge de una consulta anterior. Si el
      // nuevo intento falla o no trae un estado interpretable, el caller puede
      // mostrar el persistido junto con un aviso explícito del resultado.
      setLiveStatuses((prev) => {
        const next = { ...prev };
        eligible.forEach((order) => delete next[order.id]);
        return next;
      });

      let failed = 0;
      const updatedOrderIds = new Set<string>();

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
          } catch (error) {
            failed += group.length;
            const message =
              error instanceof Error ? error.message : "Error desconocido";
            console.error(
              `No se pudo actualizar un lote de estados Shalom: ${message}`,
            );
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
            if (label) {
              chunkUpdates[orderId] = label;
              updatedOrderIds.add(orderId);
            }
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

      return {
        requested: eligible.length,
        updated: updatedOrderIds.size,
        failed,
        unresolved: Math.max(0, eligible.length - failed - updatedOrderIds.size),
      };
    },
    [auth?.accessToken],
  );

  useEffect(() => {
    if (ordersRef.current.length > 0) {
      void fetchLiveStatuses(ordersRef.current);
    }
    // `fetchLiveStatuses` cambia de identidad cuando llega `auth.accessToken`
    // (auth cargando en la primera corrida) → re-dispara el rastreo al tenerlo.
  }, [ordersKey, fetchLiveStatuses]);

  return {
    liveStatuses,
    loadingLiveStatuses,
    refreshLiveStatuses: fetchLiveStatuses,
  };
}
