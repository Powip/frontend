"use client";

import type {
  WhatsAppCampaign,
  WhatsAppSegmentCount,
} from "@/features/whatsapp/models/campaign.model";
import type {
  WhatsAppSkippedNotice,
  WhatsAppUpcomingQueue,
} from "@/features/whatsapp/models/queue.model";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type {
  WhatsAppActivateRule,
  WhatsAppDeactivateRule,
  WhatsAppRule,
  WhatsAppRulePreview,
  WhatsAppRulesData,
  WhatsAppSaveRule,
} from "@/features/whatsapp/models/rule.model";
import type { WhatsAppScopeCatalogs } from "@/features/whatsapp/models/scope-catalog.model";
import type {
  WhatsAppSaveSettings,
  WhatsAppSendingSettings,
} from "@/features/whatsapp/models/sending-settings.model";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import type { CampaignValues } from "@/features/whatsapp/schemas/campaign.schema";
import type { RuleLinkResolution } from "@/features/whatsapp/utils/rule-link.util";
import { CampaignsSection } from "./CampaignsSection";
import { MissingDataSection } from "./MissingDataSection";
import { RulesSection } from "./RulesSection";
import { SendingHoursSection } from "./SendingHoursSection";
import { UpcomingQueueSection } from "./UpcomingQueueSection";

export interface SchedulingPersistence {
  rules: boolean;
  settings: boolean;
  campaigns: boolean;
}

export interface SchedulingViewProps {
  rules: ResourceState<WhatsAppRulesData>;
  templates: ResourceState<WhatsAppTemplate[]>;
  settings: ResourceState<WhatsAppSendingSettings>;
  skipped: ResourceState<WhatsAppSkippedNotice[]>;
  queue: ResourceState<WhatsAppUpcomingQueue>;
  campaigns: ResourceState<WhatsAppCampaign[]>;
  catalogs: WhatsAppScopeCatalogs;
  canManage: boolean;
  canPersist: SchedulingPersistence;
  businessName: string;
  link: RuleLinkResolution;
  onDismissLink: () => void;
  getRulePreview: (rule: WhatsAppRule) => ResourceState<WhatsAppRulePreview>;
  getSegmentCount: (values: CampaignValues) => ResourceState<WhatsAppSegmentCount>;
  onCorrectOrder?: (orderId: string) => void;
  /** C-18: guarda horario o datos faltantes. Sin él, guardar queda bloqueado. */
  onSaveSettings?: WhatsAppSaveSettings;
  now?: () => Date;
    /** C-16: guardar, activar y desactivar avisos, y reintentar la carga. */
  onSaveRule?: WhatsAppSaveRule;
  onActivateRule?: WhatsAppActivateRule;
  onDeactivateRule?: WhatsAppDeactivateRule;
  onRetryRules?: () => void;
}

export function SchedulingView({
  rules,
  templates,
  settings,
  skipped,
  queue,
  campaigns,
  catalogs,
  canManage,
  canPersist,
  businessName,
  link,
  onDismissLink,
  getRulePreview,
  getSegmentCount,
  onCorrectOrder,
  onSaveSettings,
  onSaveRule,
  onActivateRule,
  onDeactivateRule,
  onRetryRules,
  now,
}: SchedulingViewProps) {
  return (
    <div className="space-y-5">
      <RulesSection
        rules={rules}
        templates={templates}
        catalogs={catalogs}
        canManage={canManage}
        canPersist={canPersist.rules}
        businessName={businessName}
        link={link}
        onDismissLink={onDismissLink}
        getPreview={getRulePreview}
        onSaveRule={onSaveRule}
        onActivateRule={onActivateRule}
        onDeactivateRule={onDeactivateRule}
        onRetry={onRetryRules}
      />
      <MissingDataSection
        settings={settings}
        skipped={skipped}
        canManage={canManage}
        canPersist={canPersist.settings}
        onCorrectOrder={onCorrectOrder}
        onSave={onSaveSettings}
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <SendingHoursSection
          settings={settings}
          canManage={canManage}
          canPersist={canPersist.settings}
          onSave={onSaveSettings}
        />
        <UpcomingQueueSection queue={queue} now={now?.()} />
      </div>
      <CampaignsSection
        campaigns={campaigns}
        templates={templates}
        catalogs={catalogs}
        canManage={canManage}
        canPersist={canPersist.campaigns}
        getSegmentCount={getSegmentCount}
        now={now}
      />
    </div>
  );
}