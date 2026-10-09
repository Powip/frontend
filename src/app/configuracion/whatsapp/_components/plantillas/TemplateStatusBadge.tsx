import { WHATSAPP_TEMPLATE_STATUS_LABELS } from "@/features/whatsapp/constants/whatsapp-template-catalog";
import {
  WHATSAPP_TEMPLATE_STATUSES,
  type WhatsAppTemplateStatus,
} from "@/features/whatsapp/enums/whatsapp.enums";
import { cn } from "@/lib/utils";

const STATUS_CLASSNAMES: Record<WhatsAppTemplateStatus, string> = {
  [WHATSAPP_TEMPLATE_STATUSES.DRAFT]:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200",
  [WHATSAPP_TEMPLATE_STATUSES.PENDING]:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  [WHATSAPP_TEMPLATE_STATUSES.APPROVED]:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  [WHATSAPP_TEMPLATE_STATUSES.REJECTED]:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200",
  [WHATSAPP_TEMPLATE_STATUSES.PAUSED]:
    "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-200",
};

interface TemplateStatusBadgeProps {
  status: WhatsAppTemplateStatus;
  className?: string;
}

export function TemplateStatusBadge({ status, className }: TemplateStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        STATUS_CLASSNAMES[status],
        className,
      )}
    >
      {WHATSAPP_TEMPLATE_STATUS_LABELS[status]}
    </span>
  );
}
