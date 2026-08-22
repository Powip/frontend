"use client";

import { useSunatGlobal } from "@/hooks/superadmin/useOperacion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, TableSkeleton, EmptyBlock, SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { formatDate } from "@/components/superadmin/shared/format";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

function diasHasta(iso?: string): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 86400000);
}

export function SunatGlobalTable() {
  const { data, isLoading, isSimulado } = useSunatGlobal();

  if (isLoading) return <TableSkeleton rows={6} cols={5} />;
  if (!data.length) {
    return <EmptyBlock icon={FileText} title="Sin empresas facturando" description="No hay empresas con emisión SUNAT configurada." />;
  }

  return (
    <div>
      {isSimulado && (
        <div className="mb-3 flex justify-end">
          <SimuladoBadge />
        </div>
      )}
      <div className={cn("overflow-x-auto rounded-lg border", isSimulado && SIMULADO_CARD_CLASS)}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Emite</TableHead>
              <TableHead>Comprobantes/mes</TableHead>
              <TableHead>Rechazos/mes</TableHead>
              <TableHead>Certificado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((s) => {
              const dias = diasHasta(s.certificadoVence);
              const porVencer = dias !== null && dias <= 30;
              return (
                <TableRow key={s.empresaId}>
                  <TableCell className="text-xs font-semibold">{s.empresaNombre}</TableCell>
                  <TableCell>
                    <StatusBadge label={s.emite ? "Emite" : "No emite"} tone={s.emite ? "green" : "gray"} />
                  </TableCell>
                  <TableCell className="text-xs">{s.comprobantesMes}</TableCell>
                  <TableCell className={`text-xs ${s.rechazosMes > 5 ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                    {s.rechazosMes}
                  </TableCell>
                  <TableCell>
                    {s.certificadoVence ? (
                      <StatusBadge
                        label={porVencer ? `Vence en ${dias}d — ${formatDate(s.certificadoVence)}` : formatDate(s.certificadoVence)}
                        tone={porVencer ? "amber" : "gray"}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
