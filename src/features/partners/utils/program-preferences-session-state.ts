"use client";

interface PreferencesDenial {
  userId: string;
  epoch: number;
  error: Error;
}

let denial: PreferencesDenial | null = null;
let revision = 0;
const listeners = new Set<() => void>();

export function subscribeProgramPreferencesDenial(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function programPreferencesDenialSnapshot() {
  return revision;
}

export function serverProgramPreferencesDenialSnapshot() {
  return 0;
}

export function getProgramPreferencesDenial(userId: string | undefined, epoch: number) {
  if (typeof window === "undefined") return null;
  return denial && denial.userId === userId && denial.epoch === epoch ? denial.error : null;
}

export function denyProgramPreferencesSession(userId: string, epoch: number, error: Error) {
  if (typeof window === "undefined") return;
  denial = { userId, epoch, error };
  revision += 1;
  listeners.forEach((listener) => {
    listener();
  });
}

export function clearProgramPreferencesDenial() {
  if (typeof window === "undefined") return;
  denial = null;
  revision += 1;
  listeners.forEach((listener) => {
    listener();
  });
}
