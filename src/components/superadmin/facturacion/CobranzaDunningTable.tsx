"use client";

import { toast } from "sonner";
import { BellRing, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFacturasVencidas, useMarcarFacturaPagada, useRecordarCobro } from "@/hooks/superadmin/useFacturacion";
import { StatusBadge, TableSkeleton, EmptyBlock, SimuladoBadge } from "@/components/superadmin/shared";
import { money, formatDate } from "@/components/superadmin/shared/format";

export function CobranzaDunningTable() {
  const { data, isLoading, isSimulado } = useFacturasVencidas();

  const { mutate: recordar } = useRecordarCobro();
  const { mutate: marcarCobrado } = useMarcarFacturaPagada();

  function handleRecordar(id: string) {
    recordar(id, { onSuccess: (factura) => factura && toast.success(`Recordatorio enviado a ${factura.empresaNombre}.`) });
  }

  function handleMarcarCobrado(id: string) {
    marcarCobrado(id, { onSuccess: (factura) => factura && toast.success(`Factura ${factura.id} marcada como cobrada.`) });
  }

  return (
    <div className="space-y-3.5">
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3.5 py-3 text-[11.5px] text-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>
          <strong className="font-bold">Regla de cobranza (8.23):</strong> se envía recordatorio automático a los 3, 7 y 15 días de vencida
          la factura. Tras 3 intentos sin pago, la cuenta se suspende automáticamente.
        </span>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-[13px] font-bold">Facturas vencidas</CardTitle>
          {isSimulado && <SimuladoBadge />}
        </CardHeader>
        <CardContent>
          {isLoading && <TableSkeleton rows={5} cols={6} />}
          {!isLoading && !data?.length && (
            <EmptyBlock icon={CheckCircle2} title="Sin facturas vencidas" description="No hay cobranza pendiente en este momento." />
          )}
          {!isLoading && !!data?.length && (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Días vencida</TableHead>
                    <TableHead>Reintentos</TableHead>
                    <TableHead className="w-[220px]">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="text-xs font-medium">{f.id}</TableCell>
                      <TableCell className="text-xs">{f.empresaNombre}</TableCell>
                      <TableCell className="text-xs font-bold">{money(f.monto)}</TableCell>
                      <TableCell>
                        <StatusBadge label={`${f.diasVencida ?? 0}d`} tone={(f.diasVencida ?? 0) >= 15 ? "red" : "amber"} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          label={`${f.reintentos ?? 0}/3`}
                          tone={(f.reintentos ?? 0) >= 3 ? "red" : "gray"}
                          dot={(f.reintentos ?? 0) >= 3}
                        />
                        {(f.reintentos ?? 0) >= 3 && (
                          <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-400">
                            <ShieldAlert className="h-3 w-3" /> Suspensión
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => handleRecordar(f.id)}>
                            <BellRing className="h-3 w-3" />
                            Recordar
                          </Button>
                          <Button size="sm" className="h-7 gap-1 text-[11px]" onClick={() => handleMarcarCobrado(f.id)}>
                            <CheckCircle2 className="h-3 w-3" />
                            Marcar Cobrado
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
