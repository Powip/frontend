"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import { WHATSAPP_TEMPLATE_STATUS_FILTERS } from "@/features/whatsapp/constants/whatsapp-template-catalog";
import type { WhatsAppTemplateStatus } from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import { cn } from "@/lib/utils";
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold">Tus plantillas</h3>
          <p className="text-sm text-muted-foreground">
            Meta revisa cada plantilla antes de que puedas usarla. Normalmente tarda de unos minutos
            a 24 horas.
          </p>
        </div>
        {canManage && (
          <Button type="button" className="shrink-0" onClick={onCreate}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nueva plantilla
          </Button>
        )}
      </div>

      {approvedNotice && <TemplateApprovedBanner {...approvedNotice} />}

      <WhatsAppResourceState
        state={state}
        pendingTitle="Listado de plantillas pendiente de integración"
        pendingDescription="Las plantillas, su estado en Meta y sus métricas se mostrarán cuando el servicio de plantillas esté disponible. Puedes abrir «Nueva plantilla» para preparar y revisar un mensaje; todavía no se guarda."
        loadingLabel="Cargando plantillas"
        errorTitle="No se pudieron cargar las plantillas"
        onRetry={onRetry}
        isEmpty={(templates) => templates.length === 0}
        empty={
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="font-medium">Todavía no tienes plantillas</p>
            <p className="text-sm text-muted-foreground">
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
            <div className="space-y-3">
              <fieldset className="flex min-w-0 flex-wrap gap-2">
                <legend className="sr-only">Filtrar por estado en Meta</legend>
                {WHATSAPP_TEMPLATE_STATUS_FILTERS.map((filter) => (
                  <Button
                    key={filter.value}
                    type="button"
                    size="sm"
                    variant="outline"
                    aria-pressed={statusFilter === filter.value}
                    className={cn(
                      statusFilter === filter.value && "border-foreground bg-muted font-semibold",
                    )}
                    onClick={() => setStatusFilter(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </fieldset>
              {visible.length === 0 ? (
                <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
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
            </div>
          );
        }}
      </WhatsAppResourceState>
    </div>
  );
}
