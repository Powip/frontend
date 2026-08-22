"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, KeyRound, UserX, ShieldCheck } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { getUsuariosEmpresa } from "@/services/superadmin/empresasService";
import { IUsuarioEmpresa } from "@/interfaces/superadmin";
import { RowActionsMenu, StatusBadge, TableSkeleton, EmptyBlock } from "@/components/superadmin/shared";
import { formatDate } from "@/components/superadmin/shared/format";
import { UsuarioDetailDrawer } from "./UsuarioDetailDrawer";
import { Users } from "lucide-react";

export function UsuariosTable({ q, rol }: { q: string; rol: string }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<IUsuarioEmpresa | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "usuarios", "list", { q, rol, page }],
    queryFn: () => getUsuariosEmpresa({ q, rol, page, pageSize: 10 }),
  });

  const { mutate: desactivar } = useMutation({
    mutationFn: async (nombre: string) => nombre,
    onSuccess: (nombre) => {
      queryClient.invalidateQueries({ queryKey: ["superadmin", "usuarios"] });
      toast.success(`${nombre} fue desactivado.`);
    },
  });

  if (isLoading) return <TableSkeleton rows={8} cols={5} />;
  if (!data?.data.length) {
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
            {data.data.map((u) => (
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
                      { label: "Editar rol", icon: ShieldCheck, onClick: () => toast.info("Editar rol (mock).") },
                      {
                        label: "Resetear contraseña",
                        icon: KeyRound,
                        onClick: () => toast.success(`Enlace de reseteo enviado a ${u.email}.`),
                      },
                      { label: "Desactivar", icon: UserX, danger: true, separatorBefore: true, onClick: () => desactivar(u.nombre) },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination
        currentPage={data.meta.page}
        totalPages={data.meta.totalPages}
        totalItems={data.meta.total}
        itemsPerPage={data.meta.pageSize}
        onPageChange={setPage}
        itemName="usuarios"
      />
      <UsuarioDetailDrawer usuario={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
