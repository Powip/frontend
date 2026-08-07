"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { GuiaPorLiquidar } from "./types";
import { formatDate, money } from "./utils";

/**
 * Mini modal "Ver detalle" de un pedido desde Por Liquidar — desglose de
 * cobro/comisión/flete/neto de ese pedido puntual. Equivalente al modal
 * "Pedido ORD-…" del mockup, pero sin inventar un saldo de cliente (no hay
 * campo real de "cuánto cobró el courier en la puerta" — ver BACKEND GAP en
 * types.ts / informe final).
 */
export function DetallePedidoModal({
  guia,
  onOpenChange,
}: {
  guia: GuiaPorLiquidar | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!guia} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {guia && (
          <>
            <DialogHeader>
              <DialogTitle>Pedido {guia.id}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {guia.cliente} · {guia.courier} · entregado {formatDate(guia.entregadoAt)}
              </p>
            </DialogHeader>

            <div className="rounded-lg border bg-muted/20 p-4">
              <Kv label="Total pedido" value={money(guia.codBruto)} />
              <Kv label="Adelanto del cliente" value={`− ${money(guia.adelantos)}`} tone="pos" />
              <Kv label="Cobró el courier (saldo COD)" value={money(guia.codNeto)} />
              <Kv label={`Comisión ${guia.courier}`} value={`− ${money(guia.comision)}`} tone="neg" />
              <Kv label="Flete" value={`− ${money(guia.flete)}`} tone="neg" />
              <Kv label="Neto a recibir" value={money(guia.neto)} big />
            </div>

            {guia.entregaParcial && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-500/40 dark:text-amber-300">
                  Entrega parcial
                </Badge>
                <span>{guia.entregaParcial.motivo}</span>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Kv({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
  big?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-dashed py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`font-semibold ${big ? "text-base font-bold" : ""} ${
          tone === "pos"
            ? "text-emerald-600 dark:text-emerald-400"
            : tone === "neg"
            ? "text-red-600 dark:text-red-400"
            : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
