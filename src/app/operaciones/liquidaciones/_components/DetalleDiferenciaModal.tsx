"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DiferenciaLiquidacion, PagoLiquidacion } from "./types";
import { formatDate, money } from "./utils";

/**
 * Drill-down "Ver detalle" de una diferencia — pedidos que cubría el
 * depósito que la generó. A diferencia del mockup, esto NO reparte el
 * faltante entre pedidos individuales: el courier deposita un monto único
 * por el lote completo y no dice a cuál pedido corresponde el faltante, así
 * que inventar ese desglose sería mostrar precisión falsa. Se deja explícito
 * en el aviso del modal — ver informe final para lo que se necesitaría del
 * courier/backend para poder ubicarlo con certeza.
 */
export function DetalleDiferenciaModal({
  diferencia,
  pagoOrigen,
  onOpenChange,
}: {
  diferencia: DiferenciaLiquidacion | null;
  pagoOrigen: PagoLiquidacion | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!diferencia} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {diferencia && (
          <>
            <DialogHeader>
              <DialogTitle>Diferencia {diferencia.id}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {diferencia.courier} · {formatDate(diferencia.fecha)} · liquidación{" "}
                {diferencia.pagoLiquidacionId}
              </p>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-3 rounded-lg border bg-red-50/60 p-4 dark:bg-red-500/5">
              <div>
                <div className="text-xs text-muted-foreground">Esperado</div>
                <div className="text-lg font-bold">{money(diferencia.montoEsperado)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Depositado</div>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                  {money(diferencia.montoDepositado)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Diferencia</div>
                <div className="text-lg font-bold text-red-600 dark:text-red-400">
                  {money(diferencia.diferencia)}
                </div>
              </div>
            </div>

            <div>
              <h5 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Pedido(s) cubiertos por ese depósito
              </h5>
              {pagoOrigen?.detalle && pagoOrigen.detalle.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Neto esperado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagoOrigen.detalle.map((d) => (
                        <TableRow key={d.pedido}>
                          <TableCell className="font-semibold">{d.pedido}</TableCell>
                          <TableCell>{d.cliente}</TableCell>
                          <TableCell className="text-right">{money(d.neto)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                  Pedidos: {diferencia.pedidosIds.join(", ")}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                El faltante es del depósito completo — el courier no especifica a cuál pedido
                corresponde, así que no se reparte entre ellos.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
