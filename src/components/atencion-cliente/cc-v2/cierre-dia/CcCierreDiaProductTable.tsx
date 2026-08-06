"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Search } from "lucide-react";
import { CierreDiaProductoRow } from "@/interfaces/ICierreDia";
import { formatCurrency, formatPct, marginColorClass } from "./cierreDiaUtils";

interface Props {
  rows: CierreDiaProductoRow[];
  totals: CierreDiaProductoRow;
  isLoading: boolean;
  isError: boolean;
  subtitle: string;
}

function BucketBadge({ value, className }: { value: number; className: string }) {
  return (
    <span className={`inline-flex min-w-[22px] justify-center rounded px-1.5 py-0.5 text-xs font-bold ${className}`}>
      {value}
    </span>
  );
}

export function CcCierreDiaProductTable({ rows, totals, isLoading, isError, subtitle }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.nombre.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 gap-2 flex-wrap">
        <div>
          <CardTitle className="text-sm">Rendimiento por Producto</CardTitle>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {rows.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Ingreso: <b className="text-emerald-600 dark:text-emerald-400">{formatCurrency(totals.ingreso)}</b>
          </span>
        )}
      </CardHeader>

      <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Filtrar</span>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto o SKU..."
            className="h-8 pl-7 w-56 text-xs"
          />
        </div>
      </div>

      <CardContent className="px-0">
        {isError ? (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            No se pudo cargar el detalle por producto. Reintentá más tarde.
          </div>
        ) : isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Cargando productos...</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No hay pedidos COD con productos para este período.
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Ningún producto coincide con &quot;{search}&quot;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Producto</TableHead>
                  <TableHead className="text-center">Por Conf.</TableHead>
                  <TableHead className="text-center">Cont.</TableHead>
                  <TableHead className="text-center">No Cont.</TableHead>
                  <TableHead className="text-center">Confirm.</TableHead>
                  <TableHead className="text-center">Desp.</TableHead>
                  <TableHead className="text-center">Entre.</TableHead>
                  <TableHead className="text-center">Anul.</TableHead>
                  <TableHead className="text-center text-violet-600 dark:text-violet-400">Upsell</TableHead>
                  <TableHead className="text-right">Ingreso S/</TableHead>
                  <TableHead className="text-right">Costo S/</TableHead>
                  <TableHead className="text-right">Margen S/</TableHead>
                  <TableHead className="text-right">% Mg.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.productVariantId}>
                    <TableCell>
                      <p className="text-sm font-medium truncate max-w-[220px]">{r.nombre}</p>
                      <p className="text-[10px] text-muted-foreground">{r.sku}</p>
                    </TableCell>
                    <TableCell className="text-center"><BucketBadge value={r.porConfirmar} className="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" /></TableCell>
                    <TableCell className="text-center"><BucketBadge value={r.contactado} className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" /></TableCell>
                    <TableCell className="text-center"><BucketBadge value={r.noContesta} className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" /></TableCell>
                    <TableCell className="text-center"><BucketBadge value={r.confirmado} className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" /></TableCell>
                    <TableCell className="text-center"><BucketBadge value={r.despachado} className="bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300" /></TableCell>
                    <TableCell className="text-center"><BucketBadge value={r.entregado} className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" /></TableCell>
                    <TableCell className="text-center"><BucketBadge value={r.anulado} className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" /></TableCell>
                    <TableCell className="text-center"><BucketBadge value={r.upsell} className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300" /></TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(r.ingreso)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(r.costo)}</TableCell>
                    <TableCell className={`text-right font-semibold ${marginColorClass(r.pctMargen)}`}>{formatCurrency(r.margen)}</TableCell>
                    <TableCell className={`text-right font-semibold ${marginColorClass(r.pctMargen)}`}>{formatPct(r.pctMargen)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <tfoot>
                <TableRow className="bg-teal-50 dark:bg-teal-950/30 font-bold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-center">{totals.porConfirmar}</TableCell>
                  <TableCell className="text-center">{totals.contactado}</TableCell>
                  <TableCell className="text-center">{totals.noContesta}</TableCell>
                  <TableCell className="text-center">{totals.confirmado}</TableCell>
                  <TableCell className="text-center">{totals.despachado}</TableCell>
                  <TableCell className="text-center">{totals.entregado}</TableCell>
                  <TableCell className="text-center">{totals.anulado}</TableCell>
                  <TableCell className="text-center text-violet-600 dark:text-violet-400">{totals.upsell}</TableCell>
                  <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(totals.ingreso)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(totals.costo)}</TableCell>
                  <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(totals.margen)}</TableCell>
                  <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{formatPct(totals.pctMargen)}</TableCell>
                </TableRow>
              </tfoot>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
