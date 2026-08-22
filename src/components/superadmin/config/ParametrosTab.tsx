"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { getParametros, toggleParametro } from "@/services/superadmin/configService";
import { TableSkeleton } from "@/components/superadmin/shared";

export function ParametrosTab() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["superadmin", "config", "parametros"], queryFn: getParametros });

  const { mutate: toggle } = useMutation({
    mutationFn: toggleParametro,
    onSuccess: (parametro) => {
      if (!parametro) return;
      queryClient.invalidateQueries({ queryKey: ["superadmin", "config", "parametros"] });
      toast.success(`"${parametro.label}" ${parametro.activo ? "activado" : "desactivado"}.`);
    },
  });

  if (isLoading || !data) return <TableSkeleton rows={4} cols={2} />;

  return (
    <div className="space-y-2.5">
      {data.map((p) => (
        <div key={p.clave} className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold">{p.label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{p.descripcion}</div>
          </div>
          <Switch checked={p.activo} onCheckedChange={() => toggle(p.clave)} />
        </div>
      ))}
    </div>
  );
}
