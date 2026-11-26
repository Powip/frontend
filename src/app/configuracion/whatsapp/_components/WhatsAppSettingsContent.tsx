"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useWhatsAppRealtime } from "@/features/whatsapp/hooks/use-whatsapp-realtime";
import { resolveWhatsAppAccess } from "@/features/whatsapp/utils/whatsapp-access.util";
import {
  WhatsAppPageFrame,
  WhatsAppPageHeader,
} from "./WhatsAppPageLayout";
import { WhatsAppConnectionStatusPill } from "./WhatsAppConnectionStatusPill";
import { WhatsAppTabs } from "./WhatsAppTabs";

export function WhatsAppSettingsContent() {
  const { auth } = useAuth();
  // C-00.9: una sola conexión de tiempo real para todas las pestañas del módulo.
  useWhatsAppRealtime(auth?.company?.id ?? auth?.user?.companyId ?? null, !!auth);

  if (!auth) return null;

  const access = resolveWhatsAppAccess({ role: auth.user.role, email: auth.user.email });
  const businessName = auth.company?.name?.trim() || "Tu tienda";

  return (
    <WhatsAppPageFrame>
      <WhatsAppPageHeader status={<WhatsAppConnectionStatusPill />} />
      <WhatsAppTabs access={access} businessName={businessName} />
    </WhatsAppPageFrame>
  );
}
