"use client";

import { Landmark } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useComisionesPorEmpresa } from "@/hooks/superadmin/useComisionesMp";
import { ExportButton, StatusBadge, TableSkeleton, EmptyBlock, SimuladoBadge } from "@/components/superadmin/shared";
import { money } from "@/components/superadmin/shared/format";

export function ComisionesPorEmpresaTable() {
  const { data, isLoading, isSimulado } = useComisionesPorEmpresa();

  if (isLoading) return <TableSkeleton rows={6} cols={5} />;
  if (!data.data.length) {
    return <EmptyBlock icon={Landmark} title="Sin comisiones" description="Todavía no hay pagos MP registrados este período." />;
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <ExportButton
          filename="comisiones_mp_por_negocio"
          rows={data.data.map((c) => ({
            Negocio: c.empresaNombre,
            Modo: c.modo,
            "GMV MP": c.gmvMp,
            "Comisión %": c.comisionPct * 100,
            "Comisión S/": c.comisionMonto,
          }))}
        />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Negocio</TableHead>
              <TableHead>Modo cuenta</TableHead>
              <TableHead>GMV procesado MP</TableHead>
              <TableHead>Comisión 0.5%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((c) => (
              <TableRow key={c.empresaId}>
                <TableCell className="text-xs font-semibold">
                  {c.empresaNombre}
                  {isSimulado && <SimuladoBadge />}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    label={c.modo === "propia" ? "Cuenta propia" : "powip_temporal"}
                    tone={c.modo === "propia" ? "green" : "amber"}
                  />
                </TableCell>
                <TableCell className="text-xs">{money(c.gmvMp)}</TableCell>
                <TableCell className="text-xs font-bold text-primary">{money(c.comisionMonto)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
