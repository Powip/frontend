"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, LogIn, Trash2, Building2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { useEmpresasList, EmpresasFilters } from "@/hooks/superadmin/useEmpresas";
import { RowActionsMenu, TableSkeleton, EmptyBlock, ErrorBanner } from "@/components/superadmin/shared";

export function EmpresasTable({ q }: { q: string }) {
  const router = useRouter();
  const [page, setPage] = useState(1);

  const filters: EmpresasFilters = { q, page, pageSize: 10 };
  const { data, meta, isLoading, isError } = useEmpresasList(filters);

  if (isLoading) return <TableSkeleton rows={8} cols={4} />;
  if (isError) return <ErrorBanner message="No se pudo cargar el directorio de empresas (ms-company)." />;
  if (!data.length) {
    return <EmptyBlock icon={Building2} title="Sin resultados para esta búsqueda" description="Prueba con otro nombre o RUC." />;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>RUC</TableHead>
              <TableHead>Canales de venta</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((e) => (
              <TableRow key={e.id} className="cursor-pointer" onClick={() => router.push(`/superadmin/empresas/${e.id}`)}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-md text-[10px] font-bold text-white shrink-0 ${e.colorAvatar}`}>
                      {e.logoIniciales}
                    </span>
                    <div className="font-semibold text-xs truncate">{e.nombre}</div>
                  </div>
                </TableCell>
                <TableCell className="text-xs">{e.ruc ?? "—"}</TableCell>
                <TableCell className="text-xs">{e.canalesVenta.length ? e.canalesVenta.join(", ") : "—"}</TableCell>
                <TableCell>
                  <RowActionsMenu
                    actions={[
                      { label: "Ver perfil 360", icon: Eye, onClick: () => router.push(`/superadmin/empresas/${e.id}`) },
                      {
                        label: "Entrar como admin",
                        icon: LogIn,
                        onClick: () => toast.info("Impersonación todavía no existe en backend — ver docs/superadmin/empresas-endpoints.md."),
                      },
                      {
                        label: "Eliminar",
                        icon: Trash2,
                        danger: true,
                        separatorBefore: true,
                        onClick: () => toast.error(`Eliminar ${e.nombre} requiere confirmación (pendiente de implementar).`),
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
        itemName="empresas"
      />
    </div>
  );
}
