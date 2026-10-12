"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WaCard, WaCardHeader } from "@/components/whatsapp/ui/WaCard";
import { waButton, waFilterChip } from "@/components/whatsapp/ui/wa-classes";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import { WHATSAPP_TEMPLATE_STATUS_FILTERS } from "@/features/whatsapp/constants/whatsapp-template-catalog";
import type { WhatsAppTemplateStatus } from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import { TemplateApprovedBanner } from "./TemplateApprovedBanner";
import { TemplatesTable } from "./TemplatesTable";

export interface TemplateApprovedNotice {
  templateName: string;
  canActivateRule: boolean;
  onActivateRule: () => void;
  onDismiss: () => void;
}

interface TemplatesListViewProps {
  state: ResourceState<WhatsAppTemplate[]>;
  canManage: boolean;
  onCreate: () => void;
  onEdit: (template: WhatsAppTemplate) => void;
  onDuplicate: (template: WhatsAppTemplate) => void;
  onRetry?: () => void;
  approvedNotice?: TemplateApprovedNotice | null;
}

type StatusFilter = WhatsAppTemplateStatus | "all";

function StatusFilters({
  value,
  disabled,
  onChange,
}: {
  value: StatusFilter;
  disabled: boolean;
  onChange: (value: StatusFilter) => void;
}) {
  return (
    <fieldset className="m-0 mb-3.5 flex min-w-0 flex-wrap items-center gap-2.5 border-0 p-0">
      <legend className="sr-only">Filtrar por estado en Meta</legend>
      {WHATSAPP_TEMPLATE_STATUS_FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === filter.value}
          className={waFilterChip}
          onClick={() => onChange(filter.value)}
        >
          {filter.label}
        </button>
      ))}
    </fieldset>
  );
}

export function TemplatesListView({
  state,
  canManage,
  onCreate,
  onEdit,
  onDuplicate,
  onRetry,
  approvedNotice,
}: TemplatesListViewProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  return (
    <WaCard aria-labelledby="templates-title">
      <WaCardHeader
        titleId="templates-title"
        title="Tus plantillas"
        description="Meta revisa cada plantilla antes de que puedas usarla. Normalmente tarda de unos minutos a 24 horas."
        actions={
          canManage && (
            <Button type="button" className={waButton({ variant: "primary" })} onClick={onCreate}>
              <Plus aria-hidden="true" />
              Nueva plantilla
            </Button>
          )
        }
      />

      {approvedNotice && (
        <div className="mb-3.5">
          <TemplateApprovedBanner {...approvedNotice} />
        </div>
      )}

      {state.kind !== "ready" && <StatusFilters value="all" disabled onChange={() => undefined} />}

      <WhatsAppResourceState
        state={state}
        pendingTitle="Listado de plantillas pendiente de integración"
        pendingDescription="Las plantillas, su estado en Meta y sus métricas se mostrarán cuando el servicio de plantillas esté disponible. Puedes abrir «Nueva plantilla» para preparar y revisar un mensaje; todavía no se guarda."
        loadingLabel="Cargando plantillas"
        errorTitle="No se pudieron cargar las plantillas"
        onRetry={onRetry}
        isEmpty={(templates) => templates.length === 0}
        empty={
          <div className="rounded-xl border border-dashed border-wa-border-strong p-[30px] text-center">
            <p className="m-0 font-semibold">Todavía no tienes plantillas</p>
            <p className="m-0 text-[13px] text-wa-muted">
              Crea la primera para empezar a avisar a tus clientes.
            </p>
          </div>
        }
      >
        {(templates) => {
          const visible =
            statusFilter === "all"
              ? templates
              : templates.filter((template) => template.status === statusFilter);
          return (
            <>
              <StatusFilters value={statusFilter} disabled={false} onChange={setStatusFilter} />
              {visible.length === 0 ? (
                <p className="m-0 rounded-xl border border-wa-border p-[30px] text-center text-[13px] text-wa-muted">
                  No hay plantillas con este estado.
                </p>
              ) : (
                <TemplatesTable
                  templates={visible}
                  canManage={canManage}
                  onEdit={onEdit}
                  onDuplicate={onDuplicate}
                />
              )}
            </>
          );
        }}
      </WhatsAppResourceState>
    </WaCard>
  );
}
