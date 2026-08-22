"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Link2, CheckCircle2, Ban, Globe, Users2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { EstadoPartner, NivelPartner } from "@/interfaces/superadmin";
import { getPartners, aprobarPartner, suspenderPartner } from "@/services/superadmin/partnersService";
import { RowActionsMenu, StatusBadge, TableSkeleton, EmptyBlock } from "@/components/superadmin/shared";
import { moneyCompact, formatDate } from "@/components/superadmin/shared/format";

const ESTADO_PARTNER_TONE: Record<EstadoPartner, "green" | "amber" | "red"> = {
  activo: "green",
  pendiente: "amber",
  suspendido: "red",
};

const NIVEL_TONE: Record<NivelPartner, "amber" | "gray" | "blue"> = {
  Oro: "amber",
  Plata: "gray",
  Base: "blue",
};

interface Props {
  q: string;
  estado: EstadoPartner | "todos";
  nivel: NivelPartner | "todos";
  onOpenPartner: (id: string) => void;
}

export function PartnersTable({ q, estado, nivel, onOpenPartner }: Props) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["superadmin", "partners", "list", { q, estado, nivel, page }],
    queryFn: () => getPartners({ q, estado, nivel, page, pageSize: 10 }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["superadmin", "partners"] });

  const { mutate: aprobar } = useMutation({
    mutationFn: aprobarPartner,
    onSuccess: (partner) => {
      invalidate();
      if (partner) toast.success(`${partner.nombre} fue aprobado y ahora está activo.`);
    },
  });

  const { mutate: suspender } = useMutation({
    mutationFn: suspenderPartner,
    onSuccess: (partner) => {
      invalidate();
      if (partner) toast.success(`${partner.nombre} ahora está "${partner.estado}".`);
    },
  });

  function copiarLink(slugLink: string) {
    navigator.clipboard?.writeText(`https://${slugLink}`).catch(() => {});
    toast.success("Link de referido copiado al portapapeles.");
  }

  if (isLoading) return <TableSkeleton rows={8} cols={6} />;
  if (!data?.data.length) {
    return <EmptyBlock icon={Users2} title="Sin partners para estos filtros" description="Prueba limpiando la búsqueda o el filtro de estado/nivel." />;
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Partner</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Nivel</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Opción</TableHead>
              <TableHead>MRR activo</TableHead>
              <TableHead>Referidos</TableHead>
              <TableHead>Desde</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.data.map((p) => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => onOpenPartner(p.id)}>
                <TableCell>
                  <div className="min-w-0">
                    <div className="font-semibold text-xs truncate">{p.nombre}</div>
                    <div className="text-[10.5px] text-muted-foreground truncate">{p.handle}</div>
                  </div>
                </TableCell>
                <TableCell className="text-xs">{p.tipo}</TableCell>
                <TableCell>
                  <StatusBadge label={p.nivel} tone={NIVEL_TONE[p.nivel]} />
                </TableCell>
                <TableCell>
                  <StatusBadge label={p.estado} tone={ESTADO_PARTNER_TONE[p.estado]} />
                </TableCell>
                <TableCell className="text-xs font-semibold">{p.opcionComision}</TableCell>
                <TableCell className="text-xs font-bold">{moneyCompact(p.mrrActivo)}</TableCell>
                <TableCell className="text-xs">{p.referidosCount}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatDate(p.creadoEn)}</TableCell>
                <TableCell>
                  <RowActionsMenu
                    actions={[
                      { label: "Ver ficha", icon: Eye, onClick: () => onOpenPartner(p.id) },
                      { label: "Copiar link", icon: Link2, onClick: () => copiarLink(p.slugLink) },
                      {
                        label: "Ver portal del partner",
                        icon: Globe,
                        onClick: () => window.open(`/superadmin/partners/${p.id}/portal`, "_blank"),
                      },
                      ...(p.estado === "pendiente"
                        ? [{ label: "Aprobar", icon: CheckCircle2, separatorBefore: true, onClick: () => aprobar(p.id) }]
                        : []),
                      {
                        label: p.estado === "suspendido" ? "Reactivar" : "Suspender",
                        icon: Ban,
                        separatorBefore: p.estado !== "pendiente",
                        danger: p.estado !== "suspendido",
                        onClick: () => suspender(p.id),
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
        currentPage={data.meta.page}
        totalPages={data.meta.totalPages}
        totalItems={data.meta.total}
        itemsPerPage={data.meta.pageSize}
        onPageChange={setPage}
        itemName="partners"
      />
    </div>
  );
}
