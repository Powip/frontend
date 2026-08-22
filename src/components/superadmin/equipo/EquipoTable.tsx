"use client";

import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getEquipo } from "@/services/superadmin/equipoService";
import { ROL_LABEL } from "@/interfaces/superadmin";
import { ROL_MODULOS } from "@/mocks/superadmin";
import { RowActionsMenu, StatusBadge, TableSkeleton, EmptyBlock } from "@/components/superadmin/shared";

export function EquipoTable() {
  const { data, isLoading } = useQuery({ queryKey: ["superadmin", "equipo", "list"], queryFn: getEquipo });

  if (isLoading) return <TableSkeleton rows={8} cols={5} />;
  if (!data?.length) {
    return <EmptyBlock icon={Users} title="Sin miembros" description="Todavía no hay miembros en el equipo." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Miembro</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>Acceso a</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((m) => {
            const modulos = ROL_MODULOS[m.rol];
            const tieneTodo = modulos.includes("*");
            return (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="text-xs font-semibold">{m.nombre}</div>
                  <div className="text-[10.5px] text-muted-foreground">{m.email}</div>
                </TableCell>
                <TableCell>
                  <StatusBadge label={ROL_LABEL[m.rol]} tone="violet" />
                </TableCell>
                <TableCell className="max-w-sm">
                  {tieneTodo ? (
                    <StatusBadge label="Todo" tone="green" />
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {modulos.map((mod) => (
                        <span key={mod} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                          {mod}
                        </span>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <StatusBadge label={m.estado} tone={m.estado === "activo" ? "green" : "blue"} />
                </TableCell>
                <TableCell>
                  <RowActionsMenu
                    actions={[
                      {
                        label: "Ver como este rol",
                        icon: Eye,
                        onClick: () => toast.info(`El selector "Ver como rol" está disponible en la barra superior.`),
                      },
                    ]}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
