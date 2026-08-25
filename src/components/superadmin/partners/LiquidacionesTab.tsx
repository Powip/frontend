"use client";

import { toast } from "sonner";
import { Wallet, CircleDollarSign } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useLiquidaciones, useConfirmarPagoLiquidacion } from "@/hooks/superadmin/usePartners";
import { ExportButton, StatusBadge, TableSkeleton, EmptyBlock, SimuladoBadge } from "@/components/superadmin/shared";
import { money } from "@/components/superadmin/shared/format";

export function LiquidacionesTab() {
  const { data, isLoading, isSimulado } = useLiquidaciones();

  const { mutate: confirmarPago, isPending } = useConfirmarPagoLiquidacion();

  function handleConfirmarPago(id: string) {
    confirmarPago(id, {
      onSuccess: (liq) => liq && toast.success(`Pago confirmado para ${liq.partnerNombre} (${liq.ciclo}).`),
    });
  }

  if (isLoading) return <TableSkeleton rows={6} cols={7} />;
  if (!data.length) {
    return <EmptyBlock icon={Wallet} title="Sin liquidaciones" description="Todavía no hay ciclos de liquidación generados." />;
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <ExportButton
          filename="liquidaciones_partners"
          rows={data.map((l) => ({
            Partner: l.partnerNombre,
            Ciclo: l.ciclo,
            Bruto: l.montoBruto,
            Reversos: l.montoReversos,
            Retencion: l.retencion,
            Neto: l.neto,
            Estado: l.estado,
          }))}
        />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Partner</TableHead>
              <TableHead>Ciclo</TableHead>
              <TableHead>Bruto</TableHead>
              <TableHead>Reversos</TableHead>
              <TableHead>Retención (8%)</TableHead>
              <TableHead>Neto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs font-semibold">
                  {l.partnerNombre}
                  {isSimulado && <SimuladoBadge />}
                </TableCell>
                <TableCell className="text-xs">{l.ciclo}</TableCell>
                <TableCell className="text-xs">{money(l.montoBruto)}</TableCell>
                <TableCell className="text-xs text-red-600 dark:text-red-400">-{money(l.montoReversos)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">-{money(l.retencion)}</TableCell>
                <TableCell className="text-xs font-bold">{money(l.neto)}</TableCell>
                <TableCell>
                  <StatusBadge label={l.estado} tone={l.estado === "pagada" ? "green" : "amber"} />
                </TableCell>
                <TableCell>
                  {l.estado === "pendiente" && (
                    <Button size="sm" className="h-7 gap-1.5 text-[11px]" disabled={isPending} onClick={() => handleConfirmarPago(l.id)}>
                      <CircleDollarSign className="h-3 w-3" />
                      Confirmar pago
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
