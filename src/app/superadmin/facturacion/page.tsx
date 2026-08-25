"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, ExportButton } from "@/components/superadmin/shared";
import { FiltersBar, SearchInput } from "@/components/superadmin/shared/FiltersBar";
import { FacturacionKpis } from "@/components/superadmin/facturacion/FacturacionKpis";
import { FacturasTable } from "@/components/superadmin/facturacion/FacturasTable";
import { CobranzaDunningTable } from "@/components/superadmin/facturacion/CobranzaDunningTable";
import { EstadoFactura } from "@/interfaces/superadmin";
import { useFacturas } from "@/hooks/superadmin/useFacturacion";

export default function FacturacionPage() {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<EstadoFactura | "todos">("todos");
  const { data: allForExport } = useFacturas({ q, estado, page: 1, pageSize: 100000 });

  return (
    <div>
      <PageHeader
        title="Facturación"
        subtitle="Cobro de la suscripción de POWIP a sus negocios cliente."
        actions={
          <ExportButton
            filename="facturacion"
            rows={allForExport.map((f) => ({
              ID: f.id,
              Empresa: f.empresaNombre,
              Plan: f.plan,
              Monto: f.monto,
              Emision: f.fechaEmision,
              Vence: f.fechaVence,
              Estado: f.estado,
            }))}
          />
        }
      />

      <FacturacionKpis />

      <Tabs defaultValue="facturas" className="mt-6">
        <TabsList>
          <TabsTrigger value="facturas">Facturas</TabsTrigger>
          <TabsTrigger value="cobranza">Cobranza</TabsTrigger>
        </TabsList>

        <TabsContent value="facturas" className="mt-4">
          <FiltersBar>
            <SearchInput value={q} onChange={setQ} placeholder="Buscar por empresa o N° de factura…" />
            <Select value={estado} onValueChange={(v) => setEstado(v as EstadoFactura | "todos")}>
              <SelectTrigger className="h-9 w-[140px] text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {(["pagado", "pendiente", "vencido"] as EstadoFactura[]).map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FiltersBar>
          <FacturasTable q={q} estado={estado} />
        </TabsContent>

        <TabsContent value="cobranza" className="mt-4">
          <CobranzaDunningTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
