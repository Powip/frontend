"use client";

import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useParametrosConfig, useToggleParametro } from "@/hooks/superadmin/useConfig";
import { TableSkeleton, SimuladoBadge } from "@/components/superadmin/shared";
import { IParametroGeneral } from "@/interfaces/superadmin";

export function ParametrosTab() {
  const { data, isLoading, isSimulado } = useParametrosConfig();
  const { mutate: toggle } = useToggleParametro();

  function handleToggle(p: IParametroGeneral) {
    toggle(p.clave, {
      onSuccess: () => toast.success(`"${p.label}" ${p.activo ? "desactivado" : "activado"}.`),
    });
  }

  if (isLoading || !data) return <TableSkeleton rows={4} cols={2} />;

  return (
    <div className="space-y-2.5">
      {isSimulado && (
        <div className="text-[11px] text-muted-foreground mb-1">
          <SimuladoBadge /> No existe store de configuración real todavía — ver docs/superadmin/config-endpoints.md.
        </div>
      )}
      {data.map((p) => (
        <div key={p.clave} className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold">{p.label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{p.descripcion}</div>
          </div>
          <Switch checked={p.activo} onCheckedChange={() => handleToggle(p)} />
        </div>
      ))}
    </div>
  );
}
