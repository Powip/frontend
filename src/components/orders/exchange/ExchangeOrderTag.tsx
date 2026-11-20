import { Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

/** FEAT-24 H12 — ¿es un pedido de cambio? (`orderType` CAMBIO o con pedido original). */
export function isExchangeOrder(order: { orderType?: string | null; parentOrderNumber?: string | null; parentOrderId?: string | null } | null | undefined): boolean {
  return !!order && (order.orderType === "CAMBIO" || !!order.parentOrderNumber || !!order.parentOrderId);
}

/** FEAT-24 H12 — etiqueta «Cambio de ORD-xxxx» del pedido hijo (en /ventas y en el detalle). */
export function ExchangeOrderTag({
  order,
  className,
}: {
  order: { orderType?: string | null; parentOrderNumber?: string | null; parentOrderId?: string | null } | null | undefined;
  className?: string;
}) {
  if (!isExchangeOrder(order)) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-semibold text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
        className,
      )}
      data-testid="exchange-order-tag"
    >
      <Repeat className="h-3 w-3" aria-hidden="true" />
      {order?.parentOrderNumber ? `Cambio de ${order.parentOrderNumber}` : "Pedido de cambio"}
    </span>
  );
}
