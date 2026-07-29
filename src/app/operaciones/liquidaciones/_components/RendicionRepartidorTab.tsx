"use client";

import { useMemo, useState } from "react";
import { Wallet, AlertTriangle, CheckCircle2 } from "lucide-react";
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
import { RendicionRepartidor } from "./types";
import { formatDate, money } from "./utils";
import { RegistrarRendicionModal } from "./RegistrarRendicionModal";

const ESTADO_BADGE: Record<RendicionRepartidor["estado"], string> = {
  POR_RENDIR:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  CUADRADO:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  FALTANTE:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
};

const ESTADO_LABEL: Record<RendicionRepartidor["estado"], string> = {
  POR_RENDIR: "Por rendir",
  CUADRADO: "Cuadrado",
  FALTANTE: "Faltante",
};

/**
 * Cuadre de caja diario para motorizado propio. Sin comisión de courier, a
 * diferencia de las otras 3 pestañas. 100% datos de prueba — ver BACKEND
 * GAP en types.ts (OrderHeader no tiene campo de repartidor asignado).
 */
export function RendicionRepartidorTab({
  rendiciones,
  onRegistrar,
}: {
  rendiciones: RendicionRepartidor[];
  onRegistrar: (rendicion: RendicionRepartidor) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  const pendientes = useMemo(
    () => rendiciones.filter((r) => r.estado === "POR_RENDIR"),
    [rendiciones],
  );

  const kpis = useMemo(() => {
    const porRendir = pendientes.reduce((s, r) => s + r.debioCobrar, 0);
    const faltantes = rendiciones.filter((r) => r.estado === "FALTANTE");
    const totalFaltante = faltantes.reduce((s, r) => s + Math.abs(r.diferencia), 0);
    return { porRendir, cantPendientes: pendientes.length, cantFaltantes: faltantes.length, totalFaltante };
  }, [pendientes, rendiciones]);

  const sorted = [...rendiciones].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-l-4 border-l-amber-500 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <Wallet className="h-4 w-4" /> Por rendir hoy
          </div>
          <div className="mt-2 text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {money(kpis.porRendir)}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {kpis.cantPendientes} repartidor{kpis.cantPendientes === 1 ? "" : "es"} sin cerrar
          </div>
        </div>
        <div className="rounded-xl border border-l-4 border-l-red-500 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4" /> Faltantes
          </div>
          <div className="mt-2 text-2xl font-extrabold text-red-600 dark:text-red-400">
            {money(kpis.totalFaltante)}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {kpis.cantFaltantes} rendición{kpis.cantFaltantes === 1 ? "" : "es"} con diferencia
          </div>
        </div>
        <div className="rounded-xl border border-l-4 border-l-emerald-500 bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4" /> Cuadradas (histórico)
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {rendiciones.filter((r) => r.estado === "CUADRADO").length}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">Sin diferencia registrada</div>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b py-4">
          <CardTitle className="text-base">Rendición por repartidor</CardTitle>
          <Button size="sm" onClick={() => setModalOpen(true)}>
            Registrar rendición
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {sorted.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Sin rendiciones registradas.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Repartidor</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead className="text-right">Pedidos</TableHead>
                    <TableHead className="text-right">Debió cobrar</TableHead>
                    <TableHead className="text-right">Entregó efectivo</TableHead>
                    <TableHead className="text-right">Diferencia</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Observaciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((r) => (
                    <TableRow
                      key={r.id}
                      className={r.estado === "FALTANTE" ? "bg-red-50 dark:bg-red-500/10" : ""}
                    >
                      <TableCell className="font-medium">{r.repartidor}</TableCell>
                      <TableCell>{formatDate(r.fecha)}</TableCell>
                      <TableCell className="text-right">{r.pedidosEntregados}</TableCell>
                      <TableCell className="text-right">{money(r.debioCobrar)}</TableCell>
                      <TableCell className="text-right">{money(r.entregoEfectivo)}</TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          r.diferencia === 0 ? "text-muted-foreground" : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {r.diferencia === 0 ? "—" : money(r.diferencia)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ESTADO_BADGE[r.estado]}>
                          {ESTADO_LABEL[r.estado]}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={r.observaciones}>
                        {r.observaciones ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <RegistrarRendicionModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        pendientes={pendientes}
        onRegistrar={onRegistrar}
      />
    </div>
  );
}
