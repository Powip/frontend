"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { METODO_PAGO_LABEL, PagoLiquidacion } from "./types";
import { formatDate, money } from "./utils";
import { DetalleLiquidacionModal } from "./DetalleLiquidacionModal";

/**
 * Histórico de depósitos ya registrados. Fuente: estado local de la sesión
 * (mock inicial en mockData.ts + lo que se va registrando desde "Por
 * Liquidar"). BACKEND GAP: no hay ningún endpoint de listado — ver informe
 * final.
 */
export function LiquidacionesTab({ liquidaciones }: { liquidaciones: PagoLiquidacion[] }) {
  const [detalle, setDetalle] = useState<PagoLiquidacion | null>(null);
  const sorted = [...liquidaciones].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-base">Histórico de liquidaciones</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sorted.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Todavía no se registró ninguna liquidación.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Courier</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Esperado</TableHead>
                    <TableHead className="text-right">Depositado</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>N° Operación</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{l.id}</TableCell>
                      <TableCell>{formatDate(l.fecha)}</TableCell>
                      <TableCell className="font-medium">{l.courier}</TableCell>
                      <TableCell className="text-right">{l.pedidosIds.length}</TableCell>
                      <TableCell className="text-right">{money(l.montoEsperado)}</TableCell>
                      <TableCell className="text-right">{money(l.montoDepositado)}</TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          l.diferencia === 0
                            ? "text-muted-foreground"
                            : l.diferencia > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {l.diferencia === 0 ? "—" : money(l.diferencia)}
                      </TableCell>
                      <TableCell>{METODO_PAGO_LABEL[l.metodo]}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.numeroOperacion ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            l.estado === "CONCILIADA"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                              : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                          }
                        >
                          {l.estado === "CONCILIADA" ? "Conciliada" : "Con diferencia"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDetalle(l)}>
                          Ver detalle
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <DetalleLiquidacionModal pago={detalle} onOpenChange={(o) => !o && setDetalle(null)} />
    </>
  );
}
