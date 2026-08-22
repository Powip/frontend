"use client";

import Link from "next/link";
import { useTopEmpresas } from "@/hooks/superadmin/useDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, ESTADO_EMPRESA_TONE, SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { money } from "@/components/superadmin/shared/format";
import { cn } from "@/lib/utils";

export function ClientesTopCard() {
  const { data, isSimulado } = useTopEmpresas(6);

  return (
    <Card className={cn("shadow-sm", isSimulado && SIMULADO_CARD_CLASS)}>
      <CardHeader className="pb-2 flex flex-row items-center">
        <CardTitle className="text-[13px] font-bold">
          Clientes (Empresas)
          {isSimulado && <SimuladoBadge />}
        </CardTitle>
        <Link href="/superadmin/empresas" className="ml-auto text-[11px] font-semibold text-primary hover:underline">
          Ver todas →
        </Link>
      </CardHeader>
      <CardContent className="space-y-0.5">
        {data.data.map((e) => (
          <Link
            key={e.empresaId}
            href={`/superadmin/empresas/${e.empresaId}`}
            className="flex items-center gap-3 rounded-lg border-b border-border/60 py-2.5 px-1 last:border-0 hover:bg-muted/40 -mx-1"
          >
            <span className={`flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold text-white ${e.colorAvatar ?? "bg-primary"}`}>
              {e.logoIniciales ?? e.nombre.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">{e.nombre}</div>
              <div className="text-[10.5px] text-muted-foreground">{e.plan}</div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold">{money(e.mrr)}</div>
              <StatusBadge label={e.estado} tone={ESTADO_EMPRESA_TONE[e.estado] ?? "gray"} className="mt-0.5 text-[9.5px] px-1.5 py-0" />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
