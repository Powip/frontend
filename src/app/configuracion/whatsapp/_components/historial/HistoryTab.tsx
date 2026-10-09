"use client";

import { useMemo, useState } from "react";
import {
  OrderDetailModalProvider,
  useOrderDetailModal,
} from "@/components/orders/OrderDetailModal";
import { useAuth } from "@/contexts/AuthContext";
import { DEFAULT_HISTORY_PERIOD } from "@/features/whatsapp/constants/whatsapp-settings-catalog";
import { WHATSAPP_HISTORY_STATUS_FILTERS } from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppHistoryFilters } from "@/features/whatsapp/models/history.model";
import { resolveEffectivePermissions } from "@/features/whatsapp/utils/whatsapp-permissions.util";
import { HistoryView } from "./HistoryView";

const PENDING = { kind: "pending-integration" } as const;

const INITIAL_FILTERS: WhatsAppHistoryFilters = {
  period: DEFAULT_HISTORY_PERIOD,
  status: WHATSAPP_HISTORY_STATUS_FILTERS.ALL,
  search: "",
  storeId: null,
};

function HistoryTabContent() {
  const { auth } = useAuth();
  const { openOrderDetail } = useOrderDetailModal();
  const storesSource = auth?.company?.stores;
  const stores = useMemo(
    () => (storesSource ?? []).map((store) => ({ id: store.id, name: store.name })),
    [storesSource],
  );
  const [filters, setFilters] = useState<WhatsAppHistoryFilters>(INITIAL_FILTERS);
  const effectivePermissions = useMemo(() => resolveEffectivePermissions(null), []);

  return (
    <HistoryView
      stores={stores}
      filters={filters}
      onFiltersChange={setFilters}
      now={new Date()}
      metrics={PENDING}
      page={PENDING}
      effectivePermissions={effectivePermissions}
      exportPermission={null}
      onOpenOrder={(orderId) => openOrderDetail(orderId, { initialTab: "seguimiento" })}
    />
  );
}

export function HistoryTab() {
  return (
    <OrderDetailModalProvider>
      <HistoryTabContent />
    </OrderDetailModalProvider>
  );
}
