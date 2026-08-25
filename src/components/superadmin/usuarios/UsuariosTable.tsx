"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Eye, KeyRound, UserX, ShieldCheck } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { useUsuariosList, useDeleteUsuarioEmpresa } from "@/hooks/superadmin/useUsuarios";
import { IUsuarioEmpresa } from "@/interfaces/superadmin";
import { RowActionsMenu, StatusBadge, TableSkeleton, EmptyBlock } from "@/components/superadmin/shared";
import { formatDate } from "@/components/superadmin/shared/format";
import { UsuarioDetailDrawer } from "./UsuarioDetailDrawer";
import { Users } from "lucide-react";

export function UsuariosTable({ q, rol }: { q: string; rol: string }) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<IUsuarioEmpresa | null>(null);

  const { data, meta, isLoading } = useUsuariosList({ q, rol, page, pageSize: 10 });

  // Editar rol es una mutación real (useUpdateUsuarioRol, ver useUsuarios.ts)
  // pero todavía no hay una UI de edición diseñada para esta tabla — ver
  // docs/superadmin/usuarios-endpoints.md.
  const { mutate: desactivar, isPending: desactivando } = useDeleteUsuarioEmpresa();

  function handleDesactivar(u: IUsuarioEmpresa) {
    // "Desactivar" hoy es un borrado real (no hay baja lógica en el backend,
    // ver doc) — se pide confirmación explícita antes de llamar al endpoint real.
    if (!window.confirm(`¿Eliminar a ${u.nombre}? Esta acción no se puede deshacer (no existe una baja lógica todavía).`)) return;
    desactivar(u.id, {
      onSuccess: () => toast.success(`${u.nombre} fue eliminado.`),
      onError: () => toast.error(`No se pudo eliminar a ${u.nombre}.`),
    });
  }

  if (isLoading) return <TableSkeleton rows={8} cols={5} />;
  if (!data.length) {
    return <EmptyBlock icon={Users} title="Sin resultados para estos filtros" description="Prueba limpiando la búsqueda o el filtro de rol." />;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuario</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Registro</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((u) => (
              <TableRow key={u.id} className="cursor-pointer" onClick={() => setSelected(u)}>
                <TableCell>
                  <div className="text-xs font-semibold">{u.nombre}</div>
                  <div className="text-[10.5px] text-muted-foreground">{u.email}</div>
                </TableCell>
                <TableCell className="text-xs">{u.empresaNombre}</TableCell>
                <TableCell>
                  <StatusBadge label={u.rol} tone="violet" />
                </TableCell>
                <TableCell className="text-xs">{formatDate(u.registro)}</TableCell>
                <TableCell>
                  <StatusBadge label={u.estado} tone={u.estado === "activo" ? "green" : u.estado === "invitado" ? "blue" : "gray"} />
                </TableCell>
                <TableCell>
                  <RowActionsMenu
                    actions={[
                      { label: "Ver perfil", icon: Eye, onClick: () => setSelected(u) },
                      {
                        label: "Editar rol",
                        icon: ShieldCheck,
                        onClick: () =>
                          toast.info("Cambiar rol es un endpoint real (updateUser), pero todavía no tiene una UI de edición en esta tabla."),
                      },
                      {
                        label: "Resetear contraseña",
                        icon: KeyRound,
                        onClick: () => toast.error("No existe un endpoint de reseteo por link todavía — ver docs/superadmin/usuarios-endpoints.md."),
                      },
                      {
                        label: "Desactivar",
                        icon: UserX,
                        danger: true,
                        separatorBefore: true,
                        onClick: () => !desactivando && handleDesactivar(u),
                      },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination
        currentPage={meta.page}
        totalPages={meta.totalPages}
        totalItems={meta.total}
        itemsPerPage={meta.pageSize}
        onPageChange={setPage}
        itemName="usuarios"
      />
      <UsuarioDetailDrawer usuario={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
