"use client";

let denial: { userId: string; epoch: number; error: Error } | null = null;
let revision = 0;
const listeners = new Set<() => void>();
export function subscribeCommissionReadDenial(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function commissionReadDenialSnapshot() {
  return revision;
}
export function serverCommissionReadDenialSnapshot() {
  return 0;
}
export function getCommissionReadDenial(userId: string | undefined, epoch: number) {
  if (typeof window === "undefined") return null;
  return denial && denial.userId === userId && denial.epoch === epoch ? denial.error : null;
}
export function denyCommissionReadSession(userId: string, epoch: number, error: Error) {
  if (typeof window === "undefined") return;
  denial = { userId, epoch, error };
  revision += 1;
  listeners.forEach((listener) => {
    listener();
  });
}
export function clearCommissionReadDenial() {
  if (typeof window === "undefined") return;
  denial = null;
  revision += 1;
  listeners.forEach((listener) => {
    listener();
  });
}
