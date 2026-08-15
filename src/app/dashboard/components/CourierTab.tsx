"use client";

import { AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { KpiCard, KpiGrid, SectionCard } from "./shared";
import { mockCourierKpis, mockCourierTotal, mockCouriersTabla } from "./mock-data";

export function CourierTab() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <KpiGrid cols={5}>
        {mockCourierKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <SectionCard
        title="Rendimiento por courier"
        right={
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7">
            <Download className="h-3.5 w-3.5" /> Exportar
          </Button>
        }
        contentClassName="px-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Courier</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Envíos</TableHead>
              <TableHead className="text-right">Entregados</TableHead>
              <TableHead className="text-right">Efectividad</TableHead>
              <TableHead className="text-right">Devueltos</TableHead>
              <TableHead className="text-right">Tiempo prom.</TableHead>
              <TableHead className="text-right">Costo prom.</TableHead>
              <TableHead className="text-right">Costo total</TableHead>
              <TableHead className="text-right">COD pendiente</TableHead>
              <TableHead className="text-right pr-5">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockCouriersTabla.map((c) => (
              <TableRow
                key={c.nombre}
                className={cn(
                  c.highlight === "good" && "bg-emerald-50/50 dark:bg-emerald-500/5",
                  c.highlight === "warn" && "bg-amber-50/50 dark:bg-amber-500/5"
                )}
              >
                <TableCell className="pl-5 font-semibold">{c.nombre}</TableCell>
                <TableCell>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", c.tipoClass)}>{c.tipo}</span>
                </TableCell>
                <TableCell className="text-right font-semibold">{c.envios}</TableCell>
                <TableCell className="text-right font-semibold">{c.entregados}</TableCell>
                <TableCell className="text-right">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", c.efectividadClass)}>
                    {c.efectividad}
                  </span>
                </TableCell>
                <TableCell className={cn("text-right", c.devueltosClass ?? "text-muted-foreground")}>
                  {c.devueltos}
                </TableCell>
                <TableCell className={cn("text-right font-medium", c.tiempoClass)}>{c.tiempo}</TableCell>
                <TableCell className={cn("text-right font-semibold", c.costoPromClass)}>{c.costoProm}</TableCell>
                <TableCell className={cn("text-right font-semibold", c.costoTotalClass)}>{c.costoTotal}</TableCell>
                <TableCell className={cn("text-right font-semibold", c.codPendClass)}>{c.codPend}</TableCell>
                <TableCell className="text-right pr-5">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", c.scoreClass)}>{c.score}</span>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableCell className="pl-5 font-extrabold">TOTAL</TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
              <TableCell className="text-right font-extrabold">{mockCourierTotal.envios}</TableCell>
              <TableCell className="text-right font-extrabold">{mockCourierTotal.entregados}</TableCell>
              <TableCell className="text-right font-extrabold">{mockCourierTotal.efectividad}</TableCell>
              <TableCell className="text-right font-semibold text-red-600 dark:text-red-400">
                {mockCourierTotal.devueltos}
              </TableCell>
              <TableCell className="text-right font-semibold">{mockCourierTotal.tiempo}</TableCell>
              <TableCell className="text-right font-semibold">{mockCourierTotal.costoProm}</TableCell>
              <TableCell className="text-right font-extrabold">{mockCourierTotal.costoTotal}</TableCell>
              <TableCell className="text-right font-extrabold text-red-600 dark:text-red-400">
                {mockCourierTotal.codPend}
              </TableCell>
              <TableCell className="text-right text-muted-foreground pr-5">—</TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <div className="mx-5 mt-3.5 mb-1 flex items-start gap-2.5 rounded-lg border border-red-300/70 dark:border-red-900 bg-red-50 dark:bg-red-500/10 px-3.5 py-3">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-red-700 dark:text-red-400">Shalom · Liquidación vencida +3 días</p>
            <p className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-0.5">
              S/ 12,480 cobrado y no rendido. Contactar al courier para regularización urgente. Representa el 67% del
              COD pendiente total.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
