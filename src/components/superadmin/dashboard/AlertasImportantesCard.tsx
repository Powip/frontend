"use client";

import { useAlertasImportantes } from "@/hooks/superadmin/useDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyBlock, SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { relativeTime } from "@/components/superadmin/shared/format";
import { BellRing } from "lucide-react";
import { cn } from "@/lib/utils";

export function AlertasImportantesCard() {
  const { data, isLoading, isSimulado } = useAlertasImportantes();
  const alertas = data.data;

  return (
    <Card className={cn("shadow-sm h-full", isSimulado && SIMULADO_CARD_CLASS)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">
          Alertas importantes
          {isSimulado && <SimuladoBadge />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-muted/50" />)}</div>}
        {!isLoading && !alertas.length && <EmptyBlock icon={BellRing} title="Sin alertas" description="Todo tranquilo por ahora." />}
        {!isLoading && !!alertas.length && (
          <ul className="space-y-0.5">
            {alertas.map((a) => (
              <li key={a.id} className="flex items-start gap-2.5 border-b border-border/60 py-2.5 last:border-0 last:pb-0">
                <span
                  className={
                    "mt-1 h-2 w-2 shrink-0 rounded-full " +
                    (a.severidad === "critical" ? "bg-red-500" : a.severidad === "warning" ? "bg-amber-500" : "bg-blue-500")
                  }
                />
                <span className="flex-1 text-xs font-medium">{a.texto}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{relativeTime(a.ts)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
