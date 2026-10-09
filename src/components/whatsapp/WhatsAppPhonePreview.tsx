import { BadgeCheck, ExternalLink, FileText, Reply } from "lucide-react";
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
  const hasBody = body.trim().length > 0;

  return (
    <figure
      className={cn(
        "mx-auto w-full max-w-[330px] overflow-hidden rounded-[28px] border-8 border-zinc-800 bg-[#EFE7DD] shadow-xl dark:bg-[#0B141A]",
        className,
      )}
      aria-label={`Vista previa del mensaje de ${businessName} en WhatsApp`}
    >
      <div className="flex items-center gap-2.5 bg-[#008069] px-3.5 py-3 text-white dark:bg-[#202C33]">
        <span
          className="grid h-8 w-8 place-items-center rounded-full bg-white text-xs font-bold text-teal-700"
          aria-hidden="true"
        >
          {getInitials(businessName)}
        </span>
        <div className="min-w-0">
          <p className="flex items-center gap-1 truncate text-sm font-semibold">
            {businessName}
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
          </p>
          <p className="text-[11px] opacity-80">Cuenta de empresa</p>
        </div>
      </div>

      <div className="flex min-h-[320px] flex-col gap-1 px-3 pb-5 pt-4">
        <span className="mb-1.5 self-center rounded-md bg-white px-2.5 py-0.5 text-[11px] uppercase text-slate-500 dark:bg-[#202C33] dark:text-slate-300">
          {dayLabel}
        </span>

        <div className="max-w-[92%] whitespace-pre-wrap break-words rounded-[0_10px_10px_10px] bg-white px-2.5 pb-1.5 pt-2 text-[13.5px] leading-snug text-[#111B21] shadow-sm dark:bg-[#202C33] dark:text-[#E9EDEF]">
          {header?.type === "document" && (
            <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-black/5 p-2.5 font-semibold dark:bg-white/10">
              <FileText className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="truncate">{header.fileName ?? "Documento PDF"}</span>
            </div>
          )}
          {header?.type === "text" && header.text.trim() && (
            <p className="mb-1 font-bold">
              <WhatsAppFormattedText text={header.text} values={values} highlightVariables />
            </p>
          )}
          {hasBody ? (
            <WhatsAppFormattedText text={body} values={values} highlightVariables />
          ) : (
            <span className="text-slate-400">{emptyBodyLabel}</span>
          )}
          {footer?.trim() && <p className="mt-1 text-xs text-slate-500">{footer}</p>}
          {timeLabel && (
            <p className="mt-0.5 text-right text-[10.5px] text-slate-500">{timeLabel}</p>
          )}
        </div>

        {buttonText?.trim() && (
          <div className="flex w-[92%] items-center justify-center gap-1.5 rounded-[10px] bg-white p-2 text-[13.5px] font-medium text-sky-600 shadow-sm dark:bg-[#202C33] dark:text-sky-400">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {buttonText}
          </div>
        )}
        {quickReplyText?.trim() && (
          <div className="flex w-[92%] items-center justify-center gap-1.5 rounded-[10px] bg-white p-2 text-[13.5px] font-medium text-sky-600 shadow-sm dark:bg-[#202C33] dark:text-sky-400">
            <Reply className="h-4 w-4" aria-hidden="true" />
            {quickReplyText}
          </div>
        )}
      </div>
    </figure>
  );
}
