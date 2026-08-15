"use client";

import { useState } from "react";
import { Download } from "lucide-react";
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
import { AvatarCircle, ChannelPill, KpiCard, KpiGrid, SectionCard } from "./shared";
import {
  mockAgentesCC,
  mockAgentesCCTotal,
  mockCallCenterKpis,
  mockEquipoKpis,
  mockGestiones,
  mockVendedores,
  mockVendedoresTotal,
} from "./mock-data";

const SORT_TABS = ["Por upsell S/", "Por volumen", "Por confirmación"];

export function EquipoTab() {
  const [sortTab, setSortTab] = useState(SORT_TABS[0]);

  return (
    <div className="flex flex-col gap-4 p-6">
      <SectionCard
        title="Rendimiento de vendedores — pedidos, facturación y upsell generado"
        subtitle="Período seleccionado · los números de cada vendedor deben cuadrar con el total de la tienda"
        right={
          <div className="flex gap-1.5">
            {SORT_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setSortTab(tab)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
                  tab === sortTab
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-card text-muted-foreground border-border hover:border-violet-300 hover:text-violet-600"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        }
        contentClassName="px-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-center w-8 pl-5">#</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-center">Canal</TableHead>
              <TableHead className="text-right">Asignados</TableHead>
              <TableHead className="text-right">Ventas</TableHead>
              <TableHead className="text-right">Órdenes</TableHead>
              <TableHead className="text-right">Productos</TableHead>
              <TableHead className="text-right">T.Prod/Ord</TableHead>
              <TableHead className="text-right">T.Prom Venta</TableHead>
              <TableHead className="text-right">Fact. Base</TableHead>
              <TableHead className="text-right pr-5">Upsell S/</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockVendedores.map((v) => (
              <TableRow key={v.name} className={v.top ? "bg-amber-50/60 dark:bg-amber-500/5" : undefined}>
                <TableCell className="text-center pl-5 text-base">{v.rank}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <AvatarCircle initials={v.initials} color={v.color} />
                    <div>
                      <p className="font-semibold text-foreground">{v.name}</p>
                      <p className="text-[10px] text-muted-foreground">{v.equipo}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <ChannelPill code={v.canal} />
                </TableCell>
                <TableCell className="text-right font-semibold">{v.asignados}</TableCell>
                <TableCell className="text-right">
                  <div className="font-extrabold text-emerald-600 dark:text-emerald-400">{v.ventas}</div>
                  <div className="text-[10px] text-muted-foreground">{v.ventasPct}</div>
                </TableCell>
                <TableCell className="text-right font-semibold">{v.ordenes}</TableCell>
                <TableCell className="text-right font-semibold">{v.productos}</TableCell>
                <TableCell className="text-right font-semibold text-blue-600 dark:text-blue-400">{v.prodOrd}</TableCell>
                <TableCell className="text-right font-semibold">{v.ticketProm}</TableCell>
                <TableCell className="text-right font-semibold">{v.factBase}</TableCell>
                <TableCell className="text-right pr-5">
                  <div className={cn("font-extrabold", v.coaching ? "text-muted-foreground" : "text-violet-600 dark:text-violet-400")}>
                    {v.upsell}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{v.upsellPct}</div>
                  {v.badge && (
                    <span
                      className={cn(
                        "inline-block text-[9px] font-bold rounded-full px-1.5 py-0.5 mt-0.5",
                        v.coaching
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                      )}
                    >
                      {v.badge}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-t-2 border-border">
              <TableCell className="pl-5" />
              <TableCell className="font-extrabold">TOTAL</TableCell>
              <TableCell className="text-center text-muted-foreground">—</TableCell>
              <TableCell className="text-right font-extrabold">{mockVendedoresTotal.asignados}</TableCell>
              <TableCell className="text-right">
                <div className="font-extrabold">{mockVendedoresTotal.ventas}</div>
                <div className="text-[10px] text-muted-foreground">{mockVendedoresTotal.ventasPct}</div>
              </TableCell>
              <TableCell className="text-right font-extrabold">{mockVendedoresTotal.ordenes}</TableCell>
              <TableCell className="text-right font-extrabold">{mockVendedoresTotal.productos}</TableCell>
              <TableCell className="text-right font-extrabold text-blue-600 dark:text-blue-400">{mockVendedoresTotal.prodOrd}</TableCell>
              <TableCell className="text-right font-extrabold">{mockVendedoresTotal.ticketProm}</TableCell>
              <TableCell className="text-right font-extrabold">{mockVendedoresTotal.factBase}</TableCell>
              <TableCell className="text-right font-extrabold text-violet-600 dark:text-violet-400 pr-5">
                {mockVendedoresTotal.upsell}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </SectionCard>

      <KpiGrid cols={5}>
        {mockEquipoKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <SectionCard
        title="Rendimiento por agente ATC"
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
              <TableHead className="pl-5">Agente</TableHead>
              <TableHead>Canales</TableHead>
              <TableHead className="text-right">Asignados</TableHead>
              <TableHead className="text-right">Confirmados</TableHead>
              <TableHead className="text-right">NC</TableHead>
              <TableHead className="text-right">Anulados</TableHead>
              <TableHead className="text-right">Conv. %</TableHead>
              <TableHead className="text-right">Upsell rate</TableHead>
              <TableHead className="text-right">Upsell S/</TableHead>
              <TableHead className="text-right pr-5">TMC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockAgentesCC.map((a) => (
              <TableRow key={a.name} className={a.top ? "bg-amber-50/60 dark:bg-amber-500/5" : undefined}>
                <TableCell className="pl-5">
                  <div className="flex items-center gap-2.5">
                    <AvatarCircle initials={a.initials} color={a.color} size="sm" />
                    <div>
                      <p className="font-semibold text-foreground">{a.name}</p>
                      {a.meta && <p className="text-[10px] text-amber-600 dark:text-amber-400">{a.meta}</p>}
                      {a.coaching && (
                        <span className="text-[9px] font-bold rounded-full px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400">
                          coaching
                        </span>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {a.canales.map((c) => (
                      <ChannelPill key={c} code={c} />
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right font-semibold">{a.asignados}</TableCell>
                <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">{a.confirmados}</TableCell>
                <TableCell className="text-right text-amber-600 dark:text-amber-400">{a.nc}</TableCell>
                <TableCell className="text-right text-muted-foreground">{a.anulados}</TableCell>
                <TableCell className="text-right">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", a.convClass)}>{a.conv}</span>
                </TableCell>
                <TableCell className="text-right font-semibold text-violet-600 dark:text-violet-400">{a.upsellRate}</TableCell>
                <TableCell className="text-right font-extrabold text-violet-600 dark:text-violet-400">{a.upsellVal}</TableCell>
                <TableCell className={cn("text-right font-semibold pr-5", a.tmcClass)}>{a.tmc}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableCell className="pl-5 font-extrabold">TOTAL</TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
              <TableCell className="text-right font-extrabold">{mockAgentesCCTotal.asignados}</TableCell>
              <TableCell className="text-right font-extrabold">{mockAgentesCCTotal.confirmados}</TableCell>
              <TableCell className="text-right font-semibold text-red-600 dark:text-red-400">{mockAgentesCCTotal.nc}</TableCell>
              <TableCell className="text-right font-semibold text-red-600 dark:text-red-400">{mockAgentesCCTotal.anulados}</TableCell>
              <TableCell className="text-right font-extrabold">{mockAgentesCCTotal.conv}</TableCell>
              <TableCell className="text-right font-extrabold text-violet-600 dark:text-violet-400">{mockAgentesCCTotal.upsellRate}</TableCell>
              <TableCell className="text-right font-extrabold text-violet-600 dark:text-violet-400">{mockAgentesCCTotal.upsellVal}</TableCell>
              <TableCell className="text-right font-semibold pr-5">{mockAgentesCCTotal.tmc}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </SectionCard>

      <div className="grid grid-cols-2 gap-3.5">
        <SectionCard title="KPIs Call Center">
          <div className="flex flex-col">
            {mockCallCenterKpis.map((k) => (
              <div key={k.label} className="flex items-center justify-between py-2.5 border-b border-border/60 last:border-0">
                <span className="text-sm text-muted-foreground">{k.label}</span>
                <div className="flex items-center gap-2">
                  <span className={cn("text-sm font-extrabold", k.className)}>{k.value}</span>
                  {k.meta && <span className="text-xs text-muted-foreground">{k.meta}</span>}
                  {k.badge && (
                    <span className={cn("text-[10px] font-bold rounded-md px-1.5 py-0.5", k.badgeClass)}>{k.badge}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Distribución de gestiones">
          <div className="flex flex-col gap-2 mb-3.5">
            {mockGestiones.map((g) => (
              <div key={g.label} className={cn("flex items-center justify-between rounded-lg px-3 py-2", g.className)}>
                <span className="text-xs font-medium">{g.label}</span>
                <span className={cn("text-sm font-extrabold", g.valueClass)}>{g.value}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-lg bg-violet-50 dark:bg-violet-500/10 px-3 py-2.5">
            <span className="text-xs font-bold text-violet-700 dark:text-violet-400">TOTAL ingresados CC</span>
            <span className="text-sm font-extrabold text-violet-700 dark:text-violet-400">820 ✓</span>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
