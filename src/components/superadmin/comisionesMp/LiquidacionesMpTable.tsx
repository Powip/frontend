"use client";

import { toast } from "sonner";
import { Wallet, CircleDollarSign } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useLiquidacionesMp, useEjecutarLiquidacionMp } from "@/hooks/superadmin/useComisionesMp";
import { ExportButton, StatusBadge, TableSkeleton, EmptyBlock, SimuladoBadge } from "@/components/superadmin/shared";
import { money } from "@/components/superadmin/shared/format";

export function LiquidacionesMpTable() {
  const { data, isLoading, isSimulado } = useLiquidacionesMp();
  const { mutate: ejecutar, isPending } = useEjecutarLiquidacionMp();

  function handleEjecutar(id: string, empresaNombre: string) {
    ejecutar(id, {
      onSuccess: (liq) => liq && toast.success(`Liquidación ejecutada para ${empresaNombre} — ${liq.periodo}.`),
    });
  }

  if (isLoading) return <TableSkeleton rows={6} cols={7} />;
  if (!data.data.length) {
    return <EmptyBlock icon={Wallet} title="Sin liquidaciones" description="Ningún negocio está en modo powip_temporal por ahora." />;
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <ExportButton
          filename="liquidaciones_mp"
          rows={data.data.map((l) => ({
            Negocio: l.empresaNombre,
            Periodo: l.periodo,
            Bruto: l.montoBruto,
            "Comisión Powip (0.5%)": l.comisionPowip,
            Neto: l.neto,
            Estado: l.estado,
            "N° operación": l.nroOperacion ?? "",
          }))}
        />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Negocio</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Bruto</TableHead>
              <TableHead>Comisión Powip (0.5%)</TableHead>
              <TableHead>Neto a liquidar</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-44" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs font-semibold">
                  {l.empresaNombre}
                  {isSimulado && <SimuladoBadge />}
                </TableCell>
                <TableCell className="text-xs">{l.periodo}</TableCell>
                <TableCell className="text-xs">{money(l.montoBruto)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">-{money(l.comisionPowip)}</TableCell>
                <TableCell className="text-xs font-bold">{money(l.neto)}</TableCell>
                <TableCell>
                  <StatusBadge label={l.estado === "pagada" ? `Pagada · ${l.nroOperacion}` : "Pendiente"} tone={l.estado === "pagada" ? "green" : "amber"} />
                </TableCell>
                <TableCell>
                  {l.estado === "pendiente" && (
                    <Button size="sm" className="h-7 gap-1.5 text-[11px]" disabled={isPending} onClick={() => handleEjecutar(l.id, l.empresaNombre)}>
                      <CircleDollarSign className="h-3 w-3" />
                      Ejecutar liquidación
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
