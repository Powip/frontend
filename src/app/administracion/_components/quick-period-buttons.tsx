"use client";

import { useMemo } from "react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";

type QuickPeriod = "hoy" | "semana" | "quincena" | "mes";

const OPCIONES: { value: QuickPeriod; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Semana" },
  { value: "quincena", label: "Quincena" },
  { value: "mes", label: "Mes" },
];

function rango(periodo: QuickPeriod) {
  const hoy = new Date();
  if (periodo === "hoy") return { from: hoy, to: hoy };
  if (periodo === "semana") return { from: subDays(hoy, 6), to: hoy };
  if (periodo === "quincena") return { from: subDays(hoy, 14), to: hoy };
  // Mes calendario completo — coincide con el preset "Mes Actual" del
  // selector de fecha general, así ambos controles quedan sincronizados.
  return { from: startOfMonth(hoy), to: endOfMonth(hoy) };
}

function rangoStr(periodo: QuickPeriod) {
  const { from, to } = rango(periodo);
  return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") };
}

// Atajos que fijan el periodo general del módulo (`AdminPeriodContext`),
// el mismo que consume el selector de fecha del topbar. El botón activo se
// calcula comparando ese periodo compartido contra cada atajo, no con
// estado propio, para quedar sincronizado en ambos sentidos.
export function QuickPeriodButtons() {
  const { fromDate, toDate, setPeriod } = useAdminPeriod();

  const activo = useMemo(() => {
    return (
      OPCIONES.find((o) => {
        const r = rangoStr(o.value);
        return r.from === fromDate && r.to === toDate;
      })?.value ?? null
    );
  }, [fromDate, toDate]);

  const handleClick = (periodo: QuickPeriod) => {
    const r = rangoStr(periodo);
    setPeriod(r.from, r.to);
  };

  return (
    <div className="inline-flex bg-muted rounded-lg p-1 gap-1">
      {OPCIONES.map((o) => (
        <button
          key={o.value}
          onClick={() => handleClick(o.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            activo === o.value
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
