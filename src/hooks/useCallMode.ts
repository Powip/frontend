"use client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { requestWhatsAppCall } from "@/components/ventas-chat/WhatsAppCallOverlay";
import { callSessionKeys } from "@/hooks/useCallSessions";
import { getCallPermission } from "@/services/crmCallSessionsService";
import type { CallPermissionState } from "@/types/crmCallSessions";

export interface CallModeItem {
  conversationId: string | null;
  contactName: string | null;
}

/**
 * Modo llamadas: llama al primer cliente de la cola que aceptó llamadas y, al
 * guardar el resultado, pasa al siguiente.
 */
export function useCallMode() {
  const qc = useQueryClient();

  const permission = async (conversationId: string): Promise<CallPermissionState | null> => {
    try {
      return await qc.fetchQuery({
        queryKey: callSessionKeys.permission(conversationId),
        queryFn: () => getCallPermission(conversationId),
        retry: false,
      });
    } catch {
      return null;
    }
  };

  /** `false` si ningún cliente de la lista aceptó llamadas. */
  const callNext = async (items: CallModeItem[]): Promise<boolean> => {
    for (const [i, { conversationId, contactName }] of items.entries()) {
      const state = conversationId ? await permission(conversationId) : null;
      if (!conversationId || !state?.canCall) continue;
      requestWhatsAppCall({
        kind: "call",
        conversationId,
        contactName,
        start: { simulated: state.simulated },
        queueMode: true,
        onSaved: async (next) => {
          if (next && !(await callNext(items.slice(i + 1)))) {
            toast.success("Terminaste tu cola de llamadas 🎉");
          }
        },
      });
      return true;
    }
    return false;
  };

  return async (items: CallModeItem[]) => {
    if (items.length === 0) {
      toast.error("No hay llamadas pendientes en la cola");
    } else if (!(await callNext(items))) {
      toast.error("Ningún cliente de la cola aceptó llamadas todavía.");
    }
  };
}
