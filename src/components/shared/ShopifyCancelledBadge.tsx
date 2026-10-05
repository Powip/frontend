"use client";

import React from "react";

interface ShopifyCancelledBadgeProps {
  cancelledAt?: string | null;
  reason?: string | null;
}

// cancel_reason de Shopify → texto para el equipo.
const REASON_LABEL: Record<string, string> = {
  customer: "cliente",
  fraud: "fraude",
  inventory: "sin stock",
  declined: "pago rechazado",
  staff: "error del equipo",
  other: "otro",
};

/**
 * FEAT-21 — el pedido se canceló en Shopify después de importarse. Powip no
 * lo anula solo: el badge avisa para que nadie lo despache sin revisar.
 */
export const ShopifyCancelledBadge: React.FC<ShopifyCancelledBadgeProps> = ({
  cancelledAt,
  reason,
}) => {
  if (!cancelledAt) return null;

  const fecha = new Date(cancelledAt).toLocaleString("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Lima",
  });
  const motivo = reason ? ` — motivo: ${REASON_LABEL[reason] ?? reason}` : "";

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
      title={`Cancelado en Shopify el ${fecha}${motivo}. Revisar antes de despachar.`}
    >
      Cancelado en Shopify
    </span>
  );
};
