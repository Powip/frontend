"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, XCircle, UserPlus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EstadoReferido } from "@/interfaces/superadmin";
import { getColaReferidos, aprobarReferido, rechazarReferido } from "@/services/superadmin/partnersService";
import { FiltersBar, StatusBadge, TableSkeleton, EmptyBlock } from "@/components/superadmin/shared";
import { formatDate } from "@/components/superadmin/shared/format";

const ESTADOS: (EstadoReferido | "todos")[] = ["todos", "pendiente", "aprobado", "activo", "rechazado", "cancelado"];

const ESTADO_TONE: Record<EstadoReferido, "green" | "amber" | "red" | "blue" | "gray"> = {
  pendiente: "amber",
  aprobado: "blue",
  activo: "green",
  rechazado: "red",
  cancelado: "gray",
};

export function ColaReferidosTab() {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<EstadoReferido | "todos">("pendiente");

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "partners", "cola-referidos", estado],
    queryFn: () => getColaReferidos(estado),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["superadmin", "partners"] });

  const { mutate: aprobar } = useMutation({
    mutationFn: aprobarReferido,
    onSuccess: (r) => {
      invalidate();
      if (r) toast.success(`${r.negocio} fue aprobado.`);
    },
  });

  const { mutate: rechazar } = useMutation({
    mutationFn: rechazarReferido,
    onSuccess: (r) => {
      invalidate();
      if (r) toast.error(`${r.negocio} fue rechazado.`);
    },
  });

  return (
    <div>
      <FiltersBar>
        <Select value={estado} onValueChange={(v) => setEstado(v as EstadoReferido | "todos")}>
          <SelectTrigger className="h-9 w-[180px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ESTADOS.map((e) => (
              <SelectItem key={e} value={e} className="text-xs capitalize">
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FiltersBar>

      {isLoading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : !data?.length ? (
        <EmptyBlock icon={UserPlus} title="Sin referidos en la cola" description="No hay referidos para este filtro de estado." />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Negocio</TableHead>
                <TableHead>Partner</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead className="w-44" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs truncate">{r.negocio}</div>
                      <div className="text-[10.5px] text-muted-foreground truncate">{r.email}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{r.partnerNombre}</TableCell>
                  <TableCell className="text-xs">{r.plan}</TableCell>
                  <TableCell className="text-xs">{r.origen}</TableCell>
                  <TableCell>
                    <StatusBadge label={r.estado} tone={ESTADO_TONE[r.estado]} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(r.creadoEn)}</TableCell>
                  <TableCell>
                    {r.estado === "pendiente" && (
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px] text-emerald-600 border-emerald-500/30" onClick={() => aprobar(r.id)}>
                          <CheckCircle2 className="h-3 w-3" />
                          Aprobar
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px] text-destructive border-destructive/30" onClick={() => rechazar(r.id)}>
                          <XCircle className="h-3 w-3" />
                          Rechazar
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
