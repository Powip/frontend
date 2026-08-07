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
import { Badge } from "@/components/ui/badge";
import { RendicionRepartidor } from "./types";
import { formatDate, money } from "./utils";

/** Drill-down "Ver detalle" de una rendición — desglose por guía/pedido. */
export function DetalleRendicionModal({
  rendicion,
  onOpenChange,
}: {
  rendicion: RendicionRepartidor | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!rendicion} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {rendicion && (
          <>
            <DialogHeader>
              <DialogTitle>Rendición · {rendicion.repartidor}</DialogTitle>
              <p className="text-sm text-muted-foreground">
                {formatDate(rendicion.fecha)} · {rendicion.pedidosEntregados} pedidos
              </p>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/20 p-4">
              <div>
                <div className="text-xs text-muted-foreground">Debió cobrar</div>
                <div className="text-lg font-bold">{money(rendicion.debioCobrar)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Entregó efectivo</div>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                  {money(rendicion.entregoEfectivo)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  {rendicion.diferencia === 0 ? "Cuadrado" : "Faltante"}
                </div>
                <div
                  className={`text-lg font-bold ${
                    rendicion.diferencia === 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {rendicion.diferencia === 0 ? "S/ 0.00" : money(rendicion.diferencia)}
                </div>
              </div>
            </div>

            <div>
              <h5 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Detalle por guía / pedido
              </h5>
              {rendicion.detalle && rendicion.detalle.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead>Guía</TableHead>
                        <TableHead>Pedido</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead className="text-right">Debió cobrar</TableHead>
                        <TableHead className="text-right">Cobró</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rendicion.detalle.map((d) => (
                        <TableRow
                          key={d.pedido}
                          className={!d.ok ? "bg-red-50 dark:bg-red-500/10" : ""}
                        >
                          <TableCell className="text-xs text-muted-foreground">{d.guia ?? "—"}</TableCell>
                          <TableCell className="font-semibold">{d.pedido}</TableCell>
                          <TableCell>{d.cliente}</TableCell>
                          <TableCell className="text-right">{money(d.debioCobrar)}</TableCell>
                          <TableCell
                            className={`text-right ${
                              d.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {money(d.cobro)}
                          </TableCell>
                          <TableCell>
                            {d.ok ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                              >
                                OK
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-red-200 bg-red-50 text-[10px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                                title={d.motivo}
                              >
                                {d.motivo ?? "Faltante"}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground">
                  Sin detalle por pedido disponible para esta rendición — solo se registró el
                  total ({rendicion.pedidosEntregados} pedidos).
                </div>
              )}
            </div>

            {rendicion.observaciones && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
                <span>⚠️</span>
                <span>{rendicion.observaciones}</span>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
