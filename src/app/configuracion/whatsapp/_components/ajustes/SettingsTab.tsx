"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { WhatsAppTab } from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppAuditFilters } from "@/features/whatsapp/models/settings-tab.model";
import { resolveEffectivePermissions } from "@/features/whatsapp/utils/whatsapp-permissions.util";
import { SettingsView } from "./SettingsView";

const PENDING = { kind: "pending-integration" } as const;
const NO_MUTATIONS = {};

interface SettingsTabProps {
  canManage: boolean;
  search: string;
  onNavigate: (search: string) => void;
}

export function SettingsTab({ canManage, search, onNavigate }: SettingsTabProps) {
  const { auth, selectedStoreId } = useAuth();
  const storesSource = auth?.company?.stores;
  const stores = useMemo(
    () => (storesSource ?? []).map((store) => ({ id: store.id, name: store.name })),
    [storesSource],
  );
  const storeContext = stores.find((store) => store.id === selectedStoreId) ?? stores[0] ?? null;
  const effectivePermissions = useMemo(() => resolveEffectivePermissions(null), []);
  const [optOutSearch, setOptOutSearch] = useState("");
  const [auditFilters, setAuditFilters] = useState<WhatsAppAuditFilters>({
    entity: null,
    userId: null,
  });

  const openTab = (tab: WhatsAppTab) => {
    const params = new URLSearchParams(search);
    params.set("tab", tab);
    onNavigate(params.toString());
  };

  return (
    <SettingsView
      stores={stores}
      storeContext={storeContext}
      now={new Date()}
      canManage={canManage}
      effectivePermissions={effectivePermissions}
      protection={PENDING}
      optOuts={PENDING}
      optOutSearch={optOutSearch}
      onOptOutSearchChange={setOptOutSearch}
      alertSettings={PENDING}
      recentAlerts={PENDING}
      audit={PENDING}
      auditFilters={auditFilters}
      onAuditFiltersChange={setAuditFilters}
      permissionMatrix={PENDING}
      mutations={NO_MUTATIONS}
      onOpenTab={openTab}
    />
  );
}
