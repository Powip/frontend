"use client";

import { Building2, CheckCircle2, AlertTriangle, FlaskConical, XCircle } from "lucide-react";
import { useKpisEmpresas } from "@/hooks/superadmin/useEmpresas";
import { KpiCard, KpiCardSkeleton } from "@/components/superadmin/shared";

export function EmpresasKpis() {
  const { data, isLoading } = useKpisEmpresas();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => <KpiCardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard icon={Building2} color="teal" label="Total" value={data.total} sub="Real — ms-company" />
      <KpiCard icon={CheckCircle2} color="green" label="Activos" value={data.activos} simulado sub="Sin campo de estado real todavía" />
      <KpiCard icon={AlertTriangle} color="amber" label="En riesgo" value={data.riesgo} simulado />
      <KpiCard icon={FlaskConical} color="blue" label="Trials" value={data.trials} simulado />
      <KpiCard icon={XCircle} color="red" label="Inactivos" value={data.inactivos} simulado />
    </div>
  );
}
