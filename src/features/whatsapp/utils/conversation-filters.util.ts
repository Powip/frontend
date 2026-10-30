import type {
  WhatsAppConversationFilters,
  WhatsAppConversationQuery,
} from "../models/conversation.model";

export const CONVERSATION_SEARCH_MIN_LENGTH = 2;
export const CONVERSATION_SEARCH_DEBOUNCE_MS = 300;

export const EMPTY_CONVERSATION_FILTERS: WhatsAppConversationFilters = {
  search: "",
  storeId: null,
  assignedToMe: false,
};

const PHONE_LIKE_PATTERN = /^[+\d\s().-]+$/;

export function normalizeConversationSearch(raw: string): string | null {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  const normalized = PHONE_LIKE_PATTERN.test(collapsed) ? collapsed.replace(/\D/g, "") : collapsed;
  return normalized.length >= CONVERSATION_SEARCH_MIN_LENGTH ? normalized : null;
}

export function isSearchTooShort(raw: string): boolean {
  return raw.trim().length > 0 && normalizeConversationSearch(raw) === null;
}

export function toConversationQuery(
  filters: WhatsAppConversationFilters,
  currentUserId: string | null,
): WhatsAppConversationQuery {
  return {
    q: normalizeConversationSearch(filters.search),
    storeId: filters.storeId,
    assignedTo: filters.assignedToMe && currentUserId ? currentUserId : null,
  };
}

export function hasActiveConversationFilters(filters: WhatsAppConversationFilters): boolean {
  return (
    normalizeConversationSearch(filters.search) !== null ||
    filters.storeId !== null ||
    filters.assignedToMe
  );
}
