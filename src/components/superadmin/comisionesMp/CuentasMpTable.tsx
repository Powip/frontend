"use client";

import { toast } from "sonner";
import { Wallet2, Unplug, ExternalLink } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCuentasMp, useDesconectarCuentaMp } from "@/hooks/superadmin/useComisionesMp";
import { StatusBadge, TableSkeleton, EmptyBlock, SimuladoBadge, RowActionsMenu } from "@/components/superadmin/shared";
import { formatDate } from "@/components/superadmin/shared/format";

export function CuentasMpTable() {
  const { data, isLoading, isSimulado } = useCuentasMp();
  const { mutate: desconectar } = useDesconectarCuentaMp();

  function handleDesconectar(empresaId: string, empresaNombre: string) {
    desconectar(empresaId, {
      onSuccess: () => toast.success(`Cuenta MP de ${empresaNombre} desconectada — pasa a modo powip_temporal.`),
    });
  }

  if (isLoading) return <TableSkeleton rows={6} cols={5} />;
  if (!data.data.length) {
    return <EmptyBlock icon={Wallet2} title="Sin cuentas MP" description="Ningún negocio tiene Mercado Pago conectado todavía." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Negocio</TableHead>
            <TableHead>Cuenta MP</TableHead>
            <TableHead>Modo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Conectada</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.data.map((c) => (
            <TableRow key={c.empresaId}>
              <TableCell className="text-xs font-semibold">
                {c.empresaNombre}
                {isSimulado && <SimuladoBadge />}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{c.mpEmail ?? "—"}</TableCell>
              <TableCell>
                <StatusBadge label={c.modo === "propia" ? "Cuenta propia" : "powip_temporal"} tone={c.modo === "propia" ? "green" : "amber"} />
              </TableCell>
              <TableCell>
                <StatusBadge label={c.activa ? "Activa" : "Inactiva"} tone={c.activa ? "blue" : "gray"} dot />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{c.conectadaEn ? formatDate(c.conectadaEn) : "—"}</TableCell>
              <TableCell>
                <RowActionsMenu
                  actions={[
                    { label: "Ver en Mercado Pago", icon: ExternalLink, onClick: () => toast.info("Abriría el dashboard de Mercado Pago del negocio.") },
                    {
                      label: "Desconectar (gestión manual)",
                      icon: Unplug,
                      danger: true,
                      separatorBefore: true,
                      onClick: () => handleDesconectar(c.empresaId, c.empresaNombre),
                    },
                  ]}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
