"use client";

import { useMemo } from "react";
import {
  OrderDetailModalProvider,
  useOrderDetailModal,
} from "@/components/orders/OrderDetailModal";
import { isWhatsAppContractAvailable } from "@/features/whatsapp/constants/whatsapp-contracts";
import { useWhatsAppScopeCatalogs } from "@/features/whatsapp/hooks/use-whatsapp-scope-catalogs";
import { RULE_LINK_PARAMS, resolveRuleLink } from "@/features/whatsapp/utils/rule-link.util";
import { SchedulingView } from "./SchedulingView";

const PENDING = { kind: "pending-integration" } as const;

interface SchedulingTabProps {
  canManage: boolean;
  businessName: string;
  search: string;
  onNavigate: (search: string) => void;
}

function SchedulingTabContent({ canManage, businessName, search, onNavigate }: SchedulingTabProps) {
  const catalogs = useWhatsAppScopeCatalogs();
  const { openOrderDetail } = useOrderDetailModal();
  const link = useMemo(() => resolveRuleLink(new URLSearchParams(search)), [search]);

  const dismissLink = () => {
    const params = new URLSearchParams(search);
    params.delete(RULE_LINK_PARAMS.rule);
    params.delete(RULE_LINK_PARAMS.template);
    onNavigate(params.toString());
  };

  return (
    <SchedulingView
      rules={PENDING}
      templates={PENDING}
      settings={PENDING}
      skipped={PENDING}
      queue={PENDING}
      campaigns={PENDING}
      catalogs={catalogs}
      canManage={canManage}
      canPersist={{
        rules: isWhatsAppContractAvailable("rules"),
        settings: isWhatsAppContractAvailable("settings"),
        campaigns: isWhatsAppContractAvailable("campaigns"),
      }}
      businessName={businessName}
      link={link}
      onDismissLink={dismissLink}
      getRulePreview={() => PENDING}
      getSegmentCount={() => PENDING}
      onCorrectOrder={(orderId) => openOrderDetail(orderId, { initialTab: "seguimiento" })}
    />
  );
}

export function SchedulingTab(props: SchedulingTabProps) {
  return (
    <OrderDetailModalProvider>
      <SchedulingTabContent {...props} />
    </OrderDetailModalProvider>
  );
}
