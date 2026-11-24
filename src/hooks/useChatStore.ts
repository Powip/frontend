"use client";
import { useAuth } from "@/contexts/AuthContext";
import { resolveStoreId } from "@/components/ventas-chat/chatQuote";
import type { Conversation } from "@/types/crm";
import { useCrmMe } from "./useCrmMe";

/**
 * Tiendas del usuario y la que toca a este chat: la elegida a mano manda; si
 * no, la del canal del chat y luego la tienda activa. Se deriva porque las
 * tiendas llegan después (`GET /crm/me`); mientras, se usan las de la sesión.
 */
export function useChatStore(conversation: Conversation, choice = "") {
  const { auth, selectedStoreId } = useAuth();
  const { stores: crmStores } = useCrmMe();
  const stores = crmStores.length > 0 ? crmStores : (auth?.company?.stores ?? []);
  return { stores, storeId: resolveStoreId(stores, [choice, conversation.storeId, selectedStoreId]) };
}
