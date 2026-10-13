import type { StoredOnboardingState } from "@/types/onboarding";

const KEY = "powip_onboarding";
export const ONBOARDING_STORAGE_TTL_MS = 24 * 60 * 60 * 1000;

/** Allow only checkout metadata, never credentials, bearer tokens or card details. */
export function validateStoredOnboardingState(value: unknown): StoredOnboardingState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.planId !== "string" ||
    typeof record.planName !== "string" ||
    typeof record.price !== "number" ||
    !Number.isFinite(record.price) ||
    record.price < 0 ||
    typeof record.userId !== "string" ||
    !record.userId.trim() ||
    typeof record.cardToken !== "string" ||
    !record.cardToken.trim() ||
    !Array.isArray(record.addOnIds) ||
    !record.addOnIds.every((id) => typeof id === "string" && id.trim())
  )
    return null;
  return {
    planId: record.planId,
    planName: record.planName,
    price: record.price,
    userId: record.userId,
    cardToken: record.cardToken,
    addOnIds: [...new Set(record.addOnIds as string[])],
  };
}

export function saveOnboardingState(state: StoredOnboardingState): void {
  if (typeof window === "undefined") return;
  const safe = validateStoredOnboardingState(state);
  if (!safe) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, savedAt: Date.now(), state: safe }));
  } catch {
    // Storage can be unavailable; an active checkout must still work in memory.
  }
}

export function getStoredOnboardingState(userId?: string): StoredOnboardingState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const record = parsed as Record<string, unknown>;
    const isCurrent = record.version === 1;
    if (
      isCurrent &&
      (typeof record.savedAt !== "number" ||
        !Number.isFinite(record.savedAt) ||
        Date.now() - record.savedAt > ONBOARDING_STORAGE_TTL_MS ||
        record.savedAt > Date.now() + 60_000)
    ) {
      localStorage.removeItem(KEY);
      return null;
    }
    const safe = validateStoredOnboardingState(isCurrent ? record.state : parsed);
    if (!safe || (userId !== undefined && safe.userId !== userId)) return null;
    // Legacy records have no expiry. Migrate only after matching the current session.
    if (!isCurrent) {
      if (!userId || safe.userId !== userId) return null;
      saveOnboardingState(safe);
    }
    return safe;
  } catch {
    return null;
  }
}

export function clearOnboardingState(userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    if (userId !== undefined) {
      const stored = getStoredOnboardingState(userId);
      if (!stored) return;
    }
    localStorage.removeItem(KEY);
  } catch {
    // Cleanup must not interrupt account/session transitions.
  }
}
