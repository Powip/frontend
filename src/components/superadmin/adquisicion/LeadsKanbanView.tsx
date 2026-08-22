"use client";

import { useLeadsPorEtapas, LeadsFilters } from "@/hooks/superadmin/useAdquisicion";
import { EstadoLead } from "@/interfaces/superadmin";
import { formatDate } from "@/components/superadmin/shared/format";
import { TableSkeleton } from "@/components/superadmin/shared";

/* -----------------------------------------------------------------------
   El backend real solo filtra `pipeline_stage` de a uno por request (no
   acepta una lista) — agrupamos las 12 etapas reales en 7 columnas
   visuales para no pedir 12 columnas angostas, pero seguimos pidiendo
   cada etapa acotada (30 leads c/u) en vez de traer todo sin filtro.
------------------------------------------------------------------------ */
const COLUMNAS: { label: string; color: string; etapas: EstadoLead[] }[] = [
  { label: "Nuevo", color: "#3B82F6", etapas: ["nuevo"] },
  { label: "Contactado", color: "#8B5CF6", etapas: ["contactado", "respondio"] },
  { label: "Demo", color: "#F5A623", etapas: ["demo_pendiente", "demo_agendada", "demo_realizada"] },
  { label: "Decisión", color: "#F5A623", etapas: ["pendiente_decision", "pendiente_pago"] },
  { label: "Ganado", color: "#12B886", etapas: ["pago_recibido", "cerrado"] },
  { label: "Perdido", color: "#EF4655", etapas: ["perdido"] },
  { label: "Cancelado", color: "#8A90A2", etapas: ["cancelado"] },
];

const TODAS_LAS_ETAPAS = COLUMNAS.flatMap((c) => c.etapas);

export function LeadsKanbanView({ filters, onOpenLead }: { filters: LeadsFilters; onOpenLead: (id: string) => void }) {
  const { data, isLoading } = useLeadsPorEtapas(TODAS_LAS_ETAPAS, 30, { q: filters.q, canal: filters.canal, sdrNombre: filters.sdrNombre });

  if (isLoading) return <TableSkeleton rows={6} cols={5} />;

  return (
    <div className="grid grid-cols-1 gap-3 overflow-x-auto sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {COLUMNAS.map((col) => {
        const leads = data.filter((l) => col.etapas.includes(l.estado));
        return (
          <div key={col.label} className="min-w-[180px] rounded-xl bg-muted/40 p-2.5">
            <div className="mb-2.5 flex items-center gap-1.5 px-1 text-[11px] font-bold text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: col.color }} />
              {col.label}
              <span className="ml-auto rounded-full border bg-background px-2 py-0.5 text-[10px]">{leads.length}</span>
            </div>
            <div className="space-y-2">
              {leads.length === 0 && (
                <div className="rounded-lg border-2 border-dashed py-6 text-center text-[10px] font-bold uppercase tracking-wide text-muted-foreground/60">
                  Vacío
                </div>
              )}
              {leads.map((l) => (
                <button
                  key={l.id}
                  onClick={() => onOpenLead(l.id)}
                  className="w-full rounded-lg border bg-card p-2.5 text-left shadow-sm transition-transform hover:-translate-y-0.5 hover:border-primary"
                >
                  <div className="text-[12px] font-bold leading-tight">{l.negocio || l.nombre}</div>
                  <div className="mt-0.5 text-[10.5px] text-muted-foreground capitalize">{l.canalAdquisicion}</div>
                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{l.sdrNombre ?? "Sin asignar"}</span>
                    <span>{formatDate(l.fechaLead)}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
