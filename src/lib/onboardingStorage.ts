import { StoredOnboardingState } from '@/types/onboarding';

const KEY = 'powip_onboarding';

export function saveOnboardingState(s: StoredOnboardingState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function getStoredOnboardingState(): StoredOnboardingState | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredOnboardingState;
  } catch {
    return null;
  }
}

export function clearOnboardingState(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEY);
}
