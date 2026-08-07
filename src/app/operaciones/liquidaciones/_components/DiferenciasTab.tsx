"use client";

import { useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DiferenciaLiquidacion, PagoLiquidacion } from "./types";
import { formatDate, money } from "./utils";
import { DetalleDiferenciaModal } from "./DetalleDiferenciaModal";

const ESTADO_BADGE: Record<DiferenciaLiquidacion["estado"], string> = {
  ABIERTA:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  RECLAMADA:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
  ACEPTADA_PERDIDA:
    "border-muted bg-muted text-muted-foreground",
};

const ESTADO_LABEL: Record<DiferenciaLiquidacion["estado"], string> = {
  ABIERTA: "Abierta",
  RECLAMADA: "Reclamada al courier",
  ACEPTADA_PERDIDA: "Aceptada como pérdida",
};

/**
 * Pedidos donde lo depositado no coincidió con lo esperado. Se alimenta de
 * `mockData.ts` + lo que genera automáticamente RegistrarLiquidacionModal
 * cuando hay diferencia. BACKEND GAP: no existe endpoint para "reclamar al
 * courier" ni "aceptar como pérdida" — hoy solo cambia el estado local.
 */
export function DiferenciasTab({
  diferencias,
  liquidaciones,
  onUpdate,
}: {
  diferencias: DiferenciaLiquidacion[];
  liquidaciones: PagoLiquidacion[];
  onUpdate: (diferencia: DiferenciaLiquidacion) => void;
}) {
  const [aceptando, setAceptando] = useState<DiferenciaLiquidacion | null>(null);
  const [motivo, setMotivo] = useState("");
  const [detalle, setDetalle] = useState<DiferenciaLiquidacion | null>(null);

  const sorted = [...diferencias].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  const reclamar = (d: DiferenciaLiquidacion) => {
    // BACKEND GAP: no hay endpoint para notificar al courier — hoy solo se
    // cambia el estado local y se avisa por toast.
    onUpdate({ ...d, estado: "RECLAMADA" });
    toast.success(`Diferencia ${d.id} marcada como reclamada al courier`);
  };

  const confirmarAceptar = () => {
    if (!aceptando) return;
    onUpdate({ ...aceptando, estado: "ACEPTADA_PERDIDA", motivoAceptacion: motivo || undefined });
    toast.success(`Diferencia ${aceptando.id} aceptada como pérdida`);
    setAceptando(null);
    setMotivo("");
  };

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-base">Diferencias entre lo esperado y lo depositado</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sorted.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sin diferencias registradas 🎉</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Courier</TableHead>
                    <TableHead>Pedido(s)</TableHead>
                    <TableHead className="text-right">Esperado</TableHead>
                    <TableHead className="text-right">Depositado</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-xs">{d.id}</TableCell>
                      <TableCell>{formatDate(d.fecha)}</TableCell>
                      <TableCell className="font-medium">{d.courier}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => setDetalle(d)}>
                          {d.pedidosIds.length} pedido{d.pedidosIds.length === 1 ? "" : "s"} ▾
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">{money(d.montoEsperado)}</TableCell>
                      <TableCell className="text-right">{money(d.montoDepositado)}</TableCell>
                      <TableCell className="text-right font-bold text-red-600 dark:text-red-400">
                        {money(d.diferencia)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ESTADO_BADGE[d.estado]}>
                          {ESTADO_LABEL[d.estado]}
                        </Badge>
                        {d.estado === "ACEPTADA_PERDIDA" && d.motivoAceptacion && (
                          <div className="mt-1 max-w-[200px] truncate text-[11px] text-muted-foreground" title={d.motivoAceptacion}>
                            {d.motivoAceptacion}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {d.estado === "ABIERTA" && (
                          <div className="flex justify-end gap-1.5">
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => reclamar(d)}>
                              Reclamar al courier
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => setAceptando(d)}
                            >
                              Aceptar diferencia
                            </Button>
                          </div>
                        )}
                        {d.estado === "RECLAMADA" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setAceptando(d)}
                          >
                            Aceptar diferencia
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!aceptando} onOpenChange={(o) => !o && setAceptando(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aceptar diferencia como pérdida</DialogTitle>
            <DialogDescription>
              {aceptando && (
                <>
                  Se castigará {money(aceptando.diferencia)} de la diferencia con {aceptando.courier} como
                  pérdida. Esta acción no se puede deshacer desde acá.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="motivo-perdida">Motivo *</Label>
            <Textarea
              id="motivo-perdida"
              maxLength={400}
              placeholder="Ej. courier confirmó extravío, no hay forma de recuperar el monto"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAceptando(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={!motivo.trim()} onClick={confirmarAceptar}>
              Confirmar pérdida
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DetalleDiferenciaModal
        diferencia={detalle}
        pagoOrigen={liquidaciones.find((l) => l.id === detalle?.pagoLiquidacionId) ?? null}
        onOpenChange={(o) => !o && setDetalle(null)}
      />
    </>
  );
}
