"use client";

import { useInventoryAlerts } from "@/hooks/useInventoryAlerts";
import { alertBadgeText } from "@/lib/reports/alerts";

/** FEAT-24 H10-D8 — contador de alertas de inventario junto a «Inventario» en el menú lateral. */
export function InventoryAlertsBadge() {
  const { data } = useInventoryAlerts();
  const total = data?.total ?? 0;
  if (total <= 0) return null;
  return (
    <span
      aria-label={`${total} alertas de inventario`}
      title={`${total} alertas de inventario`}
      className="ml-auto shrink-0 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold leading-4 text-white"
    >
      {alertBadgeText(total)}
    </span>
  );
}
