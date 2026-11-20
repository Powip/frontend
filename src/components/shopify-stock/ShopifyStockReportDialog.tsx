"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { warehouseErrorMessage } from "@/components/forms/warehouseUi";
import {
  formatDateTime,
  type ReportListKey,
  reportLists,
  RUN_STATUS_LABELS,
  STOCK_MODE_LABELS,
} from "@/lib/shopifyStock";
import { getShopifyStockReport } from "@/services/shopifyStockService";
import StockCounterGrid from "./StockCounterGrid";

// FEAT-24 H1-D (H1D-5) — último reporte Powip vs Shopify de una tienda, con sus listas.

const REPORT_LIMIT = 50;

interface Props {
  shopId: string;
  shopUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const num = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString("es-PE"));

export default function ShopifyStockReportDialog({ shopId, shopUrl, open, onOpenChange }: Props) {
  const [listKey, setListKey] = useState<ReportListKey>("a_publicar");
  const query = useQuery({
    queryKey: ["shopify-stock-report", shopId],
    queryFn: () => getShopifyStockReport(shopId, REPORT_LIMIT),
    enabled: open,
    retry: false,
    staleTime: 0,
  });
  const report = query.data;
  const lists = useMemo(() => (report ? reportLists(report) : []), [report]);
  const current = lists.find((l) => l.key === listKey) ?? lists[0];
  const run = report?.run ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Reporte de stock: {shopUrl}</DialogTitle>
          <DialogDescription>
            Compara el disponible de Powip con el de Shopify. Generar el reporte nunca cambia nada en Shopify.
          </DialogDescription>
        </DialogHeader>

        {query.isPending ? (
          <p className="text-sm text-muted-foreground">Cargando el reporte…</p>
        ) : query.isError ? (
          <div role="alert" className="space-y-2 rounded-md border p-4 text-sm">
            <p>{warehouseErrorMessage(query.error, "No se pudo cargar el reporte.")}</p>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : !run ? (
          <p className="text-sm text-muted-foreground">Esta tienda todavía no tiene reportes.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium">{RUN_STATUS_LABELS[run.status]}</span>
                {" · "}
                {formatDateTime(run.finishedAt ?? run.startedAt)}
                {" · modo "}
                {STOCK_MODE_LABELS[run.mode]}
              </p>
              {run.error ? <p className="text-red-700 dark:text-red-400">{run.error}</p> : null}
              {run.writeBlockedReason && run.mode === "powip" ? (
                <p className="text-amber-700 dark:text-amber-400">No escribió en Shopify: {run.writeBlockedReason}</p>
              ) : null}
            </div>

            <StockCounterGrid counters={run.counters} />

            <div className="flex flex-wrap gap-2" role="group" aria-label="Listas del reporte">
              {lists.map((list) => (
                <Button
                  key={list.key}
                  size="sm"
                  variant={list.key === current?.key ? "default" : "outline"}
                  aria-pressed={list.key === current?.key}
                  onClick={() => setListKey(list.key)}
                >
                  {list.label} ({list.total.toLocaleString("es-PE")})
                </Button>
              ))}
            </div>

            {current ? (
              <section aria-label={current.label} className="space-y-2">
                <p className="text-sm text-muted-foreground">{current.description}</p>
                {current.items.length === 0 ? (
                  <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No hay variantes en esta lista.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                          <th className="px-3 py-2">SKU en Shopify</th>
                          <th className="px-3 py-2">SKU en Powip</th>
                          <th className="px-3 py-2 text-right">Shopify</th>
                          {current.key === "varias_ubicaciones" ? (
                            <th className="px-3 py-2 text-right">Suma de ubicaciones</th>
                          ) : null}
                          <th className="px-3 py-2 text-right">Powip</th>
                          <th className="px-3 py-2">Detalle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {current.items.map((item) => (
                          <tr key={`${current.key}-${item.shopifyVariantId}`} className="border-t">
                            <td className="px-3 py-2 font-mono text-xs">{item.shopifySku ?? "—"}</td>
                            <td className="px-3 py-2 font-mono text-xs">{item.powipSku ?? "—"}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{num(item.shopifyAvailable)}</td>
                            {current.key === "varias_ubicaciones" ? (
                              <td className="px-3 py-2 text-right tabular-nums">{num(item.shopifyAvailableTotal)}</td>
                            ) : null}
                            <td className="px-3 py-2 text-right tabular-nums">{num(item.powipAvailable)}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{item.detail ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {current.items.length < current.total ? (
                  <p className="text-xs text-muted-foreground">
                    Se muestran {current.items.length.toLocaleString("es-PE")} de {current.total.toLocaleString("es-PE")}.
                  </p>
                ) : null}
              </section>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
