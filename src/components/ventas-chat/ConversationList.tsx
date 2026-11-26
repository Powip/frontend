"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, HelpCircle, Loader2, MessageCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import { NATIVE_SELECT_CLASS } from "./format";
import { useConversations, useInboxFilters, useInboxSummary } from "@/hooks/useCrmChat";
import { useCrmMe } from "@/hooks/useCrmMe";
import { usePauLearning } from "@/hooks/useCrmPauLearning";
import type { AssignedFilter, ConversationChannel, ConversationStatus } from "@/types/crm";
import ChannelBadge from "./ChannelBadge";
import CodNote from "./CodNote";
import ConversationPills from "./ConversationPills";
import { INDICATOR_PARAMS, type InboxIndicator } from "./InboxIndicators";
import { contactLabel, relativeTime } from "./format";
import { StoreBadge } from "./ChatHeader";
import { formatWait, initials, waitMinutes, waitTone } from "./conversationWait";
import { PresenceFlag, usePresenceViewers } from "./Presence";

export const CRM_UNREACHABLE = "No se pudo conectar con el servicio de chat";

/** «Comentarios» filtra chats que nacieron de un comentario en Facebook o Instagram. */
type ChannelFilter = ConversationChannel | "all" | "comments";

const CHANNEL_OPTIONS: Array<{ value: ChannelFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "messenger", label: "Messenger" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "comments", label: "Comentarios" },
];

/** Chips de la lista (mockup 152): cada uno filtra y muestra su contador. */
type ListChip = "open" | "payments" | InboxIndicator | "learned" | "closed";

const CHIPS: Array<{ key: ListChip; label: string; tone?: "red" | "pur" }> = [
  { key: "open", label: "Abiertos" },
  { key: "payments", label: "Pagos" },
  { key: "unanswered", label: "Sin responder" },
  { key: "overSla", label: "Fuera de tiempo", tone: "red" },
  { key: "unassigned", label: "Sin asignar" },
  { key: "pauHelp", label: "Pau necesita ayuda", tone: "pur" },
  { key: "learned", label: "Pau aprendió esto", tone: "pur" },
  { key: "thinking", label: "Lo están pensando" },
  { key: "closed", label: "Cerrados" },
];

const INDICATOR_KEYS: ReadonlySet<ListChip> = new Set<InboxIndicator>([
  "unanswered",
  "overSla",
  "unassigned",
  "pauHelp",
  "thinking",
]);

/** Contador seguro: lo que no sea un número se muestra como 0. */
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

function chipClass(on: boolean, tone?: "red" | "pur") {
  return cn(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
    tone === "pur" && "border-primary/35",
    !on && "bg-card text-muted-foreground hover:text-foreground",
    on && !tone && "border-teal-600 bg-teal-50 text-teal-700 dark:border-teal-400 dark:bg-teal-950/40 dark:text-teal-300",
    on && tone === "red" && "border-red-600 bg-red-50 text-red-700 dark:border-red-400 dark:bg-red-950/40 dark:text-red-300",
    on && tone === "pur" && "bg-primary/10 text-primary",
  );
}

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Indicador activo (filtro de la franja de la Bandeja). */
  indicator?: InboxIndicator | null;
  onIndicatorChange?: (next: InboxIndicator | null) => void;
  /** Tienda elegida en la Bandeja; sin valor = todas. */
  storeId?: string;
  /** Cambia la tienda (el selector vive en la lista, como en el mockup). */
  onStoreChange?: (storeId: string) => void;
}

export default function ConversationList({
  selectedId,
  onSelect,
  indicator = null,
  onIndicatorChange,
  storeId,
  onStoreChange,
}: Props) {
  const router = useRouter();
  const { phoneMasked, stores, isSupervisor, level } = useCrmMe();
  const isAgent = level === "agent";
  const summary = useInboxSummary(storeId).data;
  const slaMinutes = summary?.slaMinutes ?? 15;
  // «Pau aprendió esto» = respuestas por aprobar; solo quien aprueba ve el chip.
  const learnedPending = usePauLearning(isSupervisor).data?.pending.length ?? 0;
  const storeName = (id?: string | null) => (id ? stores.find((st) => st.id === id)?.name : undefined);
  const [base, setBase] = useState<"open" | "payments" | "closed">("open");
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  // Varios números por tienda: la vendedora ve por defecto sus chats; el jefe ve todo y filtra.
  const [agentScope, setAgentScope] = useState<"mine" | "all">("mine");
  const [numberId, setNumberId] = useState("");
  const [sellerId, setSellerId] = useState("");
  const filters = useInboxFilters(storeId).data;
  const numbers = filters?.numbers ?? [];
  const sellers = filters?.sellers ?? [];
  const manyNumbers = numbers.length > 1;
  const effNumberId = numbers.some((n) => n.channelAccountId === numberId) ? numberId : "";
  const effSellerId = isSupervisor && sellers.some((s) => s.userId === sellerId) ? sellerId : "";

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Con un indicador activo, manda su filtro y la lista muestra solo chats abiertos.
  const extra = indicator ? INDICATOR_PARAMS[indicator] : {};
  const effStatus: ConversationStatus = indicator || base !== "closed" ? "open" : "closed";
  const effAssigned: AssignedFilter =
    extra.assigned ?? (isAgent && agentScope === "mine" ? "me" : "all");
  const active: ListChip = indicator ?? base;
  const counts: Record<ListChip, number | undefined> = {
    open: summary?.open,
    payments: summary?.payments,
    unanswered: summary?.unanswered,
    overSla: summary?.overSla,
    unassigned: summary?.unassigned,
    pauHelp: summary?.pauHelp,
    learned: learnedPending,
    thinking: summary?.thinking,
    closed: summary?.closed,
  };
  const pick = (key: ListChip) => {
    if (key === "learned") {
      router.push("/comercial/ventas-chat/pau?tab=apr");
      return;
    }
    if (INDICATOR_KEYS.has(key)) {
      onIndicatorChange?.(key as InboxIndicator);
      return;
    }
    onIndicatorChange?.(null);
    setBase(key as "open" | "payments" | "closed");
  };

  const { data, isLoading, isError, error, refetch, isFetching } = useConversations({
    ...extra,
    status: effStatus,
    assigned: effAssigned,
    ...(!indicator && base === "payments" ? { payments: true } : {}),
    search,
    ...(channel === "all" ? {} : channel === "comments" ? { comments: true } : { channel }),
    ...(storeId ? { storeId } : {}),
    ...(effNumberId ? { channelAccountId: effNumberId } : {}),
    ...(effSellerId ? { assignedUserId: effSellerId } : {}),
  });

  const items = data?.items ?? [];
  const viewers = usePresenceViewers(items.map((c) => c.id));
  const err = isError ? crmError(error) : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b p-3">
        <Input
          icon={Search}
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar cliente o teléfono"
          aria-label="Buscar conversación"
        />
        {/* Mockup 152: tienda y canal en selectores, uno al lado del otro. */}
        <div className="flex gap-2">
          {stores.length > 1 && onStoreChange && (
            <select
              aria-label="Tienda"
              value={storeId ?? ""}
              onChange={(e) => onStoreChange(e.target.value)}
              className={cn(NATIVE_SELECT_CLASS, "min-w-0 flex-1 py-1.5 text-[13px]")}
            >
              <option value="">Todas las tiendas</option>
              {stores.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Canal"
            value={channel}
            onChange={(e) => setChannel(e.target.value as ChannelFilter)}
            className={cn(NATIVE_SELECT_CLASS, "min-w-0 flex-1 py-1.5 text-[13px]")}
          >
            {CHANNEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value === "all" ? "Todos los canales" : o.label}
              </option>
            ))}
          </select>
        </div>
        {(isAgent || manyNumbers || (isSupervisor && sellers.length > 0)) && (
          <div className="flex gap-2" data-testid="number-filters">
            {isAgent && (
              <select
                aria-label="Ver chats"
                value={agentScope}
                onChange={(e) => setAgentScope(e.target.value as "mine" | "all")}
                className={cn(NATIVE_SELECT_CLASS, "min-w-0 flex-1 py-1.5 text-[13px]")}
              >
                <option value="mine">Mis chats</option>
                <option value="all">Todos los chats</option>
              </select>
            )}
            {manyNumbers && (
              <select
                aria-label="Número"
                value={effNumberId}
                onChange={(e) => setNumberId(e.target.value)}
                className={cn(NATIVE_SELECT_CLASS, "min-w-0 flex-1 py-1.5 text-[13px]")}
              >
                <option value="">Todos los números</option>
                {numbers.map((n) => (
                  <option key={n.channelAccountId} value={n.channelAccountId}>
                    {n.businessPhone ?? "Número sin dato"}
                  </option>
                ))}
              </select>
            )}
            {isSupervisor && sellers.length > 0 && (
              <select
                aria-label="Vendedora"
                value={effSellerId}
                onChange={(e) => setSellerId(e.target.value)}
                className={cn(NATIVE_SELECT_CLASS, "min-w-0 flex-1 py-1.5 text-[13px]")}
              >
                <option value="">Todas las vendedoras</option>
                {sellers.map((s) => (
                  <option key={s.userId} value={s.userId}>
                    {(s.name ?? "Sin nombre").split("@")[0]}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        {/* B5: aviso de pedidos COD que van a Gestión CC (dato de ms-ventas). */}
        <CodNote storeIds={storeId ? [storeId] : stores.map((st) => st.id)} />
        <div role="group" aria-label="Filtros" className="flex flex-wrap gap-1">
          {CHIPS.filter((c) => c.key !== "learned" || isSupervisor).map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={c.key === active}
              onClick={() => pick(c.key)}
              className={chipClass(c.key === active, c.tone)}
            >
              {c.label}
              <span className="ml-1 font-bold tabular-nums">{num(counts[c.key])}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" aria-busy={isFetching}>
        {isLoading && (
          <p role="status" className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando conversaciones…
          </p>
        )}

        {err && (
          <div role="alert" className="space-y-2 p-4 text-sm">
            <p className="font-medium text-destructive">
              {err.unreachable ? CRM_UNREACHABLE : err.message}
            </p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        )}

        {!isLoading && !err && items.length === 0 && (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <MessageCircle className="h-8 w-8" />
            <p>No hay conversaciones con estos filtros.</p>
          </div>
        )}

        <ul>
          {items.map((c) => {
            const wait = c.status === "open" ? waitMinutes(c) : null;
            const tone = waitTone(wait, slaMinutes);
            const store = storeName(c.storeId);
            return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                aria-current={c.id === selectedId ? "true" : undefined}
                data-wait={tone ?? undefined}
                className={cn(
                  "grid w-full grid-cols-[2.25rem_minmax(0,1fr)_auto] gap-x-2.5 border-b border-l-[3px] border-l-transparent px-3 py-2.5 text-left transition-colors hover:bg-accent/50",
                  c.id === selectedId && "border-l-primary bg-accent",
                  tone === "bad" && "border-l-red-500 bg-red-50/60 dark:bg-red-950/20",
                  tone === "warn" && c.id !== selectedId && "border-l-amber-400",
                )}
              >
                <span
                  aria-hidden
                  className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-800 dark:bg-teal-900 dark:text-teal-100"
                >
                  {initials(contactLabel(c, phoneMasked))}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={cn("truncate text-sm", c.unreadCount > 0 ? "font-semibold" : "font-medium")}>
                      {contactLabel(c, phoneMasked)}
                    </span>
                    <ChannelBadge channel={c.channel} />
                  </span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">
                    {c.lastMessageDirection === "out" ? "Tú: " : ""}
                    {c.lastMessagePreview ?? "Sin mensajes"}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  <ConversationPills conversation={c} />
                  {store && <StoreBadge name={store} />}
                  {manyNumbers && c.businessPhone && (
                    <span
                      data-testid="conv-number"
                      title="Número de la tienda"
                      className="rounded-full border border-primary/30 bg-primary/5 px-1.5 text-[10px] font-medium text-primary"
                    >
                      {c.businessPhone}
                    </span>
                  )}
                </span>
                <PresenceFlag viewers={viewers[c.id]} />
                {c.pauHelpReason && (
                  <span
                    className="flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400"
                    title={c.pauHelpReason}
                    data-testid="pau-help-flag"
                  >
                    <HelpCircle className="h-3 w-3" aria-hidden /> Pau pidió ayuda
                  </span>
                )}
                {c.resumeAt && (
                  <span
                    className="flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400"
                    data-testid="thinking-flag"
                  >
                    <Clock className="h-3 w-3" aria-hidden /> Lo está pensando
                  </span>
                )}
                {(c.tags ?? []).length > 0 && (
                  <span className="flex flex-wrap gap-1" data-testid="conv-tags">
                    {(c.tags ?? []).slice(0, 2).map((t) => (
                      <span key={t} className="rounded-full border px-1.5 text-[10px] text-muted-foreground">
                        {t}
                      </span>
                    ))}
                  </span>
                )}
                {c.assignedUserName && (
                  <span className="text-[11px] text-muted-foreground">
                    {/* Si el nombre es un correo, solo la parte antes de @ (el mockup muestra nombres). */}
                    Asignada a {c.assignedUserName.split("@")[0]}
                  </span>
                )}
                </span>
                <span className="flex flex-col items-end gap-1 text-[11px] text-muted-foreground">
                  {wait != null && tone ? (
                    <span
                      data-testid="wait-pill"
                      title="Minutos esperando respuesta"
                      className={cn(
                        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-1.5 py-px font-bold",
                        tone === "ok" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
                        tone === "warn" && "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
                        tone === "bad" && "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
                      )}
                    >
                      <Clock className="h-3 w-3" aria-hidden /> {formatWait(wait)}
                    </span>
                  ) : (
                    <span className="whitespace-nowrap">{relativeTime(c.lastMessageAt)}</span>
                  )}
                  {c.unreadCount > 0 && (
                    <span
                      aria-label={`${c.unreadCount} sin leer`}
                      className="min-w-5 shrink-0 rounded-full bg-primary px-1.5 text-center text-xs font-medium text-primary-foreground"
                    >
                      {c.unreadCount}
                    </span>
                  )}
                  <span
                    title={c.assignedUserName ? c.assignedUserName.split("@")[0] : "Sin asignar"}
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold",
                      c.assignedUserName ? "bg-muted text-foreground" : "border border-dashed",
                    )}
                    aria-hidden
                  >
                    {c.assignedUserName ? initials(c.assignedUserName.split("@")[0]) : "?"}
                  </span>
                </span>
              </button>
            </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
