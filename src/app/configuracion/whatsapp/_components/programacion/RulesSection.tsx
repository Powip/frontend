"use client";

import { useState } from "react";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type {
  WhatsAppRule,
  WhatsAppRulePreview,
  WhatsAppRulesData,
} from "@/features/whatsapp/models/rule.model";
import type { WhatsAppScopeCatalogs } from "@/features/whatsapp/models/scope-catalog.model";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import type { RuleLinkResolution } from "@/features/whatsapp/utils/rule-link.util";
import { ActivateRuleDialog } from "./ActivateRuleDialog";
import { DeactivateRuleDialog } from "./DeactivateRuleDialog";
import { type RuleActivationRequest, RuleCard } from "./RuleCard";
import { RuleLinkNotice } from "./RuleLinkNotice";
import { RuleMessagePreviewDialog } from "./RuleMessagePreviewDialog";

const RULES_PERSISTENCE_NOTE_ID = "rules-persistence-note";

interface RulesSectionProps {
  rules: ResourceState<WhatsAppRulesData>;
  templates: ResourceState<WhatsAppTemplate[]>;
  catalogs: WhatsAppScopeCatalogs;
  canManage: boolean;
  canPersist: boolean;
  businessName: string;
  link: RuleLinkResolution;
  onDismissLink: () => void;
  getPreview: (rule: WhatsAppRule) => ResourceState<WhatsAppRulePreview>;
  onRetry?: () => void;
}

export function RulesSection({
  rules,
  templates,
  catalogs,
  canManage,
  canPersist,
  businessName,
  link,
  onDismissLink,
  getPreview,
  onRetry,
}: RulesSectionProps) {
  const [activation, setActivation] = useState<{
    key: number;
    request: RuleActivationRequest;
  } | null>(null);
  const [deactivation, setDeactivation] = useState<WhatsAppRule | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<WhatsAppTemplate | null>(null);
  const linkedRuleKey = link.kind === "rule" ? link.ruleKey : null;
  const linkedTemplateId = link.kind === "rule" ? link.templateId : null;

  const summary = rules.kind === "ready" ? rules.data.summary : null;

  return (
    <section
      aria-labelledby="rules-section-title"
      className="space-y-4 rounded-xl border bg-card p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 id="rules-section-title" className="font-semibold">
            Avisos automáticos por estado del envío
          </h3>
          <p className="text-sm text-muted-foreground">
            Elige qué plantilla sale en cada etapa y cuándo. Los avisos respetan el horario
            permitido.
          </p>
        </div>
        {summary && (
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {summary.estimatedMonthly?.pen && (
              <span className="rounded-full border px-2.5 py-1">
                ≈ S/ {summary.estimatedMonthly.pen} al mes · lo cobra Meta
              </span>
            )}
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200">
              {summary.activeCount} {summary.activeCount === 1 ? "activo" : "activos"}
            </span>
          </div>
        )}
      </div>

      <RuleLinkNotice link={link} rules={rules} templates={templates} onDismiss={onDismissLink} />

      {!canPersist && rules.kind === "ready" && (
        <p id={RULES_PERSISTENCE_NOTE_ID} className="text-sm text-muted-foreground">
          Guardar, activar y desactivar avisos estarán disponibles cuando se conecte el servicio de
          avisos automáticos. Puedes revisar y ajustar la configuración, pero no se guarda.
        </p>
      )}

      <WhatsAppResourceState
        state={rules}
        pendingTitle="Avisos automáticos pendientes de integración"
        pendingDescription="Las reglas de cada tienda, su estado y su costo estimado se mostrarán cuando el servicio de avisos esté disponible. Esto no significa que no haya avisos configurados."
        pendingItems={[
          "Guía creada",
          "Pedido en camino",
          "Disponible en agencia",
          "En reparto hoy",
          "Pedido entregado",
          "Incidencia en el envío",
          "Comprobante emitido",
          "Encuesta post-entrega",
          "Saldo pendiente",
        ]}
        loadingLabel="Cargando avisos automáticos"
        errorTitle="No se pudieron cargar los avisos automáticos"
        onRetry={onRetry}
        isEmpty={(data) => data.rules.length === 0}
        empty={
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Esta tienda todavía no tiene avisos automáticos configurados.
          </p>
        }
      >
        {(data) => (
          <div className="grid gap-4 xl:grid-cols-2">
            {data.rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                templates={templates}
                catalogs={catalogs}
                canManage={canManage}
                canPersist={canPersist}
                persistenceNoteId={RULES_PERSISTENCE_NOTE_ID}
                highlighted={rule.key === linkedRuleKey}
                preselectTemplateId={rule.key === linkedRuleKey ? linkedTemplateId : null}
                onRequestActivation={(request) =>
                  setActivation((current) => ({ key: (current?.key ?? 0) + 1, request }))
                }
                onRequestDeactivation={setDeactivation}
                onPreviewTemplate={setPreviewTemplate}
              />
            ))}
          </div>
        )}
      </WhatsAppResourceState>

      <ActivateRuleDialog
        key={activation?.key ?? 0}
        request={activation?.request ?? null}
        preview={activation ? getPreview(activation.request.rule) : { kind: "pending-integration" }}
        canPersist={canPersist}
        onClose={() => setActivation(null)}
      />
      <DeactivateRuleDialog
        rule={deactivation}
        canPersist={canPersist}
        onClose={() => setDeactivation(null)}
      />
      <RuleMessagePreviewDialog
        template={previewTemplate}
        businessName={businessName}
        onClose={() => setPreviewTemplate(null)}
      />
    </section>
  );
}
