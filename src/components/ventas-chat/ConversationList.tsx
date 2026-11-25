"use client";
import { useEffect, useState } from "react";
import { Clock, HelpCircle, Loader2, MessageCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import { NATIVE_SELECT_CLASS } from "./format";
import { useConversations, useInboxSummary } from "@/hooks/useCrmChat";
import { useCrmMe } from "@/hooks/useCrmMe";
import type { AssignedFilter, ConversationChannel, ConversationStatus } from "@/types/crm";
import ChannelBadge from "./ChannelBadge";
import ConversationPills from "./ConversationPills";
import { INDICATOR_PARAMS, type InboxIndicator } from "./InboxIndicators";
import { contactLabel, relativeTime } from "./format";
import { StoreBadge } from "./ChatHeader";
import { formatWait, initials, waitMinutes, waitTone } from "./conversationWait";
import { PresenceFlag, usePresenceViewers } from "./Presence";

export const CRM_UNREACHABLE = "No se pudo conectar con el servicio de chat";

const STATUS_OPTIONS: Array<{ value: ConversationStatus; label: string }> = [
  { value: "open", label: "Abiertas" },
  { value: "closed", label: "Cerradas" },
];
const ASSIGNED_OPTIONS: Array<{ value: AssignedFilter; label: string }> = [
  { value: "all", label: "Todas" },
  { value: "me", label: "Mías" },
  { value: "unassigned", label: "Sin asignar" },
];

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

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    // Chips del mockup 152: píldoras pequeñas, la elegida en teal.
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
            o.value === value
              ? "border-teal-600 bg-teal-50 text-teal-700 dark:border-teal-400 dark:bg-teal-950/40 dark:text-teal-300"
              : "bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
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
}

export default function ConversationList({
  selectedId,
  onSelect,
  indicator = null,
  onIndicatorChange,
  storeId,
}: Props) {
  const { phoneMasked, stores } = useCrmMe();
  const slaMinutes = useInboxSummary().data?.slaMinutes ?? 15;
  const storeName = (id?: string | null) => (id ? stores.find((st) => st.id === id)?.name : undefined);
  const [status, setStatus] = useState<ConversationStatus>("open");
  const [assigned, setAssigned] = useState<AssignedFilter>("all");
  const [channel, setChannel] = useState<ChannelFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Con un indicador activo, manda su filtro y la lista muestra solo chats abiertos.
  const extra = indicator ? INDICATOR_PARAMS[indicator] : {};
  const effStatus: ConversationStatus = indicator ? "open" : status;
  const effAssigned: AssignedFilter = extra.assigned ?? assigned;
  const clearIndicator = () => onIndicatorChange?.(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useConversations({
    ...extra,
    status: effStatus,
    assigned: effAssigned,
    search,
    ...(channel === "all" ? {} : channel === "comments" ? { comments: true } : { channel }),
    ...(storeId ? { storeId } : {}),
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
          placeholder="Buscar por nombre o teléfono"
          aria-label="Buscar conversación"
        />
        <Segmented
          label="Estado"
          options={STATUS_OPTIONS}
          value={effStatus}
          onChange={(v) => {
            clearIndicator();
            setStatus(v);
          }}
        />
        <Segmented
          label="Asignación"
          options={ASSIGNED_OPTIONS}
          value={effAssigned}
          onChange={(v) => {
            if (indicator === "unassigned") clearIndicator();
            setAssigned(v);
          }}
        />
        {/* Mockup 152: el canal es un selector, no una fila de botones. */}
        <select
          aria-label="Canal"
          value={channel}
          onChange={(e) => setChannel(e.target.value as ChannelFilter)}
          className={cn(NATIVE_SELECT_CLASS, "py-1.5 text-[13px]")}
        >
          {CHANNEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.value === "all" ? "Todos los canales" : o.label}
            </option>
          ))}
        </select>
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
