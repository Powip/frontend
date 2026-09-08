"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { OrderHeader } from "@/interfaces/IOrder";
import { trackShalomShipment } from "@/services/shalomService";

/**
 * Pasos del tracking en vivo de Shalom (`trackShalomShipment`) — más
 * granular que `order.shalomStatus` (que solo se actualiza por webhook y
 * puede no haber sincronizado todavía). Extraído de `ShalomOrderTrackingView`
 * para poder mostrar el mismo estado en vivo en cualquier tabla de pedidos
 * despachados por Shalom, no solo en su pestaña dedicada.
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
 */
export function useShalomLiveStatuses(orders: OrderHeader[]) {
  const { auth } = useAuth();
  const [liveStatuses, setLiveStatuses] = useState<Record<string, string>>({});
  const [loadingLiveStatuses, setLoadingLiveStatuses] = useState(false);

  const fetchLiveStatuses = useCallback(
    async (list: OrderHeader[]) => {
      if (!auth?.accessToken || !auth?.company?.id) return;
      const eligible = list.filter((o) => o.externalTrackingNumber && o.shippingCode);
      if (!eligible.length) return;

      setLoadingLiveStatuses(true);
      const results = await Promise.allSettled(
        eligible.map(async (order) => {
          const raw = await trackShalomShipment(
            auth.accessToken,
            auth.company!.id,
            order.externalTrackingNumber!,
            order.shippingCode!,
          );
          const label = getLatestShalomStep(raw);
          return { orderId: order.id, label };
        }),
      );

      const updates: Record<string, string> = {};
      results.forEach((result) => {
        if (result.status === "fulfilled" && result.value.label) {
          updates[result.value.orderId] = result.value.label;
        }
      });
      setLiveStatuses(updates);
      setLoadingLiveStatuses(false);
    },
    [auth?.accessToken, auth?.company?.id],
  );

  useEffect(() => {
    if (orders.length > 0) fetchLiveStatuses(orders);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  return { liveStatuses, loadingLiveStatuses };
}
