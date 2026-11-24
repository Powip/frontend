"use client";
import { Clock, Flag, Gift, Lock, MessageSquareLock, PackageCheck, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pipelineOf } from "@/lib/crmPipelines";
import { useConversationOrders, useCoreOrder, useUpdateConversation } from "@/hooks/useCrmChat";
import { useScript } from "@/hooks/useCrmContent";
import { usePipelines } from "@/hooks/useCrmPlanning";
import type { Conversation, Message } from "@/types/crm";
import { CHANNEL_LABEL, WINDOW_CLOSED_NOTICE } from "./format";
import { isHumanAgentOnly, replyHoursLeft } from "./saleGuide";

const TONE = {
  ok: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  warn: "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  danger: "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200",
  info: "bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200",
  brand: "bg-primary/5 text-primary",
};

interface BannerProps {
  tone: keyof typeof TONE;
  icon: LucideIcon;
  testId: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

function Banner({ tone, icon: Icon, testId, action, children }: BannerProps) {
  return (
    <div
      role="status"
      data-testid={testId}
      className={cn("flex flex-wrap items-center gap-2.5 border-b px-4 py-1.5 text-[12.5px]", TONE[tone])}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

/** «Perdido · motivo»: reabrir devuelve el chat a la primera etapa abierta. */
function LostBanner({ conversation }: { conversation: Conversation }) {
  const pipelines = usePipelines();
  const update = useUpdateConversation(conversation.id);
  const stages = pipelineOf(pipelines.data, conversation)?.stages ?? [];
  if (stages.find((s) => s.id === conversation.stageId)?.kind !== "lost") return null;
  const firstOpen = stages.find((s) => s.kind === "open");
  return (
    <Banner
      tone="danger"
      icon={Flag}
      testId="lost-banner"
      action={
        <Button
          size="sm"
          variant="outline"
          disabled={update.isPending}
          onClick={() => update.mutate({ status: "open", ...(firstOpen ? { stageId: firstOpen.id } : {}) })}
        >
          Reabrir
        </Button>
      }
    >
      <b>Perdido</b>
      {conversation.lostReason && ` · ${conversation.lostReason}`}
    </Banner>
  );
}

function OrderBanner({ conversation }: { conversation: Conversation }) {
  const order = useConversationOrders(conversation.id).data?.[0];
  const core = useCoreOrder(order?.orderId ?? null).data;
  if (!order) return null;
  const number = core?.orderNumber ?? order.orderNumber ?? "";
  return (
    <Banner tone="ok" icon={PackageCheck} testId="order-banner">
      {core?.status === "ENTREGADO" ? `Entregado · pedido ${number}` : `Venta · pedido ${number} ya está en Ventas`}
    </Banner>
  );
}

function WindowClosedBanner({ conversation, canCall }: { conversation: Conversation; canCall: boolean }) {
  if (conversation.channel !== "whatsapp") return null;
  return (
    <Banner tone="danger" icon={Lock} testId="window-closed-banner">
      {canCall ? WINDOW_CLOSED_NOTICE.replace(/\.$/, " o llamarlo (aceptó llamadas).") : WINDOW_CLOSED_NOTICE}
    </Banner>
  );
}

function WindowOpenBanner({ conversation }: { conversation: Conversation }) {
  if (isHumanAgentOnly(conversation)) {
    return (
      <Banner tone="warn" icon={Clock} testId="human-agent-banner">
        Ventana de 24 h cerrada. Puedes responder como <b>agente humano</b> hasta 7 días después del último mensaje.
      </Banner>
    );
  }
  return (
    <Banner tone="ok" icon={Clock} testId="window-banner">
      Ventana abierta · quedan <b>{replyHoursLeft(conversation)} h</b>. Tus mensajes no tienen costo.
    </Banner>
  );
}

function CommentBanner({ channel }: Pick<Conversation, "channel">) {
  return (
    <Banner tone="info" icon={MessageSquareLock} testId="comment-banner">
      Comentario público en {CHANNEL_LABEL[channel]}. Responde por privado para cotizar sin que otros vean el precio.
    </Banner>
  );
}

function PromoBanner({ onInsert }: { onInsert: (text: string) => void }) {
  const promo = useScript().data?.closingRules?.promo?.trim();
  if (!promo) return null;
  return (
    <Banner
      tone="brand"
      icon={Gift}
      testId="promo-banner"
      action={
        <Button size="sm" variant="outline" onClick={() => onInsert(promo)}>
          Ofrecer
        </Button>
      }
    >
      <b>Promo del día:</b> {promo}
    </Banner>
  );
}

interface ChatBannersProps {
  conversation: Conversation;
  windowOpen: boolean;
  canCall: boolean;
  /** Último mensaje del cliente. */
  lastInbound?: Pick<Message, "type">;
  onInsert: (text: string) => void;
}

/** Avisos sobre los mensajes, en el orden del mockup 152. */
export default function ChatBanners({ conversation, windowOpen, canCall, lastInbound, onInsert }: ChatBannersProps) {
  const open = conversation.status === "open";
  return (
    <>
      {open && lastInbound?.type === "comment" && <CommentBanner channel={conversation.channel} />}
      <LostBanner conversation={conversation} />
      <OrderBanner conversation={conversation} />
      {open && windowOpen && <WindowOpenBanner conversation={conversation} />}
      {open && !windowOpen && <WindowClosedBanner conversation={conversation} canCall={canCall} />}
      {open && windowOpen && <PromoBanner onInsert={onInsert} />}
    </>
  );
}
