import { toast } from "sonner";
import { SalesChannel } from "@/enum/Order.enum";
import { linkConversationOrder } from "@/services/crmService";
import type { SaleSalesChannel } from "@/services/saleContextService";

/**
 * Contexto «vender desde el chat»: registrar-venta lo recibe por URL desde la
 * Bandeja del CRM (`crmConversationId`, `crmPhone`, `returnTo`).
 */
export interface CrmSaleContext {
  conversationId: string;
  phone: string;
  returnTo: string;
}

// ms-ventas acepta `conversationId` de hasta 200 caracteres.
const MAX_CONVERSATION_ID = 200;

function safeInternalPath(path: string | null): string | null {
  return path &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\")
    ? path
    : null;
}

export function parseCrmSaleContext(params: {
  get(name: string): string | null;
}): CrmSaleContext | null {
  const conversationId = params.get("crmConversationId")?.trim();
  if (!conversationId || conversationId.length > MAX_CONVERSATION_ID) return null;
  return {
    conversationId,
    phone: params.get("crmPhone")?.trim() ?? "",
    returnTo:
      safeInternalPath(params.get("returnTo")) ??
      `/comercial/ventas-chat/bandeja?c=${encodeURIComponent(conversationId)}`,
  };
}

/** Campos extra del payload de `POST order-header/manual`. */
export function crmSalePayload(ctx: CrmSaleContext | null): { conversationId?: string } {
  return ctx ? { conversationId: ctx.conversationId } : {};
}

/**
 * Canal de venta WhatsApp para preseleccionar. Solo si no hay ambigüedad:
 * - tienda con canales configurados: exactamente un canal WhatsApp activo;
 * - tienda sin canales configurados: el canal heredado WHATSAPP, si está en la lista.
 * Devuelve null si no se puede elegir con seguridad (el usuario elige).
 */
export function pickWhatsappChannel(
  storeChannels: SaleSalesChannel[],
  legacyChannels: string[],
): { id: string | undefined; type: SalesChannel } | null {
  if (storeChannels.length > 0) {
    const whatsapp = storeChannels.filter(
      (c) => c.type === "WHATSAPP" && c.isActive !== false,
    );
    return whatsapp.length === 1
      ? { id: whatsapp[0].id, type: SalesChannel.WHATSAPP }
      : null;
  }
  return legacyChannels.includes("WHATSAPP")
    ? { id: undefined, type: SalesChannel.WHATSAPP }
    : null;
}

/**
 * Vincula el pedido recién creado a la conversación. Nunca lanza ni deshace la
 * venta: si falla, avisa. Devuelve true si quedó vinculado.
 */
export async function linkSaleToConversation(
  ctx: CrmSaleContext,
  order: { id: string; orderNumber?: string | null },
): Promise<boolean> {
  try {
    await linkConversationOrder(ctx.conversationId, {
      orderId: order.id,
      ...(order.orderNumber ? { orderNumber: order.orderNumber } : {}),
    });
    return true;
  } catch {
    toast.warning(
      "El pedido se registró, pero no se pudo vincular al chat. Abre la conversación y avísale a soporte si no aparece.",
    );
    return false;
  }
}
