"use client";

import { useState } from "react";
import { Info, MessageCircle, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { YAPES_PENDIENTES, money } from "../_lib/mock-data";

/* -----------------------------------------------------------------------
   Validar Yapes — solo aplica al Yape directo (manual, sin comisión). Al
   confirmar, el saldo se actualiza y se activa el código del cliente
   (§7.2 de la especificación). Powip no interviene en la validación.
------------------------------------------------------------------------ */

export default function ValidarYapesTab() {
  const [resueltos, setResueltos] = useState<Set<string>>(new Set());

  const resolver = (orden: string, accion: "Confirmado" | "Rechazado") => {
    setResueltos((prev) => new Set(prev).add(orden));
    toast.success(`${orden}: comprobante ${accion.toLowerCase()}`);
  };

  const pendientes = YAPES_PENDIENTES.filter((r) => !resueltos.has(r.orden));

  return (
    <div className="space-y-4">
      <div className="flex gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-500/30 dark:bg-blue-500/10">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" />
        <p className="text-blue-900 dark:text-blue-200">
          Powip <b>no interviene</b>. Al confirmar, se actualiza el saldo y se <b>activa el código</b> del cliente.
        </p>
      </div>

      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Orden</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Comprobante</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendientes.map((r) => (
                <TableRow key={r.orden}>
                  <TableCell className="font-medium">{r.orden}</TableCell>
                  <TableCell>{r.cliente}</TableCell>
                  <TableCell className="text-right font-medium">{money(r.monto)}</TableCell>
                  <TableCell>{r.hora}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                      <Receipt className="h-3.5 w-3.5" />
                      captura.jpg
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" className="bg-teal-600 text-white hover:bg-teal-700" onClick={() => resolver(r.orden, "Confirmado")}>
                        Confirmar
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => resolver(r.orden, "Rechazado")}>
                        Rechazar
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="bg-green-500 text-white border-green-600 hover:bg-green-600"
                        title="WhatsApp"
                        onClick={() => toast.info(`Abrir WhatsApp con ${r.cliente}`)}
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {pendientes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    No hay comprobantes pendientes de revisión
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
