"use client";

interface AdminReadDenial {
  userId: string;
  accessToken: string;
  error: Error;
}

let denial: AdminReadDenial | null = null;
let revision = 0;
let nextEpoch = 0;
let currentBearer: string | null = null;
let currentEpoch = 0;
const listeners = new Set<() => void>();

// Bearers stay in private memory. Only a non-secret epoch enters query keys.
export function adminReadSessionEpoch(accessToken: string | undefined): number {
  // SSR never stores request identities in shared module state.
  if (typeof window === "undefined") return 0;
  if (!accessToken) {
    currentBearer = null;
    denial = null;
    return 0;
  }
  if (currentBearer !== accessToken) {
    currentBearer = accessToken;
    currentEpoch = ++nextEpoch;
    denial = null;
  }
  return currentEpoch;
}

export function subscribeAdminReadDenial(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAdminReadDenialSnapshot() {
  return revision;
}
export function getServerAdminReadDenialSnapshot() {
  return 0;
}

export function denyAdminReadSession(userId: string, accessToken: string, error: Error) {
  if (typeof window === "undefined") return;
  denial = { userId, accessToken, error };
  revision += 1;
  listeners.forEach((listener) => {
    listener();
  });
}

export function clearAdminReadDenial() {
  denial = null;
  revision += 1;
  listeners.forEach((listener) => {
    listener();
  });
}

export function adminReadDenialFor(
  userId: string | undefined,
  accessToken: string | undefined,
): Error | null {
  return denial && denial.userId === userId && denial.accessToken === accessToken
    ? denial.error
    : null;
}
