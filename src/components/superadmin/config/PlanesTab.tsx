"use client";

import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { usePlanesConfig, useTogglePlanConfig } from "@/hooks/superadmin/useConfig";
import { TableSkeleton, SimuladoBadge, SIMULADO_CARD_CLASS } from "@/components/superadmin/shared";
import { money } from "@/components/superadmin/shared/format";
import { cn } from "@/lib/utils";

export function PlanesTab() {
  const { data, isLoading, isSimulado, camposDerivadosSimulados } = usePlanesConfig();
  const { mutate: toggle } = useTogglePlanConfig();

  function handleToggle(row: (typeof data)[number]) {
    toggle(row, {
      onSuccess: (plan) => toast.success(`Plan ${plan.nombre} ${plan.activo ? "activado" : "desactivado"}.`),
    });
  }

  if (isLoading || !data) return <TableSkeleton rows={4} cols={5} />;

  return (
    <div>
      {(isSimulado || camposDerivadosSimulados) && (
        <div className={cn("mb-3 rounded-lg border p-3 text-[11px] text-muted-foreground", SIMULADO_CARD_CLASS)}>
          <SimuladoBadge />{" "}
          {isSimulado
            ? "No se pudo cargar el catálogo real de ms-subscription — toda la tabla es de ejemplo."
            : "Nombre y precio mensual vienen de ms-subscription (GET /plans). Precio anual, límite de usuarios y \"Activo\" no existen en ese catálogo todavía — ver docs/superadmin/config-endpoints.md."}
        </div>
      )}
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
              <TableRow key={p.id ?? p.nombre}>
                <TableCell className="text-xs font-semibold">{p.nombre}</TableCell>
                <TableCell className="text-xs">{money(p.precioMensual)}</TableCell>
                <TableCell className="text-xs">{money(p.precioAnual)}</TableCell>
                <TableCell className="text-xs">{p.limiteUsuarios >= 999 ? "Ilimitado" : p.limiteUsuarios}</TableCell>
                <TableCell>
                  <Switch checked={p.activo} onCheckedChange={() => handleToggle(p)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
