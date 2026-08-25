"use client";

import { LifeBuoy } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTicketsSoporte } from "@/hooks/superadmin/useSoporte";
import { PrioridadTicket } from "@/interfaces/superadmin";
import { StatusBadge, ESTADO_TICKET_TONE, TableSkeleton, EmptyBlock, BadgeTone, SimuladoBadge } from "@/components/superadmin/shared";
import { formatDateTime } from "@/components/superadmin/shared/format";

const PRIORIDAD_TONE: Record<PrioridadTicket, BadgeTone> = {
  Alta: "red",
  Media: "amber",
  Baja: "gray",
};

interface Props {
  prioridad: PrioridadTicket | "todas";
  onOpenTicket: (id: string) => void;
}

export function SoporteTable({ prioridad, onOpenTicket }: Props) {
  const { data, isLoading, isSimulado } = useTicketsSoporte(prioridad);

  if (isLoading) return <TableSkeleton rows={8} cols={6} />;
  if (!data?.length) {
    return <EmptyBlock icon={LifeBuoy} title="Sin tickets" description="No hay tickets para este filtro." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead>Asunto</TableHead>
            <TableHead>Prioridad</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>SLA vence</TableHead>
            <TableHead>Asignado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((t) => (
            <TableRow key={t.id} className="cursor-pointer" onClick={() => onOpenTicket(t.id)}>
              <TableCell className="text-xs font-semibold">
                {t.empresaNombre}
                {isSimulado && <SimuladoBadge />}
              </TableCell>
              <TableCell className="text-xs">{t.asunto}</TableCell>
              <TableCell>
                <StatusBadge label={t.prioridad} tone={PRIORIDAD_TONE[t.prioridad]} />
              </TableCell>
              <TableCell>
                <StatusBadge label={t.estado} tone={ESTADO_TICKET_TONE[t.estado]} />
              </TableCell>
              <TableCell className="text-xs">{formatDateTime(t.slaVence)}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{t.asignadoNombre ?? "Sin asignar"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
