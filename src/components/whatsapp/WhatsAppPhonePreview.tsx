import { Check, ExternalLink, FileText, Reply } from "lucide-react";
import type { TemplateVariableValues } from "@/features/whatsapp/utils/template-render.util";
import { cn } from "@/lib/utils";
import { WhatsAppFormattedText } from "./WhatsAppFormattedText";

export type WhatsAppPreviewHeader =
  | { type: "text"; text: string }
  | { type: "document"; fileName: string | null };

interface WhatsAppPhonePreviewProps {
  businessName: string;
  body: string;
  values?: TemplateVariableValues;
  header?: WhatsAppPreviewHeader | null;
  footer?: string | null;
  buttonText?: string | null;
  quickReplyText?: string | null;
  timeLabel?: string | null;
  dayLabel?: string;
  emptyBodyLabel?: string;
  className?: string;
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "?"
  );
}

const BUBBLE_SHADOW = "shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]";

export function WhatsAppPhonePreview({
  businessName,
  body,
  values,
  header,
  footer,
  buttonText,
  quickReplyText,
  timeLabel,
  dayLabel = "Hoy",
  emptyBodyLabel = "Escribe tu mensaje…",
  className,
}: WhatsAppPhonePreviewProps) {
  const hasBody = (body ?? "").trim().length > 0;

  return (
    <figure
      className={cn(
        "m-0 mx-auto w-full max-w-[330px] overflow-hidden rounded-[28px] border-8 border-[#1F2329] bg-wa-chat-bg shadow-[0_18px_40px_rgba(0,0,0,0.18)]",
        className,
      )}
      aria-label={`Vista previa del mensaje de ${businessName} en WhatsApp`}
    >
      <div className="flex items-center gap-2.5 bg-wa-chat-head px-3.5 py-3 text-white">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-wa-teal"
          aria-hidden="true"
        >
          {getInitials(businessName)}
        </span>
        <div className="min-w-0">
          <p className="m-0 flex items-center gap-1 truncate text-sm font-semibold">
            {businessName}
            <Check className="size-3.5 shrink-0 stroke-[3] text-[#25D366]" aria-hidden="true" />
          </p>
          <p className="m-0 text-[11px] opacity-80">Cuenta de empresa</p>
        </div>
      </div>

      <div className="flex min-h-[340px] flex-col gap-1 bg-[radial-gradient(color-mix(in_srgb,var(--wa-bubble-fg)_6%,transparent)_1px,transparent_1px)] bg-[length:14px_14px] px-3 pt-4 pb-5">
        <span className="mb-1.5 self-center rounded-[7px] bg-wa-bubble px-2.5 py-[3px] text-[11px] uppercase text-wa-muted">
          {dayLabel}
        </span>

        <div
          className={cn(
            "max-w-[92%] whitespace-pre-wrap rounded-[0_10px_10px_10px] bg-wa-bubble px-2.5 pt-2 pb-1.5 text-[13.5px] leading-[1.45] text-wa-bubble-fg [overflow-wrap:anywhere]",
            BUBBLE_SHADOW,
          )}
        >
          {header?.type === "document" && (
            <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-[color-mix(in_srgb,var(--wa-bubble-fg)_6%,transparent)] p-2.5 font-semibold">
              <FileText className="size-5 shrink-0" aria-hidden="true" />
              <span className="truncate">{header.fileName ?? "Documento PDF"}</span>
            </div>
          )}
          {header?.type === "text" && header.text.trim() && (
            <p className="m-0 mb-1 font-bold">
              <WhatsAppFormattedText text={header.text} values={values} highlightVariables />
            </p>
          )}
          {hasBody ? (
            <WhatsAppFormattedText text={body} values={values} highlightVariables />
          ) : (
            <span className="text-[#8696A0]">{emptyBodyLabel}</span>
          )}
          {footer?.trim() && <p className="m-0 mt-1 text-xs text-[#8696A0]">{footer}</p>}
          {timeLabel && (
            <p className="m-0 mt-0.5 text-right text-[10.5px] text-[#8696A0]">{timeLabel}</p>
          )}
        </div>

        {buttonText?.trim() && (
          <div
            className={cn(
              "flex w-[92%] items-center justify-center gap-1.5 rounded-[10px] bg-wa-bubble p-[9px] text-[13.5px] font-medium text-[#00A5F4]",
              BUBBLE_SHADOW,
            )}
          >
            <ExternalLink className="size-[15px]" aria-hidden="true" />
            {buttonText}
          </div>
        )}
        {quickReplyText?.trim() && (
          <div
            className={cn(
              "flex w-[92%] items-center justify-center gap-1.5 rounded-[10px] bg-wa-bubble p-[9px] text-[13.5px] font-medium text-[#00A5F4]",
              BUBBLE_SHADOW,
            )}
          >
            <Reply className="size-[15px]" aria-hidden="true" />
            {quickReplyText}
          </div>
        )}
      </div>
    </figure>
  );
}
