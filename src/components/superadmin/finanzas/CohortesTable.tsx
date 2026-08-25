"use client";

import { Users2 } from "lucide-react";
import { useCohortes } from "@/hooks/superadmin/useFinanzas";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TableSkeleton, EmptyBlock, SimuladoBadge } from "@/components/superadmin/shared";

export function CohortesTable() {
  const { data: cohortesData, isLoading, isSimulado } = useCohortes();
  const data = cohortesData?.data;

  const maxMeses = data?.reduce((max, c) => Math.max(max, c.retencion.length), 0) ?? 0;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">
          Retención por cohorte
          {isSimulado && <SimuladoBadge />}
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          % de empresas activas por mes siguiente al alta (mes 0 = mes de alta).
        </p>
      </CardHeader>
      <CardContent>
        {isLoading && <TableSkeleton rows={6} cols={6} />}
        {!isLoading && !data?.length && (
          <EmptyBlock icon={Users2} title="Sin cohortes" description="No hay datos de cohortes para mostrar." />
        )}
        {!isLoading && !!data?.length && (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cohorte</TableHead>
                  <TableHead>Tamaño</TableHead>
                  {Array.from({ length: maxMeses }, (_, i) => (
                    <TableHead key={i} className="text-center">
                      Mes {i}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((c) => (
                  <TableRow key={c.mes}>
                    <TableCell className="text-xs font-semibold whitespace-nowrap">{c.mes}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.tamano}</TableCell>
                    {Array.from({ length: maxMeses }, (_, i) => {
                      const valor = c.retencion[i];
                      if (valor === undefined) return <TableCell key={i} />;
                      return (
                        <TableCell key={i} className="p-1 text-center">
                          <div
                            className="relative mx-auto flex h-8 w-14 items-center justify-center overflow-hidden rounded-md"
                          >
                            <div className="absolute inset-0 bg-primary" style={{ opacity: Math.max(0.08, valor / 100) }} />
                            <span className={`relative text-[11px] font-bold ${valor >= 55 ? "text-primary-foreground" : "text-foreground"}`}>
                              {valor}%
                            </span>
                          </div>
                        </TableCell>
                      );
                    })}
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
