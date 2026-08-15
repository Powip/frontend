"use client";

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
import { ChannelPill, KpiCard, KpiGrid, SectionCard } from "./shared";
import {
  mockCanalesTabla,
  mockCanalesTotal,
  mockComercialKpis,
  mockTopProductos,
  mockTopProductosTotal,
} from "./mock-data";

export function ComercialTab() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <KpiGrid cols={5}>
        {mockComercialKpis.map((kpi) => (
          <KpiCard key={kpi.label} {...kpi} />
        ))}
      </KpiGrid>

      <SectionCard
        title="Confirmados y facturación por canal"
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
              <TableHead className="pl-5">Canal</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Pedidos</TableHead>
              <TableHead className="text-right">Ticket prom.</TableHead>
              <TableHead className="text-right">Prod./pedido</TableHead>
              <TableHead className="text-right">Facturación neta</TableHead>
              <TableHead className="text-right">Efectividad</TableHead>
              <TableHead className="text-right pr-5">Upsell S/</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockCanalesTabla.map((row) => (
              <TableRow key={row.canal}>
                <TableCell className="pl-5 font-semibold">
                  <span className="inline-flex items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 rounded-full", row.dot)} />
                    {row.canal}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", row.tipoClass)}>
                    {row.tipo}
                  </span>
                </TableCell>
                <TableCell className="text-right font-semibold">{row.pedidos}</TableCell>
                <TableCell className="text-right font-semibold">{row.ticket}</TableCell>
                <TableCell className="text-right text-muted-foreground">{row.prodPorPedido}</TableCell>
                <TableCell className="text-right font-bold">{row.facturacion}</TableCell>
                <TableCell className={cn("text-right font-semibold", row.efectividadClass)}>
                  {row.efectividad}
                </TableCell>
                <TableCell className="text-right font-semibold text-violet-600 dark:text-violet-400 pr-5">
                  {row.upsell}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableCell className="pl-5 font-extrabold">TOTAL</TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
              <TableCell className="text-right font-extrabold">{mockCanalesTotal.pedidos}</TableCell>
              <TableCell className="text-right font-extrabold">{mockCanalesTotal.ticket}</TableCell>
              <TableCell className="text-right text-muted-foreground">—</TableCell>
              <TableCell className="text-right font-extrabold">{mockCanalesTotal.facturacion}</TableCell>
              <TableCell className="text-right text-muted-foreground">—</TableCell>
              <TableCell className="text-right font-extrabold text-violet-600 dark:text-violet-400 pr-5">
                {mockCanalesTotal.upsell}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard
        title="Top productos del período"
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
              <TableHead className="pl-5">Producto</TableHead>
              <TableHead className="text-right">Unidades</TableHead>
              <TableHead>Canales</TableHead>
              <TableHead className="text-right">Facturación neta</TableHead>
              <TableHead className="text-right">Upsell S/</TableHead>
              <TableHead className="text-right">Costo unit.</TableHead>
              <TableHead className="text-right pr-5">Margen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockTopProductos.map((row) => (
              <TableRow key={row.nombre}>
                <TableCell className="pl-5 font-semibold">{row.nombre}</TableCell>
                <TableCell className="text-right">{row.unidades}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {row.canales.map((c) => (
                      <ChannelPill key={c} code={c} />
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right font-bold">{row.facturacion}</TableCell>
                <TableCell className="text-right font-semibold text-violet-600 dark:text-violet-400">
                  {row.upsell}
                </TableCell>
                <TableCell className="text-right text-amber-600 dark:text-amber-400 font-medium">
                  {row.costo}
                </TableCell>
                <TableCell className="text-right pr-5">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", row.margenClass)}>
                    {row.margen}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableCell className="pl-5 font-extrabold">TOTAL</TableCell>
              <TableCell className="text-right font-extrabold">{mockTopProductosTotal.unidades}</TableCell>
              <TableCell className="text-muted-foreground">—</TableCell>
              <TableCell className="text-right font-extrabold">{mockTopProductosTotal.facturacion}</TableCell>
              <TableCell className="text-right font-extrabold text-violet-600 dark:text-violet-400">
                {mockTopProductosTotal.upsell}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">—</TableCell>
              <TableCell className="text-right text-muted-foreground pr-5">—</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}
