"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, ExportButton } from "@/components/superadmin/shared";
import { FiltersBar, SearchInput } from "@/components/superadmin/shared/FiltersBar";
import { EmpresasKpis } from "@/components/superadmin/empresas/EmpresasKpis";
import { EmpresasTable } from "@/components/superadmin/empresas/EmpresasTable";
import { AltaEmpresaModal } from "@/components/superadmin/shared/AltaEmpresaModal";
import { useEmpresasList } from "@/hooks/superadmin/useEmpresas";

export default function EmpresasPage() {
  const [q, setQ] = useState("");
  const [altaOpen, setAltaOpen] = useState(false);
  const { data: allForExport } = useEmpresasList({ q, page: 1, pageSize: 100000 });

  return (
    <div>
      <PageHeader
        title="Empresas"
        subtitle="Directorio de negocios activos y su expediente completo."
        actions={
          <>
            <ExportButton
              filename="empresas"
              rows={allForExport.map((e) => ({ Empresa: e.nombre, RUC: e.ruc, Canales: e.canalesVenta.join(", ") }))}
            />
            <Button size="sm" className="gap-1.5" onClick={() => setAltaOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Nueva Empresa
            </Button>
          </>
        }
      />

      <div className="mb-5">
        <EmpresasKpis />
      </div>

      <FiltersBar>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar por nombre o RUC…" />
      </FiltersBar>

      <EmpresasTable q={q} />

      <AltaEmpresaModal open={altaOpen} onOpenChange={setAltaOpen} />
    </div>
  );
}
