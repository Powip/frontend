"use client";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpdateConversation } from "@/hooks/useCrmChat";
import { useAuth } from "@/contexts/AuthContext";
import { beatPresence, getPresence } from "@/services/crmAjustesEService";
import type { Conversation } from "@/types/crm";
import type { PresenceViewer } from "@/types/crmAjustesE";

/** El servidor olvida una vista a los 45 s; avisamos cada 20 s. */
export const PRESENCE_BEAT_MS = 20_000;
const PRESENCE_POLL_MS = 15_000;

export const presenceKey = (ids: string[]) => ["crm", "presence", [...ids].sort().join(",")] as const;

/** Mientras el chat está abierto, avisa que esta persona lo está viendo. */
export function usePresenceBeat(conversationId: string | null | undefined) {
  useEffect(() => {
    if (!conversationId) return;
    const beat = () => beatPresence(conversationId).catch(() => undefined);
    beat();
    const t = setInterval(beat, PRESENCE_BEAT_MS);
    return () => clearInterval(t);
  }, [conversationId]);
}

/** Quién más está viendo cada chat (sin incluirme). Vacío si la empresa apagó la presencia. */
export function usePresenceViewers(conversationIds: string[]): Record<string, PresenceViewer[]> {
  const ids = conversationIds.slice(0, 100);
  const q = useQuery({
    queryKey: presenceKey(ids),
    queryFn: () => getPresence(ids),
    enabled: ids.length > 0,
    refetchInterval: PRESENCE_POLL_MS,
    retry: false,
    staleTime: 10_000,
  });
  return q.data?.enabled ? q.data.viewers : {};
}

/** Primer nombre; si el equipo no tiene nombre cargado y llega un correo, solo lo de antes de la @. */
const firstName = (name: string) => {
  const n = name.trim();
  return (n.includes("@") ? n.split("@")[0] : n.split(/\s+/)[0]) || n;
};

export function presenceNames(viewers: PresenceViewer[]): string {
  const names = viewers.map((v) => firstName(v.userName));
  return names.length <= 2 ? names.join(" y ") : `${names[0]} y ${names.length - 1} más`;
}

/** Insignia en la lista de la Bandeja (mockup 152: «Ana también lo ve»). */
export function PresenceFlag({ viewers }: { viewers?: PresenceViewer[] }) {
  if (!viewers?.length) return null;
  return (
    <span
      className="flex items-center gap-1 text-[11px] font-medium text-red-700 dark:text-red-400"
      title={viewers.map((v) => v.userName).join(", ")}
      data-testid="presence-flag"
    >
      <Eye className="h-3 w-3" aria-hidden /> {presenceNames(viewers)} también lo ve
    </span>
  );
}

/** Aviso en el chat abierto: otra persona del equipo está en este chat. */
export function PresenceBanner({ conversation }: { conversation: Conversation }) {
  const { auth } = useAuth();
  const myId = auth?.user.id;
  usePresenceBeat(conversation.id);
  const viewers = usePresenceViewers([conversation.id])[conversation.id];
  const update = useUpdateConversation(conversation.id);
  if (!viewers?.length) return null;
  const mine = !!myId && conversation.assignedUserId === myId;
  const owner = conversation.assignedUserName ? firstName(conversation.assignedUserName) : null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
      data-testid="presence-banner"
    >
      <Eye className="h-4 w-4 shrink-0" aria-hidden />
      <span className="grow">
        <b>{presenceNames(viewers)}</b> también está viendo este chat.
        {owner ? ` Responde solo ${mine ? "tú" : owner} para no duplicar mensajes.` : " Tómalo antes de responder para no duplicar mensajes."}
      </span>
      {!mine && myId && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={update.isPending}
          onClick={() => update.mutate({ assignedUserId: myId })}
        >
          Tomar el chat
        </Button>
      )}
    </div>
  );
}
