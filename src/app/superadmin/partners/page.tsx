"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, SearchInput, FiltersBar, ExportButton } from "@/components/superadmin/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PartnersKpis } from "@/components/superadmin/partners/PartnersKpis";
import { PartnersDashboardTab } from "@/components/superadmin/partners/PartnersDashboardTab";
import { PartnersTable } from "@/components/superadmin/partners/PartnersTable";
import { PartnerDetailDrawer } from "@/components/superadmin/partners/PartnerDetailDrawer";
import { ColaReferidosTab } from "@/components/superadmin/partners/ColaReferidosTab";
import { LiquidacionesTab } from "@/components/superadmin/partners/LiquidacionesTab";
import { ReglasComisionesTab } from "@/components/superadmin/partners/ReglasComisionesTab";
import { CasuisticaTab } from "@/components/superadmin/partners/CasuisticaTab";
import { EstadoPartner, NivelPartner } from "@/interfaces/superadmin";
import { usePartnersList } from "@/hooks/superadmin/usePartners";

export default function PartnersPage() {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<EstadoPartner | "todos">("todos");
  const [nivel, setNivel] = useState<NivelPartner | "todos">("todos");
  const [openPartnerId, setOpenPartnerId] = useState<string | null>(null);

  // Export sigue el mismo filtro que la tabla, sin volver a paginar (ver
  // docs/superadmin/partners-endpoints.md — el día que exista paginación
  // real en la base, esto pasa a delegar en un export server-side como ya
  // hace Adquisición, en vez de traer una página grande acá).
  const { data: exportData } = usePartnersList({ q, estado, nivel, page: 1, pageSize: 500 });

  return (
    <div>
      <PageHeader title="Partners" subtitle="Programa de referidos — agencias, developers y creadores que traen negocios a Powip." />

      <div className="mb-6">
        <PartnersKpis />
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="mb-4 flex-wrap h-auto justify-start gap-1 bg-transparent p-0">
          {[
            ["dashboard", "Dashboard"],
            ["partners", "Partners"],
            ["cola", "Cola de referidos"],
            ["liquidaciones", "Liquidaciones"],
            ["reglas", "Reglas & Comisiones"],
            ["casuistica", "Casuística"],
          ].map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs">
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dashboard">
          <PartnersDashboardTab />
        </TabsContent>

        <TabsContent value="partners">
          <FiltersBar>
            <SearchInput value={q} onChange={setQ} placeholder="Buscar por nombre, handle o código…" />
            <Select value={estado} onValueChange={(v) => setEstado(v as EstadoPartner | "todos")}>
              <SelectTrigger className="h-9 w-[150px] text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">Todos los estados</SelectItem>
                <SelectItem value="activo" className="text-xs">Activo</SelectItem>
                <SelectItem value="pendiente" className="text-xs">Pendiente</SelectItem>
                <SelectItem value="suspendido" className="text-xs">Suspendido</SelectItem>
              </SelectContent>
            </Select>
            <Select value={nivel} onValueChange={(v) => setNivel(v as NivelPartner | "todos")}>
              <SelectTrigger className="h-9 w-[140px] text-xs">
                <SelectValue placeholder="Nivel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">Todos los niveles</SelectItem>
                <SelectItem value="Base" className="text-xs">Base</SelectItem>
                <SelectItem value="Plata" className="text-xs">Plata</SelectItem>
                <SelectItem value="Oro" className="text-xs">Oro</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto">
              <ExportButton
                filename="partners"
                rows={exportData.data.map((p) => ({
                  Nombre: p.nombre,
                  Handle: p.handle,
                  Tipo: p.tipo,
                  Nivel: p.nivel,
                  Estado: p.estado,
                  Opcion: p.opcionComision,
                  MRR: p.mrrActivo,
                  Referidos: p.referidosCount,
                }))}
              />
            </div>
          </FiltersBar>
          <PartnersTable q={q} estado={estado} nivel={nivel} onOpenPartner={setOpenPartnerId} />
        </TabsContent>

        <TabsContent value="cola">
          <ColaReferidosTab />
        </TabsContent>

        <TabsContent value="liquidaciones">
          <LiquidacionesTab />
        </TabsContent>

        <TabsContent value="reglas">
          <ReglasComisionesTab />
        </TabsContent>

        <TabsContent value="casuistica">
          <CasuisticaTab />
        </TabsContent>
      </Tabs>

      <PartnerDetailDrawer partnerId={openPartnerId} onClose={() => setOpenPartnerId(null)} />
    </div>
  );
}
