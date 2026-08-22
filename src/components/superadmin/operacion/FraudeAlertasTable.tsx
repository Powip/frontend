"use client";

import { useRouter } from "next/navigation";
import { useAlertasFraude } from "@/hooks/superadmin/useOperacion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge, BadgeTone, TableSkeleton, EmptyBlock, SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { formatDate } from "@/components/superadmin/shared/format";
import { SeveridadFraude } from "@/interfaces/superadmin";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const SEVERIDAD_TONE: Record<SeveridadFraude, BadgeTone> = {
  alta: "red",
  media: "amber",
  baja: "gray",
};

export function FraudeAlertasTable() {
  const router = useRouter();
  const { data, isLoading, isSimulado } = useAlertasFraude();

  if (isLoading) return <TableSkeleton rows={4} cols={4} />;
  if (!data.length) {
    return <EmptyBlock icon={ShieldAlert} title="Sin anomalías detectadas" description="No hay alertas de fraude activas en la red." />;
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
              <TableHead>Señal</TableHead>
              <TableHead>Severidad</TableHead>
              <TableHead>Detectado</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="text-xs font-semibold">{a.empresaNombre}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{a.senal}</TableCell>
                <TableCell>
                  <StatusBadge label={a.severidad} tone={SEVERIDAD_TONE[a.severidad]} dot />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(a.detectadoEn)}</TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => router.push(`/superadmin/empresas/${a.empresaId}`)}>
                    Investigar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
