"use client";

import { DateRange } from "react-day-picker";
import { useUpsellRecords } from "@/hooks/useUpsellRecords";
import { CcUpsellRecordItem } from "@/interfaces/IOrder";
import { Card, CardContent } from "@/components/ui/card";
import { PackageSearch } from "lucide-react";

/* ── helpers ─────────────────────────────────────────────── */
function formatPEN(value: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function cleanShopName(shop: string | null): string {
  if (!shop) return "—";
  const name = shop.trim().toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\.myshopify\.com$/, "");
  const first = name.split(".")[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/* ── cards de totales ─────────────────────────────────────── */
interface TotalesProps {
  totalMonto: number;
  totalUnidades: number;
  totalRegistros: number;
}

function TotalesCards({ totalMonto, totalUnidades, totalRegistros }: TotalesProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Card className="border border-violet-200 dark:border-violet-800/50 bg-violet-50 dark:bg-violet-950/20">
        <CardContent className="px-4 py-3">
          <p className="text-xs text-muted-foreground mb-0.5">Monto total upsell</p>
          <p className="text-xl font-bold text-violet-700 dark:text-violet-300">
            {formatPEN(totalMonto)}
          </p>
        </CardContent>
      </Card>

      <Card className="border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/20">
        <CardContent className="px-4 py-3">
          <p className="text-xs text-muted-foreground mb-0.5">Unidades vendidas</p>
          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
            {totalUnidades.toLocaleString("es-PE")}
          </p>
        </CardContent>
      </Card>

      <Card className="border border-slate-200 dark:border-slate-700">
        <CardContent className="px-4 py-3">
          <p className="text-xs text-muted-foreground mb-0.5">Registros</p>
          <p className="text-xl font-bold text-slate-700 dark:text-slate-200">
            {totalRegistros.toLocaleString("es-PE")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── fila de la tabla ─────────────────────────────────────── */
function UpsellRow({ item }: { item: CcUpsellRecordItem }) {
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
      <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
        {formatDate(item.createdAt)}
      </td>
      <td className="px-3 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
        {item.orderNumber}
      </td>
      <td className="px-3 py-2.5 text-xs text-slate-700 dark:text-slate-300 max-w-[200px] truncate">
        <span title={item.productName}>{item.productName}</span>
        {item.sku && (
          <span className="ml-1.5 text-muted-foreground font-normal">
            ({item.sku})
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs text-center text-slate-700 dark:text-slate-300">
        {item.quantity}
      </td>
      <td className="px-3 py-2.5 text-xs text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">
        {formatPEN(item.unitPrice)}
      </td>
      <td className="px-3 py-2.5 text-xs text-right font-semibold text-violet-700 dark:text-violet-300 whitespace-nowrap">
        {formatPEN(item.subtotal)}
      </td>
      <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
        {item.addedByName ?? <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
        {item.sellerName ?? <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
        {cleanShopName(item.shop)}
      </td>
    </tr>
  );
}

/* ── skeleton ─────────────────────────────────────────────── */
function TableSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-slate-100 dark:bg-slate-800" />
        ))}
      </div>
      <div className="h-52 rounded-lg bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}

/* ── componente principal ─────────────────────────────────── */
interface Props {
  storeId: string;
  range: DateRange;
}

export function CcUpsellRecordsTable({ storeId, range }: Props) {
  const { data, isLoading, isError } = useUpsellRecords(storeId, range);

  const header = (
    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
      Detalle de Upsell
    </h3>
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {header}
        <TableSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3">
        {header}
        <p className="text-sm text-red-500 dark:text-red-400">
          Error al cargar el detalle de upsell. Intentá de nuevo.
        </p>
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <div className="space-y-3">
        {header}
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
          <PackageSearch className="h-8 w-8 opacity-40" />
          <p className="text-sm">Sin registros de upsell para el período seleccionado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}

      {/* Totales */}
      <TotalesCards
        totalMonto={data.totalMonto}
        totalUnidades={data.totalUnidades}
        totalRegistros={data.totalRegistros}
      />

      {/* Tabla */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50">
        <table className="min-w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30">
              <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Fecha
              </th>
              <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Nro. orden
              </th>
              <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
                Producto
              </th>
              <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center whitespace-nowrap">
                Cant.
              </th>
              <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 text-right whitespace-nowrap">
                Precio unit.
              </th>
              <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 text-right whitespace-nowrap">
                Subtotal
              </th>
              <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Quien agregó
              </th>
              <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Vendedor pedido
              </th>
              <th className="px-3 py-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Tienda
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
            {data.items.map((item) => (
              <UpsellRow key={item.id} item={item} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
