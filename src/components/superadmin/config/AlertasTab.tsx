"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { getAlertas, toggleAlerta } from "@/services/superadmin/configService";
import { StatusBadge, TableSkeleton, BadgeTone } from "@/components/superadmin/shared";
import { IAlertaConfig } from "@/interfaces/superadmin";

const SEVERIDAD_TONE: Record<IAlertaConfig["severidad"], BadgeTone> = {
  info: "gray",
  warning: "amber",
  critical: "red",
};

export function AlertasTab() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["superadmin", "config", "alertas"], queryFn: getAlertas });

  const { mutate: toggle } = useMutation({
    mutationFn: toggleAlerta,
    onSuccess: (alerta) => {
      if (!alerta) return;
      queryClient.invalidateQueries({ queryKey: ["superadmin", "config", "alertas"] });
      toast.success(`Alerta "${alerta.nombre}" ${alerta.activo ? "activada" : "desactivada"}.`);
    },
  });

  if (isLoading || !data) return <TableSkeleton rows={5} cols={3} />;

  return (
    <div className="space-y-2.5">
      {data.map((a) => (
        <div key={a.id} className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">{a.nombre}</span>
              <StatusBadge label={a.severidad} tone={SEVERIDAD_TONE[a.severidad]} />
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{a.descripcion}</div>
          </div>
          <Switch checked={a.activo} onCheckedChange={() => toggle(a.id)} />
        </div>
      ))}
    </div>
  );
}
