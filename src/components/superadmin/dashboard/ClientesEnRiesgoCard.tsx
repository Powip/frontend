"use client";

import Link from "next/link";
import { useClientesEnRiesgo } from "@/hooks/superadmin/useDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gauge } from "@/components/superadmin/shared/charts/Gauge";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { EmptyBlock, SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { cn } from "@/lib/utils";

export function ClientesEnRiesgoCard() {
  const { data, isSimulado } = useClientesEnRiesgo(10);
  const clientes = data.data;

  return (
    <Card className={cn("shadow-sm h-full", isSimulado && SIMULADO_CARD_CLASS)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">
          Clientes en riesgo
          {isSimulado && <SimuladoBadge />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Gauge value={clientes.length} max={10} label="empresas con salud crítica esta semana" tone="red" />
        {!clientes.length ? (
          <EmptyBlock icon={AlertTriangle} title="Sin cuentas críticas" description="Ninguna empresa está en riesgo alto hoy." />
        ) : (
          <ul className="mt-2 space-y-2">
            {clientes.map((c) => (
              <li key={c.empresaId} className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold">{c.empresaNombre}</div>
                  <div className="truncate text-[10.5px] text-muted-foreground">{c.motivo}</div>
                </div>
                <Button asChild size="sm" variant="outline" className="h-7 shrink-0 text-[11px]">
                  <Link href={`/superadmin/empresas/${c.empresaId}`}>Contactar</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
