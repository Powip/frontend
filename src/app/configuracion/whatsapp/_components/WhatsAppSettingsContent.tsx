"use client";

import { useAuth } from "@/contexts/AuthContext";
import { resolveWhatsAppAccess } from "@/features/whatsapp/utils/whatsapp-access.util";
import {
  WhatsAppPageFrame,
  WhatsAppPageHeader,
  WhatsAppPendingStatusPill,
} from "./WhatsAppPageLayout";
import { WhatsAppTabs } from "./WhatsAppTabs";

export function WhatsAppSettingsContent() {
  const { auth } = useAuth();

  if (!auth) return null;

  const access = resolveWhatsAppAccess({ role: auth.user.role, email: auth.user.email });
  const businessName = auth.company?.name?.trim() || "Tu tienda";

  return (
    <WhatsAppPageFrame>
      <WhatsAppPageHeader status={<WhatsAppPendingStatusPill />} />
      <WhatsAppTabs access={access} businessName={businessName} />
    </WhatsAppPageFrame>
  );
}
