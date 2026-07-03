"use client";

import { DateRange } from "react-day-picker";
import { useCcStorePerformance } from "@/hooks/useCcStorePerformance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/* ── helper: limpieza de nombre de tienda ─────────────── */
function cleanShopName(shop: string | null): string {
  if (!shop) return "Sin identificar";

  let name = shop.trim().toLowerCase();

  // Quitar protocolo si hubiera
  name = name.replace(/^https?:\/\//, "");

  // Quitar www.
  name = name.replace(/^www\./, "");

  // Quitar sufijo .myshopify.com
  name = name.replace(/\.myshopify\.com$/, "");

  // Tomar el primer label antes del primer punto
  const firstLabel = name.split(".")[0];

  // Capitalizar primera letra
  return firstLabel.charAt(0).toUpperCase() + firstLabel.slice(1);
}

/* ── componente ──────────────────────────────────────── */
interface Props {
  storeId: string;
  range: DateRange;
}

export function CcStorePerformanceCard({ storeId, range }: Props) {
  const { data, isLoading, isError } = useCcStorePerformance(storeId, range);

  return (
    <Card className="border-0 shadow-sm bg-slate-50 dark:bg-slate-800/50 h-full">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Rendimiento por Tienda
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {isError && (
          <p className="text-sm text-red-500 dark:text-red-400">
            Error al cargar el rendimiento por tienda. Intentá de nuevo.
          </p>
        )}

        {isLoading ? (
          <div className="space-y-4 mt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <div className="h-3 w-24 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
                  <div className="h-3 w-16 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
                </div>
                <div className="h-2 w-full bg-gray-200 dark:bg-slate-700 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-2">
            Sin datos de tiendas en el período.
          </p>
        ) : (
          <div className="space-y-4 mt-2">
            {data.map((item, idx) => {
              const name = cleanShopName(item.shop);
              const pct  = Math.min(Math.max(item.tasaConversion, 0), 100);

              return (
                <div key={item.shop ?? `sin-id-${idx}`} className="space-y-1.5">
                  {/* Fila de etiquetas */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-col min-w-0 max-w-[55%]">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                        {name}
                      </span>
                      {item.shop !== null && (
                        <span className="text-xs text-muted-foreground truncate">
                          {item.shop}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {pct.toFixed(1)}%
                      </span>
                      {" · "}
                      {item.confirmados}/{item.ingresados}
                    </span>
                  </div>

                  {/* Barra de progreso */}
                  <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-2 rounded-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
