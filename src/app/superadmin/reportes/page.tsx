"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionHeader } from "@/components/superadmin/shared";
import { ReportesDisponiblesGrid } from "@/components/superadmin/reportes/ReportesDisponiblesGrid";
import { ReportesProgramadosTable } from "@/components/superadmin/reportes/ReportesProgramadosTable";
import { ProgramarReporteModal } from "@/components/superadmin/reportes/ProgramarReporteModal";

export default function ReportesPage() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <PageHeader title="Reportes" subtitle="Centro de descargas y reportes programados de la red." />

      <SectionHeader title="Reportes disponibles" />
      <div className="mb-6">
        <ReportesDisponiblesGrid />
      </div>

      <SectionHeader
        title="Reportes programados"
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
            <CalendarPlus className="h-3.5 w-3.5" />
            Programar reporte
          </Button>
        }
      />
      <ReportesProgramadosTable />

      <ProgramarReporteModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
