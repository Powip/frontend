"use client";

import { createContext, useContext } from "react";
import { WHATSAPP_QUICK_REPLIES } from "@/features/whatsapp/constants/whatsapp-conversation-catalog";
import type { WhatsAppQuickReply } from "@/features/whatsapp/models/conversation.model";

/**
 * C-23: respuestas rápidas de la tienda. La pestaña las carga del backend y las
 * entrega aquí; sin proveedor (historias, pruebas) se usan las del mockup.
 */
const QuickRepliesContext = createContext<WhatsAppQuickReply[]>(WHATSAPP_QUICK_REPLIES);

export const QuickRepliesProvider = QuickRepliesContext.Provider;

export function useQuickReplies(): WhatsAppQuickReply[] {
  return useContext(QuickRepliesContext);
}
