import { Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRuleDefinition } from "@/features/whatsapp/constants/whatsapp-scheduling-catalog";
import type { WhatsAppResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppRulesData } from "@/features/whatsapp/models/rule.model";
import type { WhatsAppTemplate } from "@/features/whatsapp/models/template.model";
import type { RuleLinkResolution } from "@/features/whatsapp/utils/rule-link.util";

interface RuleLinkNoticeProps {
  link: RuleLinkResolution;
  rules: WhatsAppResourceState<WhatsAppRulesData>;
  templates: WhatsAppResourceState<WhatsAppTemplate[]>;
  onDismiss: () => void;
}

function getMessage({
  link,
  rules,
  templates,
}: Omit<RuleLinkNoticeProps, "onDismiss">): string | null {
  if (link.kind === "none") return null;
  if (link.kind === "unknown-rule") {
    return "No encontramos el aviso automático indicado en el enlace. No se activó ni se creó nada.";
  }
  if (link.kind === "no-rule-for-template") {
    return "Esta plantilla no tiene un aviso automático asociado (por ejemplo, es solo para envíos programados). No se activó ni se creó nada.";
  }
  const label = getRuleDefinition(link.ruleKey)?.label ?? link.ruleKey;
  if (rules.kind !== "ready") {
    return `Llegaste desde Plantillas para activar «${label}». Los avisos automáticos están pendientes de integración: no se activó nada.`;
  }
  const rule = rules.data.rules.find((item) => item.key === link.ruleKey);
  if (!rule) {
    return `El aviso «${label}» no está disponible para esta tienda. No se creó ni se activó nada.`;
  }
  if (link.templateId && templates.kind === "ready") {
    const template = templates.data.find((item) => item.id === link.templateId);
    if (!template) {
      return `Abrimos «${label}», pero la plantilla del enlace ya no existe. Elige una plantilla aprobada.`;
    }
  }
  return `Abrimos «${label}». Revisa la plantilla y la configuración; el aviso se activa solo cuando tú lo confirmes.`;
}

export function RuleLinkNotice({ onDismiss, ...props }: RuleLinkNoticeProps) {
  const message = getMessage(props);
  if (!message) return null;
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">{message}</p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        aria-label="Cerrar aviso"
        onClick={onDismiss}
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
