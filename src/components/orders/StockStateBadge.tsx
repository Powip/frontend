import { cn } from "@/lib/utils";
import { stockStateInfo, type StockStateTone } from "@/lib/orderStock";

// FEAT-24 H2-F — estado de stock del pedido (columna `stock_state` de ms-ventas).
// Si el pedido no lo trae (pedidos viejos o servidor sin H2) no se muestra nada.

const TONE_CLASSES: Record<StockStateTone, string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300",
  danger: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300",
  warning: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
  info: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-300",
  neutral: "border-border bg-muted text-muted-foreground",
};

export function StockStateBadge({ state, className }: { state?: string | null; className?: string }) {
  const info = stockStateInfo(state);
  if (!info) return null;
  return (
    <span
      title={info.hint}
      data-testid="stock-state-badge"
      className={cn(
        "inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        TONE_CLASSES[info.tone],
        className,
      )}
    >
      Stock: {info.label}
    </span>
  );
}
