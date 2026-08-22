"use client";

import { LayoutGrid, List, Plus, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/superadmin/shared/FiltersBar";
import { ExportButton } from "@/components/superadmin/shared";
import { cn } from "@/lib/utils";
import { EstadoLead, ILead } from "@/interfaces/superadmin";
import { ESTADO_LEAD_LABEL } from "@/components/superadmin/shared/StatusBadge";
import { useRendimientoSdr, LeadsFilters } from "@/hooks/superadmin/useAdquisicion";

const ESTADOS: EstadoLead[] = [
  "nuevo", "contactado", "respondio", "demo_pendiente", "demo_agendada", "demo_realizada",
  "pendiente_decision", "pendiente_pago", "pago_recibido", "cerrado", "perdido", "cancelado",
];
const CANALES = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "landing", label: "Landing" },
  { value: "google_form", label: "Google Form" },
  { value: "referido", label: "Referido" },
  { value: "calendly", label: "Calendly" },
  { value: "otro", label: "Otro" },
];

interface Props {
  filters: LeadsFilters;
  onChange: (f: LeadsFilters) => void;
  view: "kanban" | "lista";
  onViewChange: (v: "kanban" | "lista") => void;
  onNuevoProspecto: () => void;
  currentPageRows: ILead[];
}

export function LeadsFiltersToolbar({ filters, onChange, view, onViewChange, onNuevoProspecto, currentPageRows }: Props) {
  const { data: sdrs } = useRendimientoSdr();

  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
      <SearchInput value={filters.q ?? ""} onChange={(q) => onChange({ ...filters, q, page: 1 })} placeholder="Buscar lead…" />

      <Select value={filters.estado ?? "todos"} onValueChange={(v) => onChange({ ...filters, estado: v as EstadoLead | "todos", page: 1 })}>
        <SelectTrigger className="h-9 w-[160px] text-xs">
          <SelectValue placeholder="Estado" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los estados</SelectItem>
          {ESTADOS.map((e) => (
            <SelectItem key={e} value={e}>
              {ESTADO_LEAD_LABEL[e]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.canal ?? "todos"} onValueChange={(v) => onChange({ ...filters, canal: v, page: 1 })}>
        <SelectTrigger className="h-9 w-[150px] text-xs">
          <SelectValue placeholder="Canal" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los canales</SelectItem>
          {CANALES.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.sdrNombre ?? "todos"} onValueChange={(v) => onChange({ ...filters, sdrNombre: v, page: 1 })}>
        <SelectTrigger className="h-9 w-[160px] text-xs">
          <SelectValue placeholder="SDR" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos los SDR</SelectItem>
          {sdrs.map((s) => (
            <SelectItem key={s.sdrNombre} value={s.sdrNombre}>
              {s.sdrNombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="inline-flex rounded-lg bg-muted p-0.5">
        <button
          onClick={() => onViewChange("kanban")}
          className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold", view === "kanban" ? "bg-background shadow-sm text-primary" : "text-muted-foreground")}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Kanban
        </button>
        <button
          onClick={() => onViewChange("lista")}
          className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold", view === "lista" ? "bg-background shadow-sm text-primary" : "text-muted-foreground")}
        >
          <List className="h-3.5 w-3.5" />
          Lista
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ExportButton
          label="Exportar página"
          filename="leads_filtrado"
          rows={currentPageRows.map((l) => ({ Negocio: l.negocio || l.nombre, Canal: l.canalAdquisicion, SDR: l.sdrNombre, Estado: l.estado, WhatsApp: l.whatsapp }))}
        />
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.open("/api/superadmin/reports/crm/excel", "_blank")}>
          <Download className="h-3.5 w-3.5" />
          BBDD completa
        </Button>
        <Button size="sm" className="gap-1.5" onClick={onNuevoProspecto}>
          <Plus className="h-3.5 w-3.5" />
          Nuevo Prospecto
        </Button>
      </div>
    </div>
  );
}
