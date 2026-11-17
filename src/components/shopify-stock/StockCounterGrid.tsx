"use client";

import { cn } from "@/lib/utils";
import { type CounterTone, summarizeCounters } from "@/lib/shopifyStock";
import type { ShopifyStockCounters } from "@/services/shopifyStockService";

// FEAT-24 H1-D (H1D-5) — contadores de una corrida de stock de Shopify.

const TONE_CLASS: Record<CounterTone, string> = {
  neutral: "",
  ok: "text-emerald-700 dark:text-emerald-400",
  warn: "text-amber-700 dark:text-amber-400",
  danger: "text-red-700 dark:text-red-400",
};

interface Props {
  counters: Partial<ShopifyStockCounters> | null | undefined;
  /** Oculta los contadores en 0 que no son los principales (para la tarjeta de la tienda). */
  compact?: boolean;
}

const ALWAYS = new Set(["revisadas", "iguales", "a_publicar", "quedarian_en_0", "frenan_venta"]);

export default function StockCounterGrid({ counters, compact = false }: Props) {
  const items = summarizeCounters(counters).filter((c) => !compact || ALWAYS.has(c.key) || c.value > 0);
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <div key={item.key} className="rounded-md border p-2" title={item.hint} data-testid={`counter-${item.key}`}>
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className={cn("text-lg font-semibold tabular-nums", TONE_CLASS[item.tone])}>
            {item.value.toLocaleString("es-PE")}
          </dd>
        </div>
      ))}
    </dl>
  );
}
