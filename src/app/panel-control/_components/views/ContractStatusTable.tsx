"use client";

import { DataOriginBadge } from "@/components/panel-control/DataOriginBadge";
import { DataTable, type DataTableColumn } from "@/components/panel-control/DataTable";
import { PANEL_ROLE_POLICIES } from "@/features/panel-control/shared/config/panel-roles.config";
import { PANEL_CONTRACTS } from "@/features/panel-control/shared/data/panel-contracts";
import { resolvePanelSource } from "@/features/panel-control/shared/data/panel-source";
import type { DataOrigin } from "@/features/panel-control/shared/models/data-origin.model";
import type {
  ContractIntegrationStatus,
  PanelContractDescriptor,
  PanelContractId,
} from "@/features/panel-control/shared/models/panel-contract.model";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { cn } from "@/lib/utils";

const ESTADO_BACKEND: Record<ContractIntegrationStatus, { label: string; clase: string }> = {
  conectado: { label: "Existe", clase: "bg-pc-ok-soft text-pc-ok" },
  parcial: { label: "Parcial", clase: "bg-pc-warn-soft text-pc-warn" },
  pendiente: { label: "Por crear", clase: "bg-pc-border-soft text-pc-text-muted" },
};

interface Fila {
  descriptor: PanelContractDescriptor;
  origin: DataOrigin;
}

interface ContractStatusTableProps {
  contratos: PanelContractId[];
  caption: string;
  detallado?: boolean;
}

export function ContractStatusTable({
  contratos,
  caption,
  detallado = false,
}: ContractStatusTableProps) {
  const { sources, state } = usePanel();
  const filas: Fila[] = contratos.map((id) => ({
    descriptor: PANEL_CONTRACTS[id],
    origin: resolvePanelSource(sources, id, state.dataMode).origin,
  }));

  const columns: DataTableColumn<Fila>[] = [
    {
      id: "contrato",
      header: "Contrato",
      align: "left",
      cell: ({ descriptor }) => (
        <span className="font-semibold">
          {descriptor.titulo}
          <span className="block text-[10.5px] font-normal text-pc-text-soft">
            {descriptor.respuesta}
          </span>
        </span>
      ),
      sortValue: ({ descriptor }) => descriptor.titulo,
    },
    {
      id: "endpoint",
      header: "Endpoint",
      align: "left",
      cell: ({ descriptor }) => (
        <code className="whitespace-normal break-all rounded bg-pc-surface-muted px-1 text-[11px]">
          {descriptor.metodo} {descriptor.endpoint}
        </code>
      ),
      sortValue: ({ descriptor }) => descriptor.endpoint,
    },
    {
      id: "fuente",
      header: "Fuente en esta rama",
      align: "left",
      cell: ({ origin }) => <DataOriginBadge origin={origin} mostrarReal />,
      sortValue: ({ origin }) => origin.kind,
    },
    {
      id: "backend",
      header: "Backend",
      align: "left",
      cell: ({ descriptor }) => (
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold",
            ESTADO_BACKEND[descriptor.estado].clase,
          )}
        >
          {ESTADO_BACKEND[descriptor.estado].label}
        </span>
      ),
      sortValue: ({ descriptor }) => descriptor.estado,
    },
    {
      id: "pendientes",
      header: "Pendientes",
      align: "left",
      cell: ({ descriptor }) => (
        <details className="max-w-[420px] whitespace-normal">
          <summary className="cursor-pointer text-xs font-semibold text-pc-primary">
            {descriptor.pendientes.length} puntos
          </summary>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-[11.5px] text-pc-text-muted">
            {descriptor.pendientes.map((pendiente) => (
              <li key={pendiente}>{pendiente}</li>
            ))}
          </ul>
        </details>
      ),
      sortValue: ({ descriptor }) => descriptor.pendientes.length,
    },
  ];

  if (detallado) {
    columns.splice(4, 0, {
      id: "roles",
      header: "Roles y campos restringidos",
      align: "left",
      cell: ({ descriptor }) => (
        <span className="block max-w-[260px] whitespace-normal text-[11.5px]">
          {descriptor.roles.map((role) => PANEL_ROLE_POLICIES[role].etiqueta).join(", ")}
          {descriptor.camposRestringidos.length > 0 && (
            <span className="block text-pc-text-soft">
              Restringido: {descriptor.camposRestringidos.join("; ")}
            </span>
          )}
        </span>
      ),
    });
  }

  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={filas}
      getRowKey={({ descriptor }) => descriptor.id}
    />
  );
}
