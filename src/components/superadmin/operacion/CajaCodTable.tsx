"use client";

import { useRouter } from "next/navigation";
import { useCajaCod } from "@/hooks/superadmin/useOperacion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportButton, TableSkeleton, EmptyBlock, SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { money } from "@/components/superadmin/shared/format";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

export function CajaCodTable() {
  const router = useRouter();
  const { data, isLoading, isSimulado } = useCajaCod();

  if (isLoading) return <TableSkeleton rows={6} cols={5} />;
  if (!data.length) {
    return <EmptyBlock icon={Wallet} title="Sin datos de caja COD" description="No hay empresas activas con movimientos COD." />;
  }

  const totales = data.reduce(
    (acc, c) => ({
      gmv: acc.gmv + c.gmv,
      codEnTransito: acc.codEnTransito + c.codEnTransito,
      liquidacionPendiente: acc.liquidacionPendiente + c.liquidacionPendiente,
    }),
    { gmv: 0, codEnTransito: 0, liquidacionPendiente: 0 }
  );

  return (
    <div className={cn(isSimulado && cn("rounded-xl p-3.5", SIMULADO_CARD_CLASS))}>
      <div className="mb-3 flex items-center justify-end gap-2">
        {isSimulado && <SimuladoBadge />}
        <ExportButton
          filename="caja_cod_red"
          rows={data.map((c) => ({
            Empresa: c.empresaNombre,
            GMV: c.gmv,
            COD_En_Transito: c.codEnTransito,
            Liquidacion_Pendiente: c.liquidacionPendiente,
            Morosidad_Pct: c.morosidadPct,
          }))}
        />
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>GMV</TableHead>
              <TableHead>COD en tránsito</TableHead>
              <TableHead>Liquidación pendiente</TableHead>
              <TableHead>Morosidad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((c) => (
              <TableRow key={c.empresaId} className="cursor-pointer" onClick={() => router.push(`/superadmin/empresas/${c.empresaId}`)}>
                <TableCell className="text-xs font-semibold">{c.empresaNombre}</TableCell>
                <TableCell className="text-xs">{money(c.gmv)}</TableCell>
                <TableCell className="text-xs font-bold text-primary">{money(c.codEnTransito)}</TableCell>
                <TableCell className="text-xs">{money(c.liquidacionPendiente)}</TableCell>
                <TableCell className={`text-xs font-semibold ${c.morosidadPct >= 5 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                  {c.morosidadPct}%
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40 font-bold hover:bg-muted/40">
              <TableCell className="text-xs">TOTAL</TableCell>
              <TableCell className="text-xs">{money(totales.gmv)}</TableCell>
              <TableCell className="text-xs text-primary">{money(totales.codEnTransito)}</TableCell>
              <TableCell className="text-xs">{money(totales.liquidacionPendiente)}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
