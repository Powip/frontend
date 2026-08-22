"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { getPlanes, togglePlan } from "@/services/superadmin/configService";
import { TableSkeleton } from "@/components/superadmin/shared";
import { money } from "@/components/superadmin/shared/format";

export function PlanesTab() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ["superadmin", "config", "planes"], queryFn: getPlanes });

  const { mutate: toggle } = useMutation({
    mutationFn: togglePlan,
    onSuccess: (plan) => {
      if (!plan) return;
      queryClient.invalidateQueries({ queryKey: ["superadmin", "config", "planes"] });
      toast.success(`Plan ${plan.nombre} ${plan.activo ? "activado" : "desactivado"}.`);
    },
  });

  if (isLoading || !data) return <TableSkeleton rows={4} cols={5} />;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plan</TableHead>
            <TableHead>Precio mensual</TableHead>
            <TableHead>Precio anual</TableHead>
            <TableHead>Límite de usuarios</TableHead>
            <TableHead>Activo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((p) => (
            <TableRow key={p.nombre}>
              <TableCell className="text-xs font-semibold">{p.nombre}</TableCell>
              <TableCell className="text-xs">{money(p.precioMensual)}</TableCell>
              <TableCell className="text-xs">{money(p.precioAnual)}</TableCell>
              <TableCell className="text-xs">{p.limiteUsuarios >= 999 ? "Ilimitado" : p.limiteUsuarios}</TableCell>
              <TableCell>
                <Switch checked={p.activo} onCheckedChange={() => toggle(p.nombre)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
