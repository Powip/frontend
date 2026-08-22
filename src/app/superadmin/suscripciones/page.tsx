"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, SectionHeader, ExportButton } from "@/components/superadmin/shared";
import { FiltersBar, SearchInput } from "@/components/superadmin/shared/FiltersBar";
import { SuscripcionesKpis } from "@/components/superadmin/suscripciones/SuscripcionesKpis";
import { MrrHistoricoCard } from "@/components/superadmin/suscripciones/MrrHistoricoCard";
import { MrrPorPlanCard } from "@/components/superadmin/suscripciones/MrrPorPlanCard";
import { EstadoSuscripcionesCard } from "@/components/superadmin/suscripciones/EstadoSuscripcionesCard";
import { SuscripcionesTable } from "@/components/superadmin/suscripciones/SuscripcionesTable";
import { ProximosVencimientosCard } from "@/components/superadmin/suscripciones/ProximosVencimientosCard";
import { EstadoSuscripcion, PlanEmpresa } from "@/interfaces/superadmin";
import { suscripcionesMock } from "@/mocks/superadmin";

export default function SuscripcionesPage() {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<EstadoSuscripcion | "todos">("todos");
  const [plan, setPlan] = useState<PlanEmpresa | "todos">("todos");

  return (
    <div>
      <PageHeader
        title="Suscripciones"
        subtitle="Estado de todas las suscripciones activas del SaaS."
        actions={
          <ExportButton
            filename="suscripciones"
            rows={suscripcionesMock.map((s) => ({
              Empresa: s.empresaNombre,
              Plan: s.plan,
              Ciclo: s.ciclo,
              MRR: s.mrr,
              Estado: s.estado,
              ProximoPago: s.proximoPago,
              Metodo: s.metodoPago,
            }))}
          />
        }
      />

      <SuscripcionesKpis />

      <SectionHeader num={1} title="MRR histórico, por plan y estado" className="mt-7" />
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[1.4fr_1fr_1fr]">
        <MrrHistoricoCard />
        <MrrPorPlanCard />
        <EstadoSuscripcionesCard />
      </div>

      <SectionHeader num={2} title="Suscripciones y próximos vencimientos" className="mt-7" />
      <div className="grid grid-cols-1 gap-3.5 xl:grid-cols-[2fr_1fr]">
        <div>
          <FiltersBar>
            <SearchInput value={q} onChange={setQ} placeholder="Buscar por empresa o método de pago…" />
            <Select value={estado} onValueChange={(v) => setEstado(v as EstadoSuscripcion | "todos")}>
              <SelectTrigger className="h-9 w-[140px] text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los estados</SelectItem>
                {(["activa", "trial", "vencida", "cancelada"] as EstadoSuscripcion[]).map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={plan} onValueChange={(v) => setPlan(v as PlanEmpresa | "todos")}>
              <SelectTrigger className="h-9 w-[140px] text-xs">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los planes</SelectItem>
                {(["Trial", "Basic", "Pro", "Scale", "Enterprise"] as PlanEmpresa[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FiltersBar>
          <SuscripcionesTable q={q} estado={estado} plan={plan} />
        </div>
        <ProximosVencimientosCard />
      </div>
    </div>
  );
}
