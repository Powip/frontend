"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BellPlus, Check, Megaphone, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCrmMe } from "@/hooks/useCrmMe";
import { useCrmSettings, useReassignConversation, useTeamMembers } from "@/hooks/useCrmTeam";
import { useUpdateConversation } from "@/hooks/useCrmChat";
import { usePipelines } from "@/hooks/useCrmPlanning";
import { useConversationAdSignal } from "@/hooks/useCrmMetaAds";
import { pipelineOf } from "@/lib/crmPipelines";
import type { Conversation, Stage } from "@/types/crm";
import ChannelBadge from "./ChannelBadge";
import { ChatCallButtons } from "./ChatCallsSection";
import { LostChatButton } from "./ChatPlanningSections";
import LostReasonDialog from "./LostReasonDialog";
import TaskDialog from "./TaskDialog";
import ThinkingButton from "./ThinkingButton";
import { initials } from "./conversationWait";
import { NATIVE_SELECT_CLASS, contactLabel, crearPedidoUrl, isMetaChannel, showPhone } from "./format";

/** Etiqueta corta de la tienda del chat (KUNCA, LIVII…). */
export function StoreBadge({ name, className }: { name: string; className?: string }) {
  return (
    <span
      data-testid="store-badge"
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-teal-200 bg-teal-50 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-teal-800 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-200",
        className,
      )}
    >
      {name}
    </span>
  );
}

/** Nombre de la tienda del chat según las tiendas del usuario; null si no hay. */
export function useStoreName(storeId: string | null | undefined): string | null {
  const { stores } = useCrmMe();
  if (!storeId) return null;
  return stores.find((s) => s.id === storeId)?.name ?? null;
}

/** Etapa en línea: al elegir «perdida» pide el motivo, como el botón «Perdido». */
function StageSelect({ conversation }: { conversation: Conversation }) {
  const { phoneMasked } = useCrmMe();
  const pipelines = usePipelines();
  const update = useUpdateConversation(conversation.id);
  const [lost, setLost] = useState<Stage | null>(null);
  const pipeline = pipelineOf(pipelines.data, conversation);
  if (!pipeline) return null;
  const current = pipeline.stages.find((s) => s.id === conversation.stageId);
  const change = (stageId: string) => {
    const stage = pipeline.stages.find((s) => s.id === stageId);
    if (!stage || stage.id === conversation.stageId) return;
    if (stage.kind === "lost") setLost(stage);
    else update.mutate({ stageId: stage.id });
  };
  return (
    <label className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <span className="hidden shrink-0 2xl:inline">Etapa</span>
      <select
        aria-label="Etapa del chat"
        className={cn(NATIVE_SELECT_CLASS, "h-8 w-32 text-xs")}
        value={current?.id ?? ""}
        disabled={update.isPending}
        onChange={(e) => change(e.target.value)}
      >
        {!current && (
          <option value="" disabled>
            Sin etapa
          </option>
        )}
        {pipeline.stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {lost && (
        <LostReasonDialog
          open
          contact={contactLabel(conversation, phoneMasked)}
          onCancel={() => setLost(null)}
          onConfirm={(lostReason) => {
            update.mutate({ stageId: lost.id, lostReason });
            setLost(null);
          }}
        />
      )}
    </label>
  );
}

/** Vendedora en línea (supervisor y administrador). */
function SellerSelect({ conversation }: { conversation: Conversation }) {
  const members = useTeamMembers();
  const reassign = useReassignConversation();
  const update = useUpdateConversation(conversation.id);
  const people = members.data ?? [];
  const current = conversation.assignedUserId ?? "";
  const known = !current || people.some((p) => p.userId === current);
  return (
    <label className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <span className="hidden shrink-0 2xl:inline">Vendedora</span>
      <select
        aria-label="Vendedora del chat"
        className={cn(NATIVE_SELECT_CLASS, "h-8 w-32 text-xs")}
        value={current}
        disabled={reassign.isPending || update.isPending}
        onChange={(e) => {
          const id = e.target.value;
          if (!id) return update.mutate({ assignedUserId: null });
          const person = people.find((p) => p.userId === id);
          if (person) reassign.mutate({ id: conversation.id, person });
        }}
      >
        <option value="">Sin asignar</option>
        {!known && (
          <option value={current}>{conversation.assignedUserName?.split("@")[0] ?? "Otra persona"}</option>
        )}
        {people.map((p) => (
          <option key={p.userId} value={p.userId}>
            {p.userName.split("@")[0]}
          </option>
        ))}
      </select>
    </label>
  );
}

/** «Meta: ✓ Lead · Venta»: si el chat vino de un anuncio y si ya se informó una compra. */
function AdOrigin({ conversationId }: { conversationId: string }) {
  const { data } = useConversationAdSignal(conversationId);
  if (!data?.fromAd) return null;
  const sold = data.purchases.some((p) => p.status === "sent");
  return (
    <span className="inline-flex min-w-0 items-center gap-1" data-testid="chat-ad-origin">
      <Megaphone className="h-3 w-3 shrink-0" aria-hidden />
      <span className="truncate">{data.ad?.headline || data.ad?.sourceId || "Anuncio"}</span>
      <span className="shrink-0 text-teal-700 dark:text-teal-300">
        · Meta: <Check className="inline h-3 w-3" aria-hidden /> Lead{sold ? " · Venta" : ""}
      </span>
    </span>
  );
}

/**
 * Cabecera compacta del chat (mockup 152): fila 1 con cliente, tienda, origen y acciones
 * principales; fila 2 con Etapa y Vendedora en línea y acciones secundarias como íconos.
 */
export default function ChatHeader({
  conversation,
  onBack,
  onOpenPanel,
  panelButtonClassName = "xl:hidden",
}: {
  conversation: Conversation;
  onBack: () => void;
  onOpenPanel: () => void;
  /** Dónde se oculta el botón del panel (cuando el panel ya se ve en pantalla). */
  panelButtonClassName?: string;
}) {
  const router = useRouter();
  const { auth } = useAuth();
  const me = { id: auth?.user.id };
  const { isAdmin, isSupervisor, phoneMasked } = useCrmMe();
  const adminSettings = useCrmSettings(isAdmin);
  const update = useUpdateConversation(conversation.id);
  const storeName = useStoreName(conversation.storeId);
  const [reminder, setReminder] = useState(false);
  const closed = conversation.status === "closed";
  const mine = !!me.id && conversation.assignedUserId === me.id;
  const name = contactLabel(conversation, phoneMasked);
  const phone = isMetaChannel(conversation)
    ? (showPhone(conversation.customerPhone, phoneMasked) ?? "Sin teléfono")
    : showPhone(conversation.contactPhone, phoneMasked);

  return (
    <header className="space-y-1.5 border-b px-3 py-2" data-testid="chat-header">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onBack} aria-label="Volver a la lista">
          <ArrowLeft />
        </Button>
        <span
          aria-hidden
          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-800 dark:bg-teal-900 dark:text-teal-100"
        >
          {initials(name)}
        </span>
        <div className="min-w-[10rem] flex-1">
          <h2 className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
            <span className="min-w-0 break-words sm:truncate">{name}</span>
            <ChannelBadge channel={conversation.channel} />
            {storeName && <StoreBadge name={storeName} />}
          </h2>
          <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span className="break-words sm:truncate">
              {phone}
              {isAdmin && adminSettings.data?.maskPhone ? " · Las vendedoras ven el número oculto" : ""}
              {conversation.assignedUserName
                ? ` · Asignada a ${conversation.assignedUserName.split("@")[0]}`
                : " · Sin asignar"}
            </span>
            <AdOrigin conversationId={conversation.id} />
          </p>
        </div>
        {!closed && (
          <Button size="sm" onClick={() => router.push(crearPedidoUrl(conversation))}>
            <Check /> Cerrar venta
          </Button>
        )}
        <ChatCallButtons conversation={conversation} compact />
        <Button
          size="icon-sm"
          variant="outline"
          className={panelButtonClassName}
          aria-label="Cliente y pedido"
          onClick={onOpenPanel}
        >
          <PanelRight />
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={update.isPending}
          onClick={() => update.mutate({ status: closed ? "open" : "closed" })}
        >
          {closed ? "Reabrir" : "Cerrar chat"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StageSelect conversation={conversation} />
        {isSupervisor && <SellerSelect conversation={conversation} />}
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          disabled={update.isPending || !me.id}
          onClick={() => update.mutate({ assignedUserId: mine ? null : (me.id ?? null) })}
        >
          {mine ? "Soltar" : "Tomar"}
        </Button>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="icon-sm"
            variant="outline"
            aria-label="Recordatorio"
            title="Recordatorio"
            onClick={() => setReminder(true)}
          >
            <BellPlus />
          </Button>
          <ThinkingButton conversation={conversation} compact />
          {!closed && <LostChatButton conversation={conversation} compact />}
        </div>
      </div>
      {reminder && (
        <TaskDialog
          open
          conversationId={conversation.id}
          contact={name}
          onOpenChange={(o) => !o && setReminder(false)}
        />
      )}
    </header>
  );
}
