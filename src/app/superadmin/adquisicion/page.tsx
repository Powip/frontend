"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, SectionHeader } from "@/components/superadmin/shared";
import { AdquisicionKpis } from "@/components/superadmin/adquisicion/AdquisicionKpis";
import { BandejaAbordarAhora } from "@/components/superadmin/adquisicion/BandejaAbordarAhora";
import { RendimientoSdrTable } from "@/components/superadmin/adquisicion/RendimientoSdrTable";
import { LeadsFiltersToolbar } from "@/components/superadmin/adquisicion/LeadsFiltersToolbar";
import { LeadsKanbanView } from "@/components/superadmin/adquisicion/LeadsKanbanView";
import { LeadsListView } from "@/components/superadmin/adquisicion/LeadsListView";
import { LeadDetailDrawer } from "@/components/superadmin/adquisicion/LeadDetailDrawer";
import { NuevoProspectoModal } from "@/components/superadmin/adquisicion/NuevoProspectoModal";
import { AgendarDemoModal } from "@/components/superadmin/adquisicion/AgendarDemoModal";
import { LeadsDashboardTab } from "@/components/superadmin/adquisicion/LeadsDashboardTab";
import { DemosTab } from "@/components/superadmin/adquisicion/DemosTab";
import { LeadsFilters } from "@/hooks/superadmin/useAdquisicion";
import { ILead } from "@/interfaces/superadmin";

export default function AdquisicionPage() {
  const [filters, setFilters] = useState<LeadsFilters>({ estado: "todos", canal: "todos", sdrNombre: "todos", page: 1 });
  const [view, setView] = useState<"kanban" | "lista">("kanban");
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [demoLeadId, setDemoLeadId] = useState<string | null>(null);
  const [nuevoProspectoOpen, setNuevoProspectoOpen] = useState(false);
  const [currentPageRows, setCurrentPageRows] = useState<ILead[]>([]);

  return (
    <div>
      <PageHeader title="Adquisición" subtitle="Leads y negocios que llegan por la web y por captación manual." />

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs font-medium text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Esto NO son tus empresas activas — es el pipeline de adquisición. Los negocios pasan a "Empresas" al convertirse.
      </div>

      <div className="mb-6">
        <AdquisicionKpis />
      </div>

      <Tabs defaultValue="pipeline">
        <TabsList className="mb-4">
          <TabsTrigger value="pipeline" className="text-xs">
            Bandeja & Pipeline
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="text-xs">
            Dashboard (Origen & CAC)
          </TabsTrigger>
          <TabsTrigger value="demos" className="text-xs">
            Demos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <div className="mb-5">
            <BandejaAbordarAhora onOpenLead={setOpenLeadId} />
          </div>
          <div className="mb-6">
            <RendimientoSdrTable />
          </div>

          <SectionHeader title="Pipeline" sub="Kanban o lista — mismo dato, mismos filtros" />
          <LeadsFiltersToolbar
            filters={filters}
            onChange={setFilters}
            view={view}
            onViewChange={setView}
            onNuevoProspecto={() => setNuevoProspectoOpen(true)}
            currentPageRows={currentPageRows}
          />
          {view === "kanban" ? (
            <LeadsKanbanView filters={filters} onOpenLead={setOpenLeadId} />
          ) : (
            <LeadsListView filters={filters} onOpenLead={setOpenLeadId} onPageChange={(page) => setFilters((f) => ({ ...f, page }))} onRowsLoaded={setCurrentPageRows} />
          )}
        </TabsContent>

        <TabsContent value="dashboard">
          <LeadsDashboardTab />
        </TabsContent>

        <TabsContent value="demos">
          <DemosTab />
        </TabsContent>
      </Tabs>

      <LeadDetailDrawer leadId={openLeadId} onClose={() => setOpenLeadId(null)} onAgendarDemo={setDemoLeadId} />
      <AgendarDemoModal leadId={demoLeadId} onOpenChange={(o) => !o && setDemoLeadId(null)} />
      <NuevoProspectoModal open={nuevoProspectoOpen} onOpenChange={setNuevoProspectoOpen} />
    </div>
  );
}
