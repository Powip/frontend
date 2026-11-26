import { WHATSAPP_PERMISSION_CODES } from "../enums/whatsapp.enums";
import type { WhatsAppConversationCapabilities } from "../models/conversation.model";

export const WHATSAPP_CONVERSATION_PERMISSIONS = {
  VIEW: WHATSAPP_PERMISSION_CODES.VIEW,
  REPLY: WHATSAPP_PERMISSION_CODES.REPLY,
  REASSIGN: WHATSAPP_PERMISSION_CODES.REASSIGN,
  OPT_OUTS: WHATSAPP_PERMISSION_CODES.OPT_OUTS,
} as const;

export const NO_CONVERSATION_CAPABILITIES: WhatsAppConversationCapabilities = {
  view: false,
  reply: false,
  reassign: false,
  manageOptOuts: false,
};

export function resolveConversationCapabilities(
  permissionCodes: readonly string[] | null,
): WhatsAppConversationCapabilities {
  if (!permissionCodes) return NO_CONVERSATION_CAPABILITIES;
  const granted = new Set(permissionCodes);
  return {
    view: granted.has(WHATSAPP_CONVERSATION_PERMISSIONS.VIEW),
    reply: granted.has(WHATSAPP_CONVERSATION_PERMISSIONS.REPLY),
    reassign: granted.has(WHATSAPP_CONVERSATION_PERMISSIONS.REASSIGN),
    manageOptOuts: granted.has(WHATSAPP_CONVERSATION_PERMISSIONS.OPT_OUTS),
  };
}
