"use client";
import { useEffect, useState } from "react";
import { Clock, HelpCircle, Loader2, MessageCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { crmError } from "@/services/crmService";
import { useConversations } from "@/hooks/useCrmChat";
import type { AssignedFilter, ConversationChannel, ConversationStatus } from "@/types/crm";
import ChannelBadge from "./ChannelBadge";
import { INDICATOR_PARAMS, type InboxIndicator } from "./InboxIndicators";
import { contactLabel, relativeTime } from "./format";

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

const CHANNEL_OPTIONS: Array<{ value: ConversationChannel | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "messenger", label: "Messenger" },
  { value: "instagram", label: "Instagram" },
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
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {options.map((o) => (
        <Button
          key={o.value}
          type="button"
          size="sm"
          variant={o.value === value ? "default" : "outline"}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </Button>
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
}

export default function ConversationList({
  selectedId,
  onSelect,
  indicator = null,
  onIndicatorChange,
}: Props) {
  const [status, setStatus] = useState<ConversationStatus>("open");
  const [assigned, setAssigned] = useState<AssignedFilter>("all");
  const [channel, setChannel] = useState<ConversationChannel | "all">("all");
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
    ...(channel === "all" ? {} : { channel }),
  });

  const items = data?.items ?? [];
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
        <Segmented label="Canal" options={CHANNEL_OPTIONS} value={channel} onChange={setChannel} />
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
          {items.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                aria-current={c.id === selectedId ? "true" : undefined}
                className={cn(
                  "flex w-full flex-col gap-1 border-b px-3 py-3 text-left transition-colors hover:bg-accent/50",
                  c.id === selectedId && "bg-accent",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={cn("truncate text-sm", c.unreadCount > 0 ? "font-semibold" : "font-medium")}>
                      {contactLabel(c)}
                    </span>
                    <ChannelBadge channel={c.channel} />
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {relativeTime(c.lastMessageAt)}
                  </span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">
                    {c.lastMessageDirection === "out" ? "Tú: " : ""}
                    {c.lastMessagePreview ?? "Sin mensajes"}
                  </span>
                  {c.unreadCount > 0 && (
                    <span
                      aria-label={`${c.unreadCount} sin leer`}
                      className="min-w-5 shrink-0 rounded-full bg-primary px-1.5 text-center text-xs font-medium text-primary-foreground"
                    >
                      {c.unreadCount}
                    </span>
                  )}
                </span>
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
                    className="flex items-center gap-1 text-[11px] font-medium text-sky-700 dark:text-sky-400"
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
                    Asignada a {c.assignedUserName}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
