"use client";

import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { getCobros } from "@/services/superadmin/finanzasService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, ESTADO_FACTURA_TONE, TableSkeleton, EmptyBlock, ExportButton } from "@/components/superadmin/shared";
import { money, formatDate } from "@/components/superadmin/shared/format";

export function CobrosTable() {
  const { data, isLoading } = useQuery({ queryKey: ["superadmin", "finanzas", "cobros"], queryFn: getCobros });

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-[13px] font-bold">Detalle de cobros</CardTitle>
        <ExportButton
          filename="cobros"
          rows={(data ?? []).map((c) => ({ ID: c.id, Empresa: c.empresaNombre, Monto: c.monto, Estado: c.estado, Fecha: c.fecha }))}
        />
      </CardHeader>
      <CardContent>
        {isLoading && <TableSkeleton rows={6} cols={4} />}
        {!isLoading && !data?.length && (
          <EmptyBlock icon={Wallet} title="Sin cobros" description="No hay cobros registrados en el periodo." />
        )}
        {!isLoading && !!data?.length && (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs font-medium">{c.id}</TableCell>
                    <TableCell className="text-xs">{c.empresaNombre}</TableCell>
                    <TableCell className="text-xs font-bold">{money(c.monto)}</TableCell>
                    <TableCell>
                      <StatusBadge label={c.estado} tone={ESTADO_FACTURA_TONE[c.estado] ?? "gray"} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(c.fecha)}</TableCell>
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
