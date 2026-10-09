"use client";

import { Store } from "lucide-react";
import {
  WHATSAPP_PERMISSION_CODES,
  type WhatsAppTab,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type {
  WhatsAppAlertSettings,
  WhatsAppAuditFilters,
  WhatsAppAuditPage,
  WhatsAppEffectivePermissions,
  WhatsAppOptOutPage,
  WhatsAppPermissionSettings,
  WhatsAppProtectionSettings,
  WhatsAppRecentAlert,
} from "@/features/whatsapp/models/settings-tab.model";
import {
  combineBlockReasons,
  getPermissionBlockReason,
} from "@/features/whatsapp/utils/whatsapp-permissions.util";
import { AlertsSection } from "./AlertsSection";
import { AuditLogSection } from "./AuditLogSection";
import { ForeignNumbersSection } from "./ForeignNumbersSection";
import { OptOutsSection } from "./OptOutsSection";
import { PermissionsSection } from "./PermissionsSection";
import { SETTINGS_PENDING_REASON, type SettingsMutations } from "./settings-types";

export const UNDEFINED_PERMISSION_REASON =
  "El permiso para hacer este cambio todavía no está definido en POWIP.";

export interface SettingsViewProps {
  stores: { id: string; name: string }[];
  storeContext: { id: string; name: string } | null;
  now: Date;
  canManage: boolean;
  effectivePermissions: WhatsAppEffectivePermissions;
  protection: ResourceState<WhatsAppProtectionSettings | null>;
  optOuts: ResourceState<WhatsAppOptOutPage>;
  optOutSearch: string;
  onOptOutSearchChange: (search: string) => void;
  onOptOutsPageChange?: (page: number) => void;
  alertSettings: ResourceState<WhatsAppAlertSettings | null>;
  recentAlerts: ResourceState<WhatsAppRecentAlert[]>;
  audit: ResourceState<WhatsAppAuditPage>;
  auditFilters: WhatsAppAuditFilters;
  onAuditFiltersChange: (filters: WhatsAppAuditFilters) => void;
  onAuditPageChange?: (page: number) => void;
  permissionMatrix: ResourceState<WhatsAppPermissionSettings>;
  mutations: SettingsMutations;
  onOpenTab: (tab: WhatsAppTab) => void;
  onRetry?: () => void;
}

export function SettingsView({
  stores,
  storeContext,
  now,
  canManage,
  effectivePermissions,
  protection,
  optOuts,
  optOutSearch,
  onOptOutSearchChange,
  onOptOutsPageChange,
  alertSettings,
  recentAlerts,
  audit,
  auditFilters,
  onAuditFiltersChange,
  onAuditPageChange,
  permissionMatrix,
  mutations,
  onOpenTab,
  onRetry,
}: SettingsViewProps) {
  const pending = (handler: unknown) => (handler ? null : SETTINGS_PENDING_REASON);
  const optOutPermission = getPermissionBlockReason(
    effectivePermissions,
    WHATSAPP_PERMISSION_CODES.OPT_OUTS,
  );
  const storeKey = storeContext?.id ?? "sin-tienda";

  return (
    <div className="space-y-6">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Store className="h-4 w-4" aria-hidden="true" />
        {storeContext
          ? `Bajas automáticas, alertas y números extranjeros de la tienda ${storeContext.name}.`
          : "Elige una tienda en POWIP para ver su configuración."}
      </p>
      <OptOutsSection
        stores={stores}
        storeContext={storeContext}
        protection={protection}
        optOuts={optOuts}
        search={optOutSearch}
        onSearchChange={onOptOutSearchChange}
        onPageChange={onOptOutsPageChange}
        onRetry={onRetry}
        canEdit={canManage}
        protectionBlockedReason={combineBlockReasons(
          pending(mutations.saveProtection),
          optOutPermission,
        )}
        optOutsBlockedReason={combineBlockReasons(pending(mutations.addOptOut), optOutPermission)}
        reactivateBlockedReason={combineBlockReasons(
          pending(mutations.reactivateOptOut),
          optOutPermission,
        )}
        mutations={mutations}
      />
      <AlertsSection
        settings={alertSettings}
        recentAlerts={recentAlerts}
        storeKey={storeKey}
        now={now}
        canEdit={canManage}
        blockedReason={combineBlockReasons(
          pending(mutations.saveAlerts),
          UNDEFINED_PERMISSION_REASON,
        )}
        onSave={mutations.saveAlerts}
        onRetry={onRetry}
        onOpenTab={onOpenTab}
      />
      <ForeignNumbersSection
        protection={protection}
        storeKey={storeKey}
        canEdit={canManage}
        blockedReason={combineBlockReasons(
          pending(mutations.saveProtection),
          getPermissionBlockReason(effectivePermissions, WHATSAPP_PERMISSION_CODES.RULES),
        )}
        onSave={mutations.saveProtection}
        onRetry={onRetry}
      />
      <AuditLogSection
        audit={audit}
        filters={auditFilters}
        onFiltersChange={onAuditFiltersChange}
        onPageChange={onAuditPageChange}
        onRetry={onRetry}
        paginationBlockedReason={SETTINGS_PENDING_REASON}
      />
      <PermissionsSection
        effective={effectivePermissions}
        matrix={permissionMatrix}
        canEdit={canManage}
        blockedReason={combineBlockReasons(
          pending(mutations.savePermissions),
          UNDEFINED_PERMISSION_REASON,
        )}
        onSave={mutations.savePermissions}
        onRetry={onRetry}
      />
    </div>
  );
}
