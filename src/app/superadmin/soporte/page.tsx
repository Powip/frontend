"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/superadmin/shared";
import { FiltersBar } from "@/components/superadmin/shared/FiltersBar";
import { SoporteKpis } from "@/components/superadmin/soporte/SoporteKpis";
import { SoporteTable } from "@/components/superadmin/soporte/SoporteTable";
import { TicketDetailDrawer } from "@/components/superadmin/soporte/TicketDetailDrawer";
import { PrioridadTicket } from "@/interfaces/superadmin";

export default function SoportePage() {
  const [prioridad, setPrioridad] = useState<PrioridadTicket | "todas">("todas");
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader title="Soporte" subtitle="Bandeja de tickets de todas las empresas." />

      <div className="mb-5">
        <SoporteKpis />
      </div>

      <FiltersBar>
        <Select value={prioridad} onValueChange={(v) => setPrioridad(v as PrioridadTicket | "todas")}>
          <SelectTrigger className="h-9 w-[160px] text-xs">
            <SelectValue placeholder="Prioridad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las prioridades</SelectItem>
            <SelectItem value="Alta">Alta</SelectItem>
            <SelectItem value="Media">Media</SelectItem>
            <SelectItem value="Baja">Baja</SelectItem>
          </SelectContent>
        </Select>
      </FiltersBar>

      <SoporteTable prioridad={prioridad} onOpenTicket={setOpenTicketId} />

      <TicketDetailDrawer ticketId={openTicketId} onClose={() => setOpenTicketId(null)} />
    </div>
  );
}
