"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  listWhatsAppNotifications,
  markAllWhatsAppNotificationsRead,
  markWhatsAppNotificationRead,
  type WhatsAppInAppNotification as WhatsAppNotificationDto,
} from "@/features/whatsapp/api/settings-ops.api";
import type { WhatsAppAlertType } from "@/features/whatsapp/enums/whatsapp.enums";
import type { WhatsAppResourceState } from "@/features/whatsapp/models/resource-state.model";
import {
  WhatsAppNotificationsButton,
  type WhatsAppNotificationsFeed,
} from "./WhatsAppNotificationsPanel";

/** Cada minuto: las alertas (calidad, plantilla rechazada, fallos) no necesitan tiempo real. */
const POLL_MS = 60_000;
export const WHATSAPP_NOTIFICATIONS_QUERY_KEY = ["whatsapp-notifications"] as const;

/** Pestaña de WhatsApp a la que apunta el enlace de la alerta (`/configuracion/whatsapp?tab=…`). */
export function relatedTabFromLink(link: string | null): string | null {
  if (!link) return null;
  try {
    return new URL(link, "http://powip.local").searchParams.get("tab");
  } catch {
    return null;
  }
}

/** Convierte la respuesta de C-31 al formato de la lista de la campanita. */
export function toWhatsAppNotificationsFeed(data: {
  items: WhatsAppNotificationDto[];
  unreadCount: number;
}): WhatsAppNotificationsFeed {
  const items = Array.isArray(data.items) ? data.items : [];
  return {
    items: items.map((item) => ({
      id: item.id,
      type: item.type as WhatsAppAlertType,
      message: item.body ? `${item.title}. ${item.body}` : item.title,
      createdAt: item.createdAt,
      relatedTab: relatedTabFromLink(item.link),
      readAt: item.read ? item.createdAt : null,
    })),
    unreadTotal: typeof data.unreadCount === "number" ? data.unreadCount : null,
  };
}

function errorMessage(caught: unknown): string {
  return caught instanceof Error && caught.message ? caught.message : "Error desconocido.";
}

/** Campanita de POWIP con las alertas de WhatsApp (X5, C-31). Solo se monta para administradores. */
export function WhatsAppNotificationsBell() {
  const [now, setNow] = useState(() => new Date());
  const query = useQuery({
    queryKey: WHATSAPP_NOTIFICATIONS_QUERY_KEY,
    queryFn: listWhatsAppNotifications,
    refetchInterval: POLL_MS,
    staleTime: 30_000,
    retry: 1,
  });

  useEffect(() => {
    if (query.dataUpdatedAt) setNow(new Date(query.dataUpdatedAt));
  }, [query.dataUpdatedAt]);


  const feed: WhatsAppResourceState<WhatsAppNotificationsFeed> = query.data
    ? { kind: "ready", data: toWhatsAppNotificationsFeed(query.data) }
    : query.isError
      ? { kind: "error", message: errorMessage(query.error) }
      : { kind: "loading" };

  return (
    <WhatsAppNotificationsButton
      feed={feed}
      now={now}
      onRetry={() => void query.refetch()}
      onMarkAllRead={async () => {
        await markAllWhatsAppNotificationsRead();
        await query.refetch();
      }}
      onItemOpen={(id) => {
        markWhatsAppNotificationRead(id)
          .then(() => query.refetch())
          .catch(() => undefined);
      }}
    />
  );
}
