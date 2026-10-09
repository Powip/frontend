import {
  WHATSAPP_CONVERSATION_VIEWS,
  type WhatsAppConversationView,
} from "../enums/whatsapp.enums";

export const CONVERSATION_VIEW_STORAGE_KEY = "powip:wa:conversations-view";
export const DEFAULT_CONVERSATION_VIEW: WhatsAppConversationView =
  WHATSAPP_CONVERSATION_VIEWS.BOARD;

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

function getBrowserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function parseConversationView(
  value: string | null | undefined,
): WhatsAppConversationView | null {
  return Object.values(WHATSAPP_CONVERSATION_VIEWS).find((view) => view === value) ?? null;
}

export function readStoredConversationView(
  storage: ReadableStorage | null = getBrowserStorage(),
): WhatsAppConversationView | null {
  if (!storage) return null;
  try {
    return parseConversationView(storage.getItem(CONVERSATION_VIEW_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredConversationView(
  view: WhatsAppConversationView,
  storage: WritableStorage | null = getBrowserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(CONVERSATION_VIEW_STORAGE_KEY, view);
  } catch {
    return;
  }
}
