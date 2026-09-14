"use client";

import { OrderHeader } from "@/interfaces/IOrder";
import { isAliclikCourier, isEvaCourier, isShalomCourier } from "@/utils/courierNormalizer";
import { ShalomStatusBadge } from "./ShalomStatusBadge";
import AliclikStatusBadge from "@/components/aliclik/AliclikStatusBadge";
import EvaStatusBadge, { STATUS_LABEL as EVA_STATUS_LABEL } from "@/components/eva/EvaStatusBadge";
import { Badge } from "@/components/ui/badge";

export const SHALOM_STATUS_LABELS: Record<string, string> = {
  PENDIENTE: "Registrado",
  EXITOSO: "Registrado",
  FALLIDO: "Fallido",
  EN_TRANSITO: "En tránsito",
  EN_DESTINO: "En destino",
  EN_REPARTO: "En reparto",
  ENTREGADO: "Entregado",
  DEVUELTO: "Devuelto",
  CANCELADO: "Cancelado",
};

export const ALICLIK_STATUS_LABELS: Record<string, string> = {
  TO_PREPARE: "Por preparar",
  PENDING: "Pendiente",
  PICKED_UP: "Recogido",
  IN_TRANSIT: "En tránsito",
  DELIVERED: "Entregado",
  RETURNED: "Devuelto",
  CANCELED: "Cancelado",
};

export type CourierStatusSource = "shalom" | "aliclik" | "eva";

export interface CourierStatusInfo {
  source: CourierStatusSource;
  sourceLabel: string;
  value: string;
  label: string;
}

/**
 * Detecta a qué integración pertenece un pedido despachado y devuelve su
 * estado crudo + label legible — única fuente de verdad para no duplicar el
 * `isXCourier(...)` + mapeo de labels en cada vista (Todos, filtros, modal).
 */
export function getOrderCourierStatus(order: OrderHeader): CourierStatusInfo | null {
  if (
    (isShalomCourier(order.courier) || isShalomCourier(order.shippingOffice)) &&
    order.shalomStatus
  ) {
    return {
      source: "shalom",
      sourceLabel: "Shalom",
      value: order.shalomStatus,
      label: SHALOM_STATUS_LABELS[order.shalomStatus] ?? order.shalomStatus,
    };
  }
  if (isAliclikCourier(order.courier) && order.aliclikDispatchStatus) {
    return {
      source: "aliclik",
      sourceLabel: "Aliclik",
      value: order.aliclikDispatchStatus,
      label: ALICLIK_STATUS_LABELS[order.aliclikDispatchStatus] ?? order.aliclikDispatchStatus,
    };
  }
  if (
    (isEvaCourier(order.courier) || isEvaCourier(order.shippingOffice)) &&
    order.evaStatus
  ) {
    return {
      source: "eva",
      sourceLabel: "EVA",
      value: order.evaStatus,
      label: EVA_STATUS_LABEL[order.evaStatus] ?? order.evaStatus,
    };
  }
  return null;
}

export function courierStatusFilterKey(info: CourierStatusInfo): string {
  return `${info.source}:${info.value}`;
}

/**
 * Badge del estado de envío para cualquier courier con integración propia.
 * `live` permite pasar el estado en vivo de Shalom (useShalomLiveStatuses)
 * cuando esté disponible, igual que ya hacía CourierTrackingView antes de
 * generalizarse a Aliclik/EVA.
 */
export function CourierStatusBadge({
  order,
  live,
}: {
  order: OrderHeader;
  live?: { label: string; style: string; icon: string };
}) {
  const isShalom = isShalomCourier(order.courier) || isShalomCourier(order.shippingOffice);
  const isAliclik = isAliclikCourier(order.courier);
  const isEva = isEvaCourier(order.courier) || isEvaCourier(order.shippingOffice);

  if (isShalom) {
    if (live) {
      return (
        <Badge variant="outline" className={`text-[10px] ${live.style}`}>
          {live.icon} {live.label}
        </Badge>
      );
    }
    return <ShalomStatusBadge status={order.shalomStatus} error={order.shalomError} />;
  }
  if (isAliclik && (order.aliclikDispatchStatus || order.aliclikSyncedAt)) {
    return (
      <AliclikStatusBadge
        aliclikDispatchStatus={order.aliclikDispatchStatus}
        aliclikSyncedAt={order.aliclikSyncedAt}
      />
    );
  }
  if (isEva && order.evaStatus) {
    return <EvaStatusBadge evaStatus={order.evaStatus} evaSyncedAt={order.evaSyncedAt} />;
  }
  return <span className="text-xs text-muted-foreground">—</span>;
}
