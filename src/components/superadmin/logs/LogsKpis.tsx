"use client";

import { ScrollText, Info, AlertTriangle, XOctagon } from "lucide-react";
import { useKpisLogs } from "@/hooks/superadmin/useLogs";
import { KpiCard, KpiCardSkeleton, KpiRow } from "@/components/superadmin/shared";

export function LogsKpis() {
  const { data, isLoading, isSimulado } = useKpisLogs();

  if (isLoading || !data) {
    return (
      <KpiRow>
        {Array.from({ length: 4 }, (_, i) => <KpiCardSkeleton key={i} />)}
      </KpiRow>
    );
  }

  return (
    <KpiRow>
      <KpiCard icon={ScrollText} color="teal" label="Total eventos" value={data.total} simulado={isSimulado} />
      <KpiCard icon={Info} color="blue" label="Info" value={data.info} simulado={isSimulado} />
      <KpiCard icon={AlertTriangle} color="amber" label="Warn" value={data.warn} simulado={isSimulado} />
      <KpiCard icon={XOctagon} color="red" label="Error" value={data.error} simulado={isSimulado} />
    </KpiRow>
  );
}
