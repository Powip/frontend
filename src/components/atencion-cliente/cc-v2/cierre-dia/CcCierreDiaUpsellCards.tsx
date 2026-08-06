"use client";

import { Card, CardContent } from "@/components/ui/card";
import { CierreDiaUpsellSummary } from "@/services/cierreDiaProductosService";
import { formatCurrency, formatPct } from "./cierreDiaUtils";

interface Props {
  summary: CierreDiaUpsellSummary | undefined;
  isLoading: boolean;
}

function Tile({
  label, value, sub, highlight,
}: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-violet-200 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-950/20" : ""}>
      <CardContent className="py-3 px-3.5">
        <p className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
        <p className={`text-xl font-extrabold ${highlight ? "text-violet-700 dark:text-violet-300" : ""}`}>{value}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

export function CcCierreDiaUpsellCards({ summary, isLoading }: Props) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
        🛍 Upsells del día · productos agregados al pedido durante confirmación
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading || !summary ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-3 px-3.5">
                <div className="h-3 w-20 bg-muted rounded animate-pulse mb-2" />
                <div className="h-6 w-16 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Tile
              label="Pedidos con upsell"
              value={String(summary.pedidosConUpsell)}
              sub={`de ${summary.pedidosConfirmados} confirmados · ${formatPct(summary.pctConversion)} conversión`}
              highlight
            />
            <Tile
              label="Ingreso extra (upsell)"
              value={formatCurrency(summary.ingresoExtra)}
              sub={
                summary.pedidosConUpsell
                  ? `${formatCurrency(summary.ingresoExtra / summary.pedidosConUpsell)} promedio por upsell`
                  : "sin upsells registrados"
              }
              highlight
            />
            <Tile
              label="Ticket sin upsell"
              value={formatCurrency(summary.ticketSinUpsell)}
              sub="promedio pedido base"
            />
            <Tile
              label="Ticket con upsell"
              value={formatCurrency(summary.ticketConUpsell)}
              sub={`${summary.pctIncremento >= 0 ? "+" : ""}${formatPct(summary.pctIncremento)} vs pedido base`}
            />
          </>
        )}
      </div>
    </div>
  );
}
