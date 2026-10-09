import {
  Camera,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  type LucideIcon,
  Mic,
  Smile,
  StickyNote,
  Video,
} from "lucide-react";
import Image from "next/image";
import { Fragment } from "react";
import {
  WHATSAPP_EVIDENCE_TYPES,
  WHATSAPP_MEDIA_TYPES,
  WHATSAPP_MESSAGE_DIRECTIONS,
  WHATSAPP_MESSAGE_KINDS,
  type WhatsAppEvidenceType,
  type WhatsAppMediaType,
} from "@/features/whatsapp/enums/whatsapp.enums";
import type {
  WhatsAppMessage,
  WhatsAppMessageMedia,
} from "@/features/whatsapp/models/message.model";
import {
  formatLimaDayLabel,
  formatLimaTime,
  isSameLimaDay,
} from "@/features/whatsapp/utils/lima-time.util";
import { isMetaTrackedStatus } from "@/features/whatsapp/utils/message-status.util";
import { cn } from "@/lib/utils";
import { MessageStatusTicks } from "./MessageStatusTicks";
import { WhatsAppFormattedText } from "./WhatsAppFormattedText";

interface WhatsAppThreadProps {
  messages: WhatsAppMessage[];
  now?: Date;
  emptyLabel?: string;
  className?: string;
}

function getOutboundLabel(message: WhatsAppMessage): string {
  switch (message.kind) {
    case WHATSAPP_MESSAGE_KINDS.TEMPLATE:
      return message.templateName ? `Plantilla · ${message.templateName}` : "Plantilla";
    case WHATSAPP_MESSAGE_KINDS.AUTO_REPLY:
      return "Respuesta automática";
    case WHATSAPP_MESSAGE_KINDS.ECHO:
      return "Enviado desde la app del celular";
    default:
      return message.author?.name ?? "Asesora";
  }
}

function formatFileSize(sizeBytes: number | null): string | null {
  if (!sizeBytes || sizeBytes <= 0) return null;
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

const EVIDENCE_PRESENTATION: Record<WhatsAppEvidenceType, { title: string; detail: string }> = {
  [WHATSAPP_EVIDENCE_TYPES.DELIVERY]: {
    title: "Foto de entrega",
    detail: "Subida al entregar el pedido",
  },
  [WHATSAPP_EVIDENCE_TYPES.DISPATCH]: {
    title: "Evidencia de despacho",
    detail: "Foto del despacho; no confirma la entrega",
  },
  [WHATSAPP_EVIDENCE_TYPES.PREPARATION]: {
    title: "Evidencia de preparación",
    detail: "Foto de la preparación; no confirma la entrega",
  },
};

const UNKNOWN_EVIDENCE = {
  title: "Evidencia del pedido",
  detail: "Tipo de evidencia sin informar",
};

const MEDIA_PRESENTATION: Record<WhatsAppMediaType, { label: string; icon: LucideIcon }> = {
  [WHATSAPP_MEDIA_TYPES.IMAGE]: { label: "Imagen", icon: ImageIcon },
  [WHATSAPP_MEDIA_TYPES.AUDIO]: { label: "Audio", icon: Mic },
  [WHATSAPP_MEDIA_TYPES.VIDEO]: { label: "Video", icon: Video },
  [WHATSAPP_MEDIA_TYPES.DOCUMENT]: { label: "Documento", icon: FileText },
  [WHATSAPP_MEDIA_TYPES.STICKER]: { label: "Sticker", icon: Smile },
};

function NoteItem({ message }: { message: WhatsAppMessage }) {
  return (
    <div className="flex max-w-[90%] items-start gap-1.5 self-center rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs text-amber-950 dark:bg-amber-500/15 dark:text-amber-100">
      <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <p className="[overflow-wrap:anywhere]">
        <span className="sr-only">Nota interna: </span>
        {message.body}
        {message.author && (
          <span className="text-amber-800 dark:text-amber-200"> · {message.author.name}</span>
        )}
      </p>
    </div>
  );
}

function EvidenceItem({ message }: { message: WhatsAppMessage }) {
  const evidence = message.evidence;
  const takenAt = evidence?.takenAt ?? message.createdAt;
  const presentation = evidence?.type ? EVIDENCE_PRESENTATION[evidence.type] : UNKNOWN_EVIDENCE;
  const title = [presentation.title, evidence?.courier, formatLimaTime(takenAt)]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex items-center gap-2.5 self-center rounded-lg border border-dashed border-slate-300 bg-white/80 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900/60">
      {evidence?.imageUrl ? (
        <Image
          src={evidence.imageUrl}
          alt={`${presentation.title} del pedido, ${formatLimaTime(takenAt)}`}
          width={56}
          height={56}
          unoptimized
          className="h-14 w-14 rounded-md object-cover"
        />
      ) : (
        <span className="grid h-14 w-14 place-items-center rounded-md bg-slate-200 dark:bg-slate-700">
          <Camera className="h-5 w-5" aria-hidden="true" />
        </span>
      )}
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-muted-foreground">{presentation.detail}</p>
      </div>
    </div>
  );
}

function OutboundBubble({ message }: { message: WhatsAppMessage }) {
  const size = message.document ? formatFileSize(message.document.sizeBytes) : null;
  return (
    <div className="flex max-w-[85%] flex-col items-end gap-0.5 self-end">
      <div className="w-full whitespace-pre-wrap break-words rounded-[10px_0_10px_10px] [overflow-wrap:anywhere] bg-[#D9FDD3] px-2.5 py-1.5 text-[13px] text-[#111B21] shadow-sm dark:bg-[#005C4B] dark:text-[#E9EDEF]">
        <p className="mb-0.5 text-[10.5px] font-semibold opacity-70">{getOutboundLabel(message)}</p>
        {message.document && (
          <div className="mb-1 flex items-center gap-2 rounded-md bg-black/5 p-2 font-semibold dark:bg-white/10">
            <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{message.document.fileName}</span>
            {size && <span className="shrink-0 text-[11px] font-normal opacity-70">{size}</span>}
          </div>
        )}
        <WhatsAppFormattedText text={message.body} />
        {message.buttonText && (
          <span className="mt-1.5 flex items-center justify-center gap-1 border-t border-black/10 pt-1 text-[12.5px] font-medium text-sky-700 dark:border-white/10 dark:text-sky-300">
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            {message.buttonText}
          </span>
        )}
        <span className="mt-0.5 flex items-center justify-end gap-1.5 text-[10.5px] opacity-80">
          <time dateTime={message.createdAt.toISOString()}>
            {formatLimaTime(message.createdAt)}
          </time>
          {message.status && <MessageStatusTicks status={message.status} showLabel={false} />}
        </span>
      </div>
      {message.status && !isMetaTrackedStatus(message.status) && (
        <span className="text-[11px]">
          <MessageStatusTicks status={message.status} showDetail />
          {message.failureReason && (
            <span className="block text-red-700 dark:text-red-300">{message.failureReason}</span>
          )}
        </span>
      )}
    </div>
  );
}

function InboundMedia({ media }: { media: WhatsAppMessageMedia }) {
  const { label, icon: Icon } = MEDIA_PRESENTATION[media.type];
  return (
    <span className="mb-1 flex items-center gap-1.5 font-medium">
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {media.url ? (
        <a
          href={media.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          {label}
          <span className="sr-only"> (se abre en otra pestaña)</span>
        </a>
      ) : (
        <span>{label} · no disponible</span>
      )}
    </span>
  );
}

function InboundBubble({ message }: { message: WhatsAppMessage }) {
  const text = message.body || message.media?.caption || "";
  return (
    <div className="max-w-[85%] self-start whitespace-pre-wrap break-words rounded-[0_10px_10px_10px] bg-white px-2.5 py-1.5 text-[13px] text-[#111B21] shadow-sm [overflow-wrap:anywhere] dark:bg-[#202C33] dark:text-[#E9EDEF]">
      <span className="sr-only">Comprador: </span>
      {message.media && <InboundMedia media={message.media} />}
      {text}
      <time
        dateTime={message.createdAt.toISOString()}
        className="mt-0.5 block text-right text-[10.5px] opacity-70"
      >
        {formatLimaTime(message.createdAt)}
      </time>
    </div>
  );
}

function ThreadItem({ message }: { message: WhatsAppMessage }) {
  if (message.kind === WHATSAPP_MESSAGE_KINDS.NOTE) return <NoteItem message={message} />;
  if (message.kind === WHATSAPP_MESSAGE_KINDS.EVIDENCE) return <EvidenceItem message={message} />;
  if (message.direction === WHATSAPP_MESSAGE_DIRECTIONS.INBOUND) {
    return <InboundBubble message={message} />;
  }
  return <OutboundBubble message={message} />;
}

export function WhatsAppThread({
  messages,
  now,
  emptyLabel = "Todavía no hay mensajes en esta conversación.",
  className,
}: WhatsAppThreadProps) {
  const ordered = [...messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  return (
    <div className={cn("rounded-xl bg-[#EFE7DD] p-3 dark:bg-[#0B141A]", className)}>
      {ordered.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-600 dark:text-slate-300">{emptyLabel}</p>
      ) : (
        <ol className="flex flex-col gap-1.5" aria-label="Mensajes de la conversación">
          {ordered.map((message, index) => {
            const previous = ordered[index - 1];
            const startsDay = !previous || !isSameLimaDay(previous.createdAt, message.createdAt);
            return (
              <Fragment key={message.id}>
                {startsDay && (
                  <li className="my-1 self-center rounded-md bg-white px-2.5 py-0.5 text-[11px] font-medium uppercase text-slate-500 dark:bg-[#202C33] dark:text-slate-300">
                    {formatLimaDayLabel(message.createdAt, now)}
                  </li>
                )}
                <li className="flex flex-col">
                  <ThreadItem message={message} />
                </li>
              </Fragment>
            );
          })}
        </ol>
      )}
    </div>
  );
}
