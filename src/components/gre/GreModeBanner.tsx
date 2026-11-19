"use client";

import { FlaskConical, KeyRound, Lock } from "lucide-react";
import type { GreSettings } from "@/features/sunat/despatch-advice/types/despatch-advice.types";
import { GRE_NOT_ENABLED_NOTICE, GRE_PILOT_NOTICE } from "@/features/sunat/despatch-advice/utils/gre-form";

// FEAT-24 H12-D6 — aviso de modo de pruebas de la guía de remisión. Se muestra
// mientras ms-sunat no envía a SUNAT (sin conexión o contra un simulador) o
// mientras la empresa no tenga credenciales GRE. SUNAT no tiene beta REST para
// la GRE: el modo de pruebas es un simulador o no enviar nada. Con SUNAT
// producción, ms-sunat solo deja emitir a las empresas habilitadas
// (enabledForCompany; si no, 403 GRE_NO_HABILITADA).

interface Props {
  settings: GreSettings | undefined;
  /** Si se pasa, se mira ese RUC en lugar de «alguno configurado». */
  sunatProfileId?: string;
}

export function greModeNotice(
  settings: GreSettings | undefined,
  sunatProfileId?: string,
): { tone: "test" | "disabled" | "credentials"; title: string; body: string } | null {
  if (!settings) return null;
  if (settings.sunatConnection === "NOT_CONFIGURED")
    return {
      tone: "test",
      title: "Guías de remisión en modo de pruebas.",
      body: `${GRE_PILOT_NOTICE} Por ahora Powip no envía guías a SUNAT; puedes dejar cargadas tus credenciales GRE.`,
    };
  if (settings.sunatConnection === "OTHER")
    return {
      tone: "test",
      title: "Guías de remisión en modo de pruebas.",
      body: `Las guías van a un entorno de pruebas, no a SUNAT, y no sirven para trasladar mercadería. ${GRE_PILOT_NOTICE}`,
    };
  if (!settings.enabledForCompany)
    return {
      tone: "disabled",
      title: GRE_NOT_ENABLED_NOTICE,
      body: "Se habilita empresa por empresa, empezando por la piloto. Mientras tanto puedes dejar cargadas tus credenciales GRE.",
    };
  const configured = sunatProfileId
    ? settings.profiles.some((profile) => profile.sunatProfileId === sunatProfileId && profile.configured)
    : settings.profiles.some((profile) => profile.isActive && profile.configured);
  if (!configured)
    return {
      tone: "credentials",
      title: sunatProfileId ? "Este RUC no tiene credenciales GRE." : "Falta configurar las credenciales GRE.",
      body: `Carga el client_id y el client_secret de SOL en Facturación › Certificado Digital. ${GRE_PILOT_NOTICE}`,
    };
  return null;
}

export function GreModeBanner({ settings, sunatProfileId }: Props) {
  const notice = greModeNotice(settings, sunatProfileId);
  if (!notice) return null;
  const Icon = notice.tone === "test" ? FlaskConical : notice.tone === "disabled" ? Lock : KeyRound;
  return (
    <div
      role="note"
      data-testid="gre-mode-banner"
      className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950/40"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
      <div>
        <span className="font-semibold">{notice.title} </span>
        {notice.body}
      </div>
    </div>
  );
}
