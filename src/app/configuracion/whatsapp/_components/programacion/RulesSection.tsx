"use client";

import { useState } from "react";
import { PendingIntegrationNotice } from "@/components/whatsapp/PendingIntegrationNotice";
import { WaCard, WaCardHeader } from "@/components/whatsapp/ui/WaCard";
import { WaPill } from "@/components/whatsapp/ui/WaPill";
import { WhatsAppResourceState } from "@/components/whatsapp/WhatsAppResourceState";
import { WHATSAPP_RULE_DEFINITIONS } from "@/features/whatsapp/constants/whatsapp-scheduling-catalog";
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
import { RULE_ICONS } from "./rule-icons";

const RULES_PERSISTENCE_NOTE_ID = "rules-persistence-note";

const RULES_GRID = "grid grid-cols-1 gap-4 min-[1050px]:grid-cols-2";

function PendingRulesGrid() {
  return (
    <ul className={`${RULES_GRID} m-0 list-none p-0`} aria-label="Avisos que se configuran aquí">
      {WHATSAPP_RULE_DEFINITIONS.map((definition) => {
        const Icon = RULE_ICONS[definition.key];
        return (
          <li
            key={definition.key}
            className="flex min-w-0 items-center gap-3 rounded-[14px] border border-dashed border-wa-border-strong bg-wa-surface px-[18px] py-4"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-wa-surface-2 text-wa-muted">
              <Icon className="size-[18px]" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">{definition.label}</span>
              <span className="block text-xs text-wa-muted">Configuración pendiente</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

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
    <WaCard aria-labelledby="rules-section-title" className="flex flex-col gap-4">
      <WaCardHeader
        className="mb-0"
        titleId="rules-section-title"
        title="Avisos automáticos por estado del envío"
        description="Elige qué plantilla sale en cada etapa y cuándo. Los avisos respetan el horario permitido de abajo."
        actions={
          summary && (
            <>
              {summary.estimatedMonthly?.pen && (
                <WaPill className="wa-num">
                  ≈ S/ {summary.estimatedMonthly.pen} al mes · lo cobra Meta
                </WaPill>
              )}
              <WaPill tone="purple">
                {summary.activeCount} {summary.activeCount === 1 ? "activo" : "activos"}
              </WaPill>
            </>
          )
        }
      />

      <RuleLinkNotice link={link} rules={rules} templates={templates} onDismiss={onDismissLink} />

      {!canPersist && rules.kind === "ready" && (
        <p id={RULES_PERSISTENCE_NOTE_ID} className="m-0 text-xs text-wa-muted">
          Guardar, activar y desactivar avisos estarán disponibles cuando se conecte el servicio de
          avisos automáticos. Puedes revisar y ajustar la configuración, pero no se guarda.
        </p>
      )}

      {rules.kind === "pending-integration" && (
        <>
          <PendingIntegrationNotice
            title="Avisos automáticos pendientes de integración"
            description="Las reglas de cada tienda, su estado y su costo estimado se mostrarán cuando el servicio de avisos esté disponible. Esto no significa que no haya avisos configurados."
          />
          <PendingRulesGrid />
        </>
      )}

      {rules.kind !== "pending-integration" && (
        <WhatsAppResourceState
          state={rules}
          pendingTitle=""
          loadingLabel="Cargando avisos automáticos"
          errorTitle="No se pudieron cargar los avisos automáticos"
          onRetry={onRetry}
          isEmpty={(data) => data.rules.length === 0}
          empty={
            <p className="m-0 rounded-xl border border-dashed border-wa-border-strong p-[30px] text-center text-[13px] text-wa-muted">
              Esta tienda todavía no tiene avisos automáticos configurados.
            </p>
          }
        >
          {(data) => (
            <div className={RULES_GRID}>
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
      )}

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
    </WaCard>
  );
}
