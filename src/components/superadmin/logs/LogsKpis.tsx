"use client";

import { useQuery } from "@tanstack/react-query";
import { ScrollText, Info, AlertTriangle, XOctagon } from "lucide-react";
import { getKpisLogs } from "@/services/superadmin/logsService";
import { KpiCard, KpiCardSkeleton, KpiRow } from "@/components/superadmin/shared";

export function LogsKpis() {
  const { data, isLoading } = useQuery({ queryKey: ["superadmin", "logs", "kpis"], queryFn: getKpisLogs });

  if (isLoading || !data) {
    return (
      <KpiRow>
        {Array.from({ length: 4 }, (_, i) => <KpiCardSkeleton key={i} />)}
      </KpiRow>
    );
  }

  return (
    <KpiRow>
      <KpiCard icon={ScrollText} color="teal" label="Total eventos" value={data.total} />
      <KpiCard icon={Info} color="blue" label="Info" value={data.info} />
      <KpiCard icon={AlertTriangle} color="amber" label="Warn" value={data.warn} />
      <KpiCard icon={XOctagon} color="red" label="Error" value={data.error} />
    </KpiRow>
  );
}
