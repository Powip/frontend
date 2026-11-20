"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { basisLabel, courierStockNotices, signed, stockItemLabel, type NoticeTone } from "@/lib/courier";
import type { CourierStock } from "@/services/sharedCourierService";

// FEAT-24 H8-D2 — stock de un almacén courier: POWIP contra lo que reporta el
// courier (Aliclik por API o el último conteo), por variante, con la diferencia
// primero. Avisa si el dato del courier es viejo, si Aliclik no respondió (lo de
// POWIP sale igual) y cuántos SKU de Aliclik no están vinculados.

const NOTICE_CLASS: Record<NoticeTone, string> = {
  red: "border-destructive/50 bg-destructive/5 text-destructive",
  amber: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200",
  slate: "border-border bg-muted/40 text-muted-foreground",
};

/** Tope de filas en pantalla (el resto se busca). */
const MAX_ROWS = 300;

export function CourierNotices({ stock, portal }: { stock: CourierStock; portal?: boolean }) {
  const notices = courierStockNotices(stock, { portal });
  if (notices.length === 0) return null;
  return (
    <div className="space-y-2">
      {notices.map((notice) => (
        <p key={notice.key} role={notice.tone === "slate" ? "status" : "alert"} className={`rounded-md border p-3 text-sm ${NOTICE_CLASS[notice.tone]}`} data-testid={`notice-${notice.key}`}>
          {notice.text}
        </p>
      ))}
    </div>
  );
}

export default function CourierStockTable({ stock, portal = false }: { stock: CourierStock; portal?: boolean }) {
  const [search, setSearch] = useState("");
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const powipKey = stock.basis === "disponible" ? "available" : "physical";
  const rows = useMemo(() => {
    const wanted = search.trim().toLowerCase();
    return stock.items.filter((item) => {
      if (onlyDifferences && (item.difference === null || item.difference === 0)) return false;
      if (!wanted) return true;
      return [item.productName, item.sku, item.companySku, ...Object.values(item.attributes ?? {})].some((text) => (text ?? "").toLowerCase().includes(wanted));
    });
  }, [stock.items, search, onlyDifferences]);
  const shown = rows.slice(0, MAX_ROWS);

  return (
    <div className="space-y-3">
      <CourierNotices stock={stock} portal={portal} />
      <div className="flex flex-wrap items-center gap-3">
        <Input aria-label="Buscar producto" placeholder="Buscar por SKU o producto…" className="max-w-xs" value={search} onChange={(event) => setSearch(event.target.value)} />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={onlyDifferences} onChange={(event) => setOnlyDifferences(event.target.checked)} />
          Solo con diferencia
        </label>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm" aria-label="Stock POWIP contra courier">
          <thead className="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Producto</th>
              <th className="px-3 py-2 text-right font-medium">POWIP ({basisLabel(stock.basis).toLowerCase()})</th>
              <th className="px-3 py-2 text-right font-medium">Courier reporta</th>
              <th className="px-3 py-2 text-right font-medium">Diferencia</th>
              {portal ? null : <th className="px-3 py-2 text-right font-medium">Traslado en camino</th>}
              {portal ? null : <th className="px-3 py-2 text-right font-medium">Devolución por recibir</th>}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={portal ? 4 : 6} className="px-3 py-6 text-center text-muted-foreground">
                  {stock.items.length === 0 ? "Este almacén no tiene stock en POWIP ni en el courier." : "Nada con estos filtros."}
                </td>
              </tr>
            ) : (
              shown.map((item) => (
                <tr key={item.variantId} className="border-t" data-testid={`stock-${item.sku ?? item.variantId}`}>
                  <td className="px-3 py-2">
                    {stockItemLabel(item)}
                    {item.sku ? <span className="block font-mono text-xs text-muted-foreground">{item.sku}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{item[powipKey]}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{item.courier ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {item.difference === null ? (
                      "—"
                    ) : item.difference === 0 ? (
                      <span className="text-emerald-700 dark:text-emerald-300">0</span>
                    ) : (
                      <b className={item.difference > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-destructive"}>{signed(item.difference)}</b>
                    )}
                  </td>
                  {portal ? null : <td className="px-3 py-2 text-right tabular-nums">{item.incomingTransfer || "—"}</td>}
                  {portal ? null : <td className="px-3 py-2 text-right tabular-nums">{item.pendingReturn || "—"}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {rows.length > MAX_ROWS ? (
        <p className="text-xs text-muted-foreground">
          Mostrando {MAX_ROWS} de {rows.length}: busca un SKU para ver el resto.
        </p>
      ) : null}
    </div>
  );
}
