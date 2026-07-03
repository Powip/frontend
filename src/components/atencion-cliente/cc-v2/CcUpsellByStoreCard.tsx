"use client";

import { DateRange } from "react-day-picker";
import { useCcUpsell } from "@/hooks/useCcUpsell";
import { CcUpsellTiendaItem, CcUpsellConsolidado } from "@/interfaces/IOrder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

/* ── helpers ─────────────────────────────────────────── */
function formatPEN(value: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(value);
}

function cleanShopName(shop: string | null): string {
  if (!shop) return "Sin identificar";
  const name = shop.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\.myshopify\.com$/, "");
  const first = name.split(".")[0];
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/* ── tarjeta individual de tienda ────────────────────── */
interface TiendaCardProps {
  item: CcUpsellTiendaItem;
}

function TiendaUpsellCard({ item }: TiendaCardProps) {
  const shopName = cleanShopName(item.shop);

  return (
    <Card className="border border-slate-200 dark:border-slate-700 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
              {shopName}
            </CardTitle>
            {item.shop !== null && (
              <p className="text-xs text-muted-foreground truncate">{item.shop}</p>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
            +{item.pctIncremento.toFixed(1)}%
          </span>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* Upsell monto destacado */}
        <div className="rounded-lg bg-violet-50 dark:bg-violet-950/30 px-3 py-2">
          <p className="text-xs text-muted-foreground mb-0.5">Upsell generado</p>
          <p className="text-xl font-bold text-violet-700 dark:text-violet-300">
            {formatPEN(item.upsellMonto)}
          </p>
          <p className="text-xs text-muted-foreground">
            {item.upsellUnidades} unidad{item.upsellUnidades !== 1 ? "es" : ""}
          </p>
        </div>

        {/* Grid de métricas */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5">
            <p className="text-muted-foreground">Confirmados</p>
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              {item.pedidosConfirmados}
            </p>
          </div>
          <div className="rounded bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1.5">
            <p className="text-muted-foreground">Con upsell</p>
            <p className="font-semibold text-emerald-700 dark:text-emerald-300">
              {item.conUpsell}{" "}
              <span className="font-normal text-muted-foreground">
                ({item.pctConUpsell.toFixed(1)}%)
              </span>
            </p>
          </div>
          <div className="rounded bg-slate-50 dark:bg-slate-800/50 px-2 py-1.5">
            <p className="text-muted-foreground">Fact. base</p>
            <p className="font-semibold text-slate-700 dark:text-slate-200 truncate">
              {formatPEN(item.facturacionBase)}
            </p>
          </div>
          <div className="rounded bg-amber-50 dark:bg-amber-950/30 px-2 py-1.5">
            <p className="text-muted-foreground">Ticket base</p>
            <p className="font-semibold text-amber-700 dark:text-amber-300 truncate">
              {formatPEN(item.ticketBase)}
            </p>
          </div>
        </div>

        {/* Ticket base → con upsell */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Ticket:</span>
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {formatPEN(item.ticketBase)}
          </span>
          <TrendingUp className="h-3 w-3 text-emerald-500" />
          <span className="font-semibold text-emerald-700 dark:text-emerald-300">
            {formatPEN(item.ticketConUpsell)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── tarjeta consolidada ─────────────────────────────── */
interface ConsolidadoCardProps {
  data: CcUpsellConsolidado;
}

function ConsolidadoCard({ data }: ConsolidadoCardProps) {
  return (
    <Card
      className="border-0 shadow-md text-white"
      style={{ backgroundColor: "#1A1D2E" }}
    >
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
            Consolidado total
          </CardTitle>
          <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-semibold text-violet-300">
            +{data.pctIncremento.toFixed(1)}% ticket
          </span>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-3">
        {/* Upsell total destacado */}
        <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 px-3 py-2">
          <p className="text-xs text-slate-400 mb-0.5">Upsell total generado</p>
          <p className="text-2xl font-bold text-violet-300">
            {formatPEN(data.upsellMonto)}
          </p>
          <p className="text-xs text-slate-400">
            {data.upsellUnidades} unidad{data.upsellUnidades !== 1 ? "es" : ""} ·{" "}
            {data.pctSobreBase.toFixed(1)}% sobre facturación base
          </p>
        </div>

        {/* Grid métricas */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded bg-white/5 px-2 py-1.5">
            <p className="text-slate-400">Confirmados</p>
            <p className="font-semibold text-slate-200">{data.pedidosConfirmados}</p>
          </div>
          <div className="rounded bg-white/5 px-2 py-1.5">
            <p className="text-slate-400">Con upsell</p>
            <p className="font-semibold text-violet-300">
              {data.conUpsell}{" "}
              <span className="font-normal text-slate-400">
                ({data.pctConUpsell.toFixed(1)}%)
              </span>
            </p>
          </div>
          <div className="rounded bg-white/5 px-2 py-1.5">
            <p className="text-slate-400">Fact. base</p>
            <p className="font-semibold text-slate-200 truncate">
              {formatPEN(data.facturacionBase)}
            </p>
          </div>
          <div className="rounded bg-white/5 px-2 py-1.5">
            <p className="text-slate-400">Ticket base</p>
            <p className="font-semibold text-amber-300 truncate">
              {formatPEN(data.ticketBase)}
            </p>
          </div>
        </div>

        {/* Ticket base → con upsell */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Ticket:</span>
          <span className="font-medium text-slate-300">{formatPEN(data.ticketBase)}</span>
          <TrendingUp className="h-3 w-3 text-emerald-400" />
          <span className="font-semibold text-emerald-300">{formatPEN(data.ticketConUpsell)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── componente principal (controlado por range) ─────── */
interface Props {
  storeId: string;
  range: DateRange;
}

export function CcUpsellByStoreCard({ storeId, range }: Props) {
  const { data, isLoading, isError } = useCcUpsell(storeId, range);

  // Ordenar tiendas por upsellMonto desc
  const tiendas = data
    ? [...data.tiendas].sort((a, b) => b.upsellMonto - a.upsellMonto)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
          Upsell por Tienda
        </h3>
        {data && (
          <span className="text-xs text-muted-foreground">
            {data.tiendas.length} tienda{data.tiendas.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {isError && (
        <p className="text-sm text-red-500 dark:text-red-400">
          Error al cargar datos de upsell. Intentá de nuevo.
        </p>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-52 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"
            />
          ))}
        </div>
      ) : !data || tiendas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sin datos de upsell para el período seleccionado.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {tiendas.map((item, idx) => (
            <TiendaUpsellCard key={item.shop ?? `sin-id-${idx}`} item={item} />
          ))}
          {/* Tarjeta consolidada al final */}
          <ConsolidadoCard data={data.consolidado} />
        </div>
      )}
    </div>
  );
}
