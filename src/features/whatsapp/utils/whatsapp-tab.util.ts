import {
  DEFAULT_WHATSAPP_TAB,
  WHATSAPP_TAB_DEFINITIONS,
  WHATSAPP_TAB_STORAGE_KEY,
} from "../constants/whatsapp-tabs";
import type { WhatsAppTab } from "../enums/whatsapp.enums";

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

export function parseWhatsAppTab(value: string | null | undefined): WhatsAppTab | null {
  if (!value) return null;
  return WHATSAPP_TAB_DEFINITIONS.find((tab) => tab.key === value)?.key ?? null;
}

export function resolveWhatsAppTab(input: {
  urlTab: string | null | undefined;
  storedTab: string | null | undefined;
}): WhatsAppTab {
  return (
    parseWhatsAppTab(input.urlTab) ?? parseWhatsAppTab(input.storedTab) ?? DEFAULT_WHATSAPP_TAB
  );
}

function getBrowserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredWhatsAppTab(
  storage: ReadableStorage | null = getBrowserStorage(),
): WhatsAppTab | null {
  if (!storage) return null;
  try {
    return parseWhatsAppTab(storage.getItem(WHATSAPP_TAB_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeStoredWhatsAppTab(
  tab: WhatsAppTab,
  storage: WritableStorage | null = getBrowserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(WHATSAPP_TAB_STORAGE_KEY, tab);
  } catch {
    return;
  }
}
