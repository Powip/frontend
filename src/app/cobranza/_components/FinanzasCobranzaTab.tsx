"use client";

import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGOS_MANUALES } from "../_lib/mock-data";

/* -----------------------------------------------------------------------
   Finanzas · Pagos manuales — Mercado Pago se aprueba solo por webhook y no
   pasa por acá (§7.1). Esta tabla es para los métodos manuales: Yape, Plin,
   Pago Link, Efectivo y Transferencia (regla §10.2: solo MP genera 0.5%).
------------------------------------------------------------------------ */

export default function FinanzasCobranzaTab() {
  const pendientes = PAGOS_MANUALES.filter((p) => p.estado === "Pendiente").length;

  return (
    <div className="space-y-4">
      <div className="flex gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-500/30 dark:bg-blue-500/10">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" />
        <p className="text-blue-900 dark:text-blue-200">
          <b>Mercado Pago se aprueba automáticamente</b> vía webhook. Solo entran aquí los manuales: Yape, Plin, Pago
          Link, Efectivo y Transferencia.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3">
          <div className="text-sm font-semibold">
            Pagos pendientes <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{pendientes}</span>
          </div>
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Orden</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Código op.</TableHead>
                  <TableHead>Región</TableHead>
                  <TableHead>Courier</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {PAGOS_MANUALES.map((p) => (
                  <TableRow key={p.orden}>
                    <TableCell className="font-medium">{p.orden}</TableCell>
                    <TableCell>{p.cliente}</TableCell>
                    <TableCell>{p.telefono}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.canal}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.metodo}</Badge>
                    </TableCell>
                    <TableCell className={p.codigoOp === "—" ? "text-muted-foreground" : "font-medium"}>{p.codigoOp}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{p.region}</Badge>
                    </TableCell>
                    <TableCell className={p.courier === "—" ? "text-muted-foreground" : ""}>{p.courier}</TableCell>
                    <TableCell>
                      {p.estado === "Aprobado MP" ? (
                        <Badge className="border bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30">
                          Aprobado MP
                        </Badge>
                      ) : (
                        <Badge className="border bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30">
                          Pendiente
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
