"use client";

import { useCouriersRed } from "@/hooks/superadmin/useOportunidades";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton, EmptyBlock, SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { Truck } from "lucide-react";
import { cn } from "@/lib/utils";

export function CouriersRedCard() {
  const { data, isLoading, isSimulado } = useCouriersRed();

  return (
    <Card className={cn("shadow-sm h-full", isSimulado && SIMULADO_CARD_CLASS)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">
          Couriers de la red
          {isSimulado && <SimuladoBadge />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <TableSkeleton rows={5} cols={4} />}
        {!isLoading && !data.length && <EmptyBlock icon={Truck} title="Sin couriers registrados" description="No hay datos de couriers en la red." />}
        {!isLoading && !!data.length && (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Courier</TableHead>
                  <TableHead>Empresas</TableHead>
                  <TableHead>% Entrega</TableHead>
                  <TableHead>% Devolución</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((c) => (
                  <TableRow key={c.courier}>
                    <TableCell className="text-xs font-semibold">{c.courier}</TableCell>
                    <TableCell className="text-xs">{c.empresasCount}</TableCell>
                    <TableCell className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{c.entregaPct}%</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.devolucionPct}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
