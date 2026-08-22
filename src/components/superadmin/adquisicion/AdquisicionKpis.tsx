"use client";

import { Inbox, Video, Wallet, Globe, Percent } from "lucide-react";
import { useKpisAdquisicion } from "@/hooks/superadmin/useAdquisicion";
import { KpiCard, KpiCardSkeleton } from "@/components/superadmin/shared";

export function AdquisicionKpis() {
  const { data, isLoading, simuladoFields } = useKpisAdquisicion();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => <KpiCardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <KpiCard icon={Inbox} color="red" label="Sin abordar" value={data.sinAbordar} sub="Leads en etapa nuevo" />
      <KpiCard icon={Video} color="blue" label="Demos hoy" value={data.demosHoy} simulado={simuladoFields.includes("demosHoy")} />
      <KpiCard icon={Wallet} color="green" label="Pagos web hoy" value={data.pagosWebHoy} simulado={simuladoFields.includes("pagosWebHoy")} />
      <KpiCard icon={Globe} color="violet" label="Leads total" value={data.leadsWebTotal} sub="Aproximado — falta desglose por canal" />
      <KpiCard icon={Percent} color="teal" label="Conversión web" value={`${data.conversionWebPct}%`} simulado={simuladoFields.includes("conversionWebPct")} />
    </div>
  );
}
