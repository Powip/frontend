"use client";

import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useSeguridadConfig, useToggleSeguridad, type ISeguridadItem } from "@/hooks/superadmin/useConfig";
import { SimuladoBadge, TableSkeleton } from "@/components/superadmin/shared";

export function SeguridadTab() {
  const { data, isLoading, isSimulado } = useSeguridadConfig();
  const { mutate: toggle } = useToggleSeguridad();

  function handleToggle(item: ISeguridadItem) {
    toggle(item.clave, {
      onSuccess: () => toast.success(`"${item.label}" ${item.activo ? "desactivado" : "activado"}.`),
    });
  }

  if (isLoading || !data) return <TableSkeleton rows={4} cols={2} />;

  return (
    <div className="space-y-2.5">
      {isSimulado && (
        <div className="text-[11px] text-muted-foreground mb-1">
          <SimuladoBadge /> No existe motor de políticas de seguridad real todavía — ver docs/superadmin/config-endpoints.md.
        </div>
      )}
      {data.map((i) => (
        <div key={i.clave} className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold">{i.label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{i.descripcion}</div>
          </div>
          <Switch checked={i.activo} onCheckedChange={() => handleToggle(i)} />
        </div>
      ))}
    </div>
  );
}
