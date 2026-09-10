"use client";

import { Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { CODIGOS_ENTREGA, CODIGOS_KPIS, EstadoCodigo, money } from "../_lib/mock-data";

/* -----------------------------------------------------------------------
   Códigos de entrega — nacen/activan solo cuando el pago pasa a "pagado"
   (regla de negocio §10.1). El repartidor los valida en su portal para
   marcar el pedido como entregado.
------------------------------------------------------------------------ */

const ESTADO_BADGE: Record<EstadoCodigo, string> = {
  activo: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
  validado: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30",
  en_camino: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30",
  expirado: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30",
};

const ESTADO_LABEL: Record<EstadoCodigo, string> = {
  activo: "Activo",
  validado: "Validado",
  en_camino: "En camino",
  expirado: "Expirado",
};

export default function CodigosEntregaTab() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => toast.info("Exportar — pendiente de integración")}>
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Activos" value={CODIGOS_KPIS.activos} sub="Con pago MP" color="teal" />
        <Kpi label="Validados hoy" value={CODIGOS_KPIS.validadosHoy} sub="Entregas OK" color="green" />
        <Kpi label="En camino" value={CODIGOS_KPIS.enCamino} sub="Sin validar" color="amber" />
        <Kpi label="Expirados" value={CODIGOS_KPIS.expirados} sub="+7 días" color="red" />
      </div>

      <div className="flex gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-500/30 dark:bg-blue-500/10">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-blue-300" />
        <p className="text-blue-900 dark:text-blue-200">
          <b>El código se genera y activa al pagar.</b> Los pagos Yape y COD también activan código al confirmarse;
          sin pago no hay código.
        </p>
      </div>

      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Orden</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Validado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {CODIGOS_ENTREGA.map((r) => (
                <TableRow key={r.codigo}>
                  <TableCell className="font-mono font-semibold tracking-wider">{r.codigo}</TableCell>
                  <TableCell className="font-medium">{r.orden}</TableCell>
                  <TableCell>{r.cliente}</TableCell>
                  <TableCell className="text-right">{money(r.monto)}</TableCell>
                  <TableCell>
                    <Badge className={`border ${ESTADO_BADGE[r.estado]}`}>{ESTADO_LABEL[r.estado]}</Badge>
                  </TableCell>
                  <TableCell className={r.validadoA === "—" ? "text-muted-foreground" : ""}>{r.validadoA}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

const KPI_COLOR: Record<string, string> = {
  teal: "border-l-teal-500 text-teal-600 dark:text-teal-400",
  amber: "border-l-amber-500 text-amber-600 dark:text-amber-400",
  green: "border-l-green-500 text-green-600 dark:text-green-400",
  red: "border-l-red-500 text-red-600 dark:text-red-400",
};

function Kpi({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <div className={`rounded-xl border border-l-4 bg-card p-4 shadow-sm ${KPI_COLOR[color]}`}>
      <div className="text-[10.5px] font-semibold uppercase tracking-wide">{label}</div>
      <div className="mt-1.5 text-2xl font-extrabold text-foreground">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
