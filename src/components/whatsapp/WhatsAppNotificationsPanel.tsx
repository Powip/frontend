"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WHATSAPP_TAB_DEFINITIONS } from "@/features/whatsapp/constants/whatsapp-tabs";
import type { WhatsAppResourceState as ResourceState } from "@/features/whatsapp/models/resource-state.model";
import type { WhatsAppRecentAlert } from "@/features/whatsapp/models/settings-tab.model";
import { formatLimaDayLabel, formatLimaTime } from "@/features/whatsapp/utils/lima-time.util";
import { parseWhatsAppTab } from "@/features/whatsapp/utils/whatsapp-tab.util";
import { cn } from "@/lib/utils";
import { BlockedActionButton } from "./BlockedActionButton";
import { WhatsAppResourceState } from "./WhatsAppResourceState";

export interface WhatsAppInAppNotification extends WhatsAppRecentAlert {
  readAt: Date | null;
}

export interface WhatsAppNotificationsFeed {
  items: WhatsAppInAppNotification[];
  unreadTotal: number | null;
}

const NOTIFICATIONS_PENDING_REASON =
  "Pendiente de integración: las notificaciones dentro de POWIP todavía no existen. No se marcó nada como leído.";

const TAB_LABELS = new Map(WHATSAPP_TAB_DEFINITIONS.map((tab) => [tab.key, tab.label]));

export function buildWhatsAppTabHref(relatedTab: string | null): string | null {
  const tab = parseWhatsAppTab(relatedTab);
  return tab ? `/configuracion/whatsapp?tab=${tab}` : null;
}

interface WhatsAppNotificationsListProps {
  feed: ResourceState<WhatsAppNotificationsFeed>;
  now: Date;
  onMarkAllRead?: () => Promise<void>;
  onRetry?: () => void;
}

export function WhatsAppNotificationsList({
  feed,
  now,
  onMarkAllRead,
  onRetry,
}: WhatsAppNotificationsListProps) {
  const reasonId = useId();
  const [state, setState] = useState<
    { kind: "idle" | "pending" } | { kind: "error"; message: string }
  >({
    kind: "idle",
  });

  const markAll = async () => {
    if (!onMarkAllRead || state.kind === "pending") return;
    setState({ kind: "pending" });
    try {
      await onMarkAllRead();
      setState({ kind: "idle" });
    } catch (caught) {
      setState({
        kind: "error",
        message: caught instanceof Error && caught.message ? caught.message : "No se pudo marcar.",
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Alertas de WhatsApp</h2>
        {feed.kind === "ready" && feed.data.items.length > 0 && (
          <BlockedActionButton
            variant="ghost"
            size="sm"
            blocked={!onMarkAllRead || state.kind === "pending"}
            blockedReasonId={reasonId}
            onClick={markAll}
          >
            Marcar todo como leído
          </BlockedActionButton>
        )}
      </div>
      {feed.kind === "ready" && feed.data.items.length > 0 && !onMarkAllRead && (
        <p id={reasonId} className="text-xs text-muted-foreground">
          {NOTIFICATIONS_PENDING_REASON}
        </p>
      )}
      {state.kind === "error" && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-300">
          {state.message}
        </p>
      )}
      <WhatsAppResourceState
        state={feed}
        pendingTitle="Notificaciones pendientes de integración"
        pendingDescription="Las alertas de WhatsApp aparecerán aquí cuando exista la campanita de POWIP."
        loadingLabel="Cargando alertas"
        errorTitle="No se pudieron cargar las alertas"
        onRetry={onRetry}
        isEmpty={(data) => data.items.length === 0}
        empty={<p className="text-sm text-muted-foreground">No hay alertas de WhatsApp.</p>}
      >
        {(data) => (
          <ul className="divide-y rounded-lg border">
            {data.items.map((item) => {
              const href = buildWhatsAppTabHref(item.relatedTab);
              const tab = parseWhatsAppTab(item.relatedTab);
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-2 p-3 text-sm"
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block [overflow-wrap:anywhere]",
                        !item.readAt && "font-medium",
                      )}
                    >
                      {!item.readAt && <span className="sr-only">Sin leer: </span>}
                      {item.message}
                    </span>
                    <time
                      className="text-xs text-muted-foreground"
                      dateTime={item.createdAt.toISOString()}
                    >
                      {formatLimaDayLabel(item.createdAt, now)} {formatLimaTime(item.createdAt)}
                    </time>
                  </span>
                  {href && tab ? (
                    <Link
                      href={href}
                      className="shrink-0 text-sm font-medium text-primary hover:underline"
                    >
                      Ver
                      <span className="sr-only"> en {TAB_LABELS.get(tab)}</span>
                    </Link>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin pestaña relacionada</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </WhatsAppResourceState>
    </div>
  );
}

export function WhatsAppNotificationsButton(props: WhatsAppNotificationsListProps) {
  const unread = props.feed.kind === "ready" ? props.feed.data.unreadTotal : null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">
            Alertas de WhatsApp{unread !== null ? `, ${unread} sin leer` : ""}
          </span>
          {unread !== null && unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white"
            >
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))]">
        <WhatsAppNotificationsList {...props} />
      </PopoverContent>
    </Popover>
  );
}
