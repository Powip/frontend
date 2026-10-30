import { WaPill, type WaTone } from "@/components/whatsapp/ui/WaPill";
import { WHATSAPP_TEMPLATE_STATUS_LABELS } from "@/features/whatsapp/constants/whatsapp-template-catalog";
import {
  WHATSAPP_TEMPLATE_STATUSES,
  type WhatsAppTemplateStatus,
} from "@/features/whatsapp/enums/whatsapp.enums";

const STATUS_TONES: Record<WhatsAppTemplateStatus, WaTone> = {
  [WHATSAPP_TEMPLATE_STATUSES.DRAFT]: "neutral",
  [WHATSAPP_TEMPLATE_STATUSES.PENDING]: "warn",
  [WHATSAPP_TEMPLATE_STATUSES.APPROVED]: "ok",
  [WHATSAPP_TEMPLATE_STATUSES.REJECTED]: "err",
  [WHATSAPP_TEMPLATE_STATUSES.PAUSED]: "err",
};

interface TemplateStatusBadgeProps {
  status: WhatsAppTemplateStatus;
  className?: string;
}

export function TemplateStatusBadge({ status, className }: TemplateStatusBadgeProps) {
  return (
    <WaPill tone={STATUS_TONES[status]} className={className}>
      {WHATSAPP_TEMPLATE_STATUS_LABELS[status]}
    </WaPill>
  );
}
