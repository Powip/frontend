"use client";

import { useRendimientoSdr } from "@/hooks/superadmin/useAdquisicion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyBlock } from "@/components/superadmin/shared";
import { Users } from "lucide-react";

export function RendimientoSdrTable() {
  const { data, isLoading } = useRendimientoSdr();

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">Rendimiento por SDR</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!isLoading && !data.length && <EmptyBlock icon={Users} title="Sin datos todavía" description="No hay leads asignados a un vendedor." />}
        {(isLoading || !!data.length) && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">SDR</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>Cierres</TableHead>
                <TableHead className="pr-4">Efectividad</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((s) => (
                <TableRow key={s.sdrNombre}>
                  <TableCell className="pl-4 text-xs font-semibold">{s.sdrNombre}</TableCell>
                  <TableCell className="text-xs">{s.leads}</TableCell>
                  <TableCell className="text-xs">{s.cierres}</TableCell>
                  <TableCell className="pr-4 text-xs font-bold">{s.efectividadPct}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="px-4 pb-3 pt-2 text-[10.5px] text-muted-foreground">
          Demos y CPL por SDR no se muestran — requieren carga de inversión (ver docs/superadmin/adquisicion-endpoints.md).
        </p>
      </CardContent>
    </Card>
  );
}
