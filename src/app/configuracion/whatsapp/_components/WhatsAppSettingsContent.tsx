"use client";

import { Clock } from "lucide-react";
import { HeaderConfig } from "@/components/header/HeaderConfig";
import { useAuth } from "@/contexts/AuthContext";
import { resolveWhatsAppAccess } from "@/features/whatsapp/utils/whatsapp-access.util";
import { WhatsAppTabs } from "./WhatsAppTabs";

export function WhatsAppSettingsContent() {
  const { auth } = useAuth();

  if (!auth) return null;

  const access = resolveWhatsAppAccess({ role: auth.user.role, email: auth.user.email });
  const stores = auth.company?.stores ?? [];
  const businessName = auth.company?.name?.trim() || "Tu tienda";

  return (
    <div className="flex-1 p-4 md:p-8">
      <HeaderConfig
        title="Notificaciones por WhatsApp"
        description="Conecta tu número de WhatsApp Business y avisa a tus clientes en cada etapa del envío con su link de rastreo POWIP."
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          Integración pendiente
        </span>
      </HeaderConfig>
      <div className="pb-6 md:px-6">
        <WhatsAppTabs access={access} stores={stores} businessName={businessName} />
      </div>
    </div>
  );
}
