"use client";

import Link from "next/link";
import { useAlertasOportunidad } from "@/hooks/superadmin/useOportunidades";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, EmptyBlock, SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { relativeTime } from "@/components/superadmin/shared/format";
import { BellRing } from "lucide-react";
import { cn } from "@/lib/utils";

export function AlertasProactivasCard() {
  const { data, isSimulado } = useAlertasOportunidad();

  return (
    <Card className={cn("shadow-sm h-full", isSimulado && SIMULADO_CARD_CLASS)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">
          Alertas proactivas
          {isSimulado && <SimuladoBadge />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!data.length && <EmptyBlock icon={BellRing} title="Sin alertas activas" description="No hay señales de riesgo o trials sin activar." />}
        {!!data.length && (
          <ul className="space-y-2">
            {data.map((a) => (
              <li key={a.id} className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5">
                <StatusBadge
                  label={a.severidad === "critical" ? "Crítico" : a.severidad === "warning" ? "Atención" : "Info"}
                  tone={a.severidad === "critical" ? "red" : a.severidad === "warning" ? "amber" : "blue"}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold">{a.texto}</div>
                  <div className="text-[10.5px] text-muted-foreground">{relativeTime(a.ts)}</div>
                </div>
                <Button asChild size="sm" variant="outline" className="h-7 shrink-0 text-[11px]">
                  <Link href="/superadmin/empresas">Atender</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
