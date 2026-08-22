"use client";

import { useCentroAccion, useMarcarTareaHecha } from "@/hooks/superadmin/useDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { StatusBadge, SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";

export function CentroAccionCard() {
  const { data, isSimulado } = useCentroAccion();
  const { mutate: marcarHecho } = useMarcarTareaHecha();

  return (
    <Card className={cn("shadow-sm", isSimulado && SIMULADO_CARD_CLASS)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-[13px] font-bold">
          Centro de Acción
          {isSimulado && <SimuladoBadge />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {data.data.map((t) => (
            <button
              key={t.id}
              onClick={() => marcarHecho({ id: t.id, hecho: !t.hecho })}
              className="flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
            >
              <Checkbox checked={t.hecho} className="pointer-events-none" />
              <span className={cn("flex-1 text-xs font-medium", t.hecho && "line-through text-muted-foreground")}>{t.texto}</span>
              <StatusBadge
                label={t.prioridad}
                tone={t.prioridad === "Alta" ? "red" : t.prioridad === "Media" ? "amber" : "gray"}
                className="shrink-0 text-[9.5px] px-1.5 py-0"
              />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
