"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  useSeguimientoLeads,
  useSeguimientoEmpresas,
  useMarcarLeadSeguimientoHecho,
  FiltroVencimiento,
} from "@/hooks/superadmin/useSeguimiento";
import { StatusBadge, TableSkeleton, EmptyBlock, SimuladoBadge, type BadgeTone } from "@/components/superadmin/shared";
import { formatDate, relativeDays } from "@/components/superadmin/shared/format";
import { CalendarCheck } from "lucide-react";
import { ISeguimiento } from "@/interfaces/superadmin";

function toneVencimiento(vence: string): BadgeTone {
  const dias = Math.floor((new Date(vence).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (dias < 0) return "red";
  if (dias === 0) return "amber";
  return "blue";
}

function estadoVencimiento(vence: string): "vencido" | "hoy" | "proximo" {
  const dias = Math.floor((new Date(vence).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (dias < 0) return "vencido";
  if (dias === 0) return "hoy";
  return "proximo";
}

export function SeguimientoTable({ filtro }: { filtro: FiltroVencimiento }) {
  const router = useRouter();
  const { data: leads, isLoading: loadingLeads } = useSeguimientoLeads("todos");
  const { data: empresas, isLoading: loadingEmpresas, isSimulado } = useSeguimientoEmpresas();
  const { mutate: marcarLeadHecho } = useMarcarLeadSeguimientoHecho();

  const isLoading = loadingLeads || loadingEmpresas;

  const data = useMemo(() => {
    const merged: ISeguimiento[] = [...leads, ...empresas].sort((a, b) => new Date(a.vence).getTime() - new Date(b.vence).getTime());
    if (filtro === "todos") return merged;
    return merged.filter((s) => estadoVencimiento(s.vence) === (filtro === "vencidos" ? "vencido" : filtro === "hoy" ? "hoy" : "proximo"));
  }, [leads, empresas, filtro]);

  function handleHecho(s: ISeguimiento) {
    if (s.entidadTipo === "lead") {
      marcarLeadHecho(s.entidadId, { onSuccess: () => toast.success("Tarea marcada como hecha.") });
    } else {
      toast.info("El seguimiento sobre empresas todavía es simulado — ver docs/superadmin/seguimiento-endpoints.md.");
    }
  }

  if (isLoading) return <TableSkeleton rows={6} cols={6} />;
  if (!data.length) {
    return <EmptyBlock icon={CalendarCheck} title="Sin tareas de seguimiento" description="No hay pendientes para este filtro." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Negocio</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Próxima acción</TableHead>
            <TableHead>Responsable</TableHead>
            <TableHead>Vence</TableHead>
            <TableHead className="text-right pr-4">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="text-xs font-semibold">
                {s.nombre}
                {s.entidadTipo === "empresa" && isSimulado && <SimuladoBadge />}
              </TableCell>
              <TableCell>
                <StatusBadge label={s.entidadTipo === "lead" ? "Lead" : "Cuenta"} tone={s.entidadTipo === "lead" ? "violet" : "blue"} />
              </TableCell>
              <TableCell className="text-xs">{s.accion}</TableCell>
              <TableCell className="text-xs">{s.responsableNombre}</TableCell>
              <TableCell>
                <StatusBadge label={`${relativeDays(s.vence)} · ${formatDate(s.vence)}`} tone={toneVencimiento(s.vence)} />
              </TableCell>
              <TableCell className="text-right pr-4">
                <div className="inline-flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-[11px]"
                    onClick={() =>
                      router.push(s.entidadTipo === "lead" ? `/superadmin/adquisicion?lead=${s.entidadId}` : `/superadmin/empresas/${s.entidadId}`)
                    }
                  >
                    <ExternalLink className="h-3 w-3" />
                    Abrir
                  </Button>
                  <Button size="sm" className="h-7 gap-1 text-[11px]" onClick={() => handleHecho(s)}>
                    <CheckCircle2 className="h-3 w-3" />
                    Hecho
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
