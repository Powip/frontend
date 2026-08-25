"use client";

import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useAlertasConfig, useToggleAlerta } from "@/hooks/superadmin/useConfig";
import { StatusBadge, TableSkeleton, BadgeTone, SimuladoBadge } from "@/components/superadmin/shared";
import { IAlertaConfig } from "@/interfaces/superadmin";

const SEVERIDAD_TONE: Record<IAlertaConfig["severidad"], BadgeTone> = {
  info: "gray",
  warning: "amber",
  critical: "red",
};

export function AlertasTab() {
  const { data, isLoading, isSimulado } = useAlertasConfig();
  const { mutate: toggle } = useToggleAlerta();

  function handleToggle(alerta: IAlertaConfig) {
    toggle(alerta.id, {
      onSuccess: () => toast.success(`Alerta "${alerta.nombre}" ${alerta.activo ? "desactivada" : "activada"}.`),
    });
  }

  if (isLoading || !data) return <TableSkeleton rows={5} cols={3} />;

  return (
    <div className="space-y-2.5">
      {isSimulado && (
        <div className="text-[11px] text-muted-foreground mb-1">
          <SimuladoBadge /> Configuración del motor de alertas — ver docs/superadmin/config-endpoints.md.
        </div>
      )}
      {data.map((a) => (
        <div key={a.id} className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">{a.nombre}</span>
              <StatusBadge label={a.severidad} tone={SEVERIDAD_TONE[a.severidad]} />
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{a.descripcion}</div>
          </div>
          <Switch checked={a.activo} onCheckedChange={() => handleToggle(a)} />
        </div>
      ))}
    </div>
  );
}
