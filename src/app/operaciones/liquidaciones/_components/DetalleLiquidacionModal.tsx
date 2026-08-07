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
import { METODO_PAGO_LABEL, PagoLiquidacion } from "./types";
import { formatDate, money } from "./utils";

/** Drill-down "Ver detalle" del histórico — qué pedidos cubrió el depósito. */
export function DetalleLiquidacionModal({
  pago,
  onOpenChange,
}: {
  pago: PagoLiquidacion | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!pago} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {pago && (
          <>
            <DialogHeader>
              <DialogTitle>Liquidación {pago.id}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {pago.courier} · {formatDate(pago.fecha)} · {METODO_PAGO_LABEL[pago.metodo]}
                {pago.numeroOperacion ? ` ${pago.numeroOperacion}` : ""}
              </p>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-3 rounded-lg border bg-emerald-50/60 p-4 dark:bg-emerald-500/5">
              <div>
                <div className="text-xs text-muted-foreground">Esperado</div>
                <div className="text-lg font-bold">{money(pago.montoEsperado)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Depositado</div>
                <div className="text-lg font-bold">{money(pago.montoDepositado)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Diferencia</div>
                <div
                  className={`text-lg font-bold ${
                    pago.diferencia === 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {pago.diferencia === 0 ? "S/ 0.00 · Conciliada" : money(pago.diferencia)}
                </div>
              </div>
            </div>

            <div>
              <h5 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Pedidos que cubrió este depósito
              </h5>
              {pago.detalle && pago.detalle.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Cobró</TableHead>
                        <TableHead className="text-right">Comisión</TableHead>
                        <TableHead className="text-right">Flete</TableHead>
                        <TableHead className="text-right">Neto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pago.detalle.map((d) => (
                        <TableRow key={d.pedido}>
                          <TableCell className="font-semibold">{d.pedido}</TableCell>
                          <TableCell>{d.cliente}</TableCell>
                          <TableCell className="text-right">{money(d.cobro)}</TableCell>
                          <TableCell className="text-right text-red-600 dark:text-red-400">
                            -{money(d.comision)}
                          </TableCell>
                          <TableCell className="text-right text-red-600 dark:text-red-400">
                            -{money(d.flete)}
                          </TableCell>
                          <TableCell className="text-right font-bold">{money(d.neto)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                  Sin desglose por pedido disponible para esta liquidación — solo se registró el
                  total. Pedidos cubiertos: {pago.pedidosIds.join(", ")}.
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
