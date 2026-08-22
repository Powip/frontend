"use client";

import { useEstadosPipeline, useOrigenCac } from "@/hooks/superadmin/useAdquisicion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExportButton, SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { ESTADO_LEAD_LABEL } from "@/components/superadmin/shared/StatusBadge";
import { FunnelBars } from "@/components/superadmin/shared/charts/FunnelBars";
import { money } from "@/components/superadmin/shared/format";
import { cn } from "@/lib/utils";
import { EstadoLead } from "@/interfaces/superadmin";

const COLORES: Record<string, string> = {
  nuevo: "#3B82F6",
  contactado: "#8B5CF6",
  respondio: "#8B5CF6",
  demo_pendiente: "#F5A623",
  demo_agendada: "#F5A623",
  demo_realizada: "#F5A623",
  pendiente_decision: "#F5A623",
  pendiente_pago: "#F5A623",
  pago_recibido: "#12B886",
  cerrado: "#12B886",
  perdido: "#EF4655",
  cancelado: "#8A90A2",
};

export function LeadsDashboardTab() {
  const { data: statesCount, isLoading: loadingEstados } = useEstadosPipeline();
  const { data: origenCac, isSimulado } = useOrigenCac();

  const total = Object.values(statesCount).reduce((a, b) => a + b, 0) || 1;
  const etapasData = (Object.keys(statesCount) as EstadoLead[])
    .filter((k) => statesCount[k] > 0)
    .map((estado) => ({
      etapa: ESTADO_LEAD_LABEL[estado] ?? estado,
      count: statesCount[estado],
      pct: Math.round((statesCount[estado] / total) * 100),
      color: COLORES[estado] ?? "#8A90A2",
    }));

  const totalRow = origenCac.reduce((acc, r) => ({ leads: acc.leads + r.leads, cierres: acc.cierres + r.cierres, inversion: acc.inversion + (r.inversion ?? 0) }), {
    leads: 0,
    cierres: 0,
    inversion: 0,
  });

  return (
    <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1fr_1.6fr]">
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-[13px] font-bold">Leads por estado</CardTitle>
        </CardHeader>
        <CardContent>{!loadingEstados && <FunnelBars data={etapasData} />}</CardContent>
      </Card>

      <Card className={cn("shadow-sm", isSimulado && SIMULADO_CARD_CLASS)}>
        <CardHeader className="pb-2 flex flex-row items-center">
          <CardTitle className="text-[13px] font-bold">
            Origen & CAC
            {isSimulado && <SimuladoBadge />}
          </CardTitle>
          <div className="ml-auto">
            <ExportButton
              filename="origen_cac"
              rows={origenCac.map((r) => ({ Canal: r.canal, Leads: r.leads, Cierres: r.cierres, Conversion: r.conversionPct, Inversion: r.inversion, CPL: r.cpl, CPD: r.cpd, CAC: r.cac }))}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Canal</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Cierres</TableHead>
                  <TableHead>Conv.</TableHead>
                  <TableHead>Inversión</TableHead>
                  <TableHead>CPL</TableHead>
                  <TableHead>CPD</TableHead>
                  <TableHead className="pr-4">CAC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {origenCac.map((r) => (
                  <TableRow key={r.canal}>
                    <TableCell className="pl-4 text-xs font-semibold">{r.canal}</TableCell>
                    <TableCell className="text-xs">{r.leads}</TableCell>
                    <TableCell className="text-xs">{r.cierres}</TableCell>
                    <TableCell className="text-xs">{r.conversionPct}%</TableCell>
                    <TableCell className="text-xs">{r.inversion !== undefined ? money(r.inversion) : "—"}</TableCell>
                    <TableCell className="text-xs">{r.cpl !== undefined ? money(r.cpl) : "—"}</TableCell>
                    <TableCell className="text-xs">{r.cpd !== undefined ? money(r.cpd) : "—"}</TableCell>
                    <TableCell className="pr-4 text-xs font-bold">{r.cac ? money(r.cac) : "—"}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-bold">
                  <TableCell className="pl-4 text-xs">TOTAL</TableCell>
                  <TableCell className="text-xs">{totalRow.leads}</TableCell>
                  <TableCell className="text-xs">{totalRow.cierres}</TableCell>
                  <TableCell className="text-xs">{totalRow.leads ? Math.round((totalRow.cierres / totalRow.leads) * 1000) / 10 : 0}%</TableCell>
                  <TableCell className="text-xs">{money(totalRow.inversion)}</TableCell>
                  <TableCell className="text-xs">—</TableCell>
                  <TableCell className="text-xs">—</TableCell>
                  <TableCell className="pr-4 text-xs">{money(totalRow.inversion / (totalRow.cierres || 1))}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
