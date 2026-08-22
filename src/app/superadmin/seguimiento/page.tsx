"use client";

import { useState } from "react";
import { PageHeader } from "@/components/superadmin/shared";
import { SeguimientoKpis } from "@/components/superadmin/seguimiento/SeguimientoKpis";
import { SeguimientoTable } from "@/components/superadmin/seguimiento/SeguimientoTable";
import { FiltroVencimiento } from "@/hooks/superadmin/useSeguimiento";
import { cn } from "@/lib/utils";

const FILTROS: { value: FiltroVencimiento; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "vencidos", label: "Vencidos" },
  { value: "hoy", label: "Hoy" },
  { value: "proximos", label: "Próximos" },
];

export default function SeguimientoPage() {
  const [filtro, setFiltro] = useState<FiltroVencimiento>("todos");

  return (
    <div>
      <PageHeader title="Seguimiento" subtitle="Bandeja unificada de follow-up — leads (pre-venta) y cuentas activas (postventa)." />

      <div className="mb-5">
        <SeguimientoKpis />
      </div>

      <div className="mb-3.5 flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFiltro(f.value)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
              filtro === f.value ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <SeguimientoTable filtro={filtro} />
    </div>
  );
}
