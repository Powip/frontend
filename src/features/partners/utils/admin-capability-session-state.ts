"use client";

export type AdminCapabilityFamily =
  | "policy"
  | "resources"
  | "partners"
  | "payout"
  | "reviews"
  | "invitations";
interface Denial {
  userId: string;
  epoch: number;
  error: Error;
}
const denials: Record<AdminCapabilityFamily, Denial | null> = {
  policy: null,
  resources: null,
  partners: null,
  payout: null,
  reviews: null,
  invitations: null,
};
let revision = 0;
const listeners = new Set<() => void>();

export function subscribeAdminCapabilityDenial(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function adminCapabilityDenialSnapshot() {
  return revision;
}
export function serverAdminCapabilityDenialSnapshot() {
  return 0;
}
export function getAdminCapabilityDenial(
  family: AdminCapabilityFamily,
  userId: string | undefined,
  epoch: number,
) {
  if (typeof window === "undefined") return null;
  const denial = denials[family];
  return denial && denial.userId === userId && denial.epoch === epoch ? denial.error : null;
}
export function denyAdminCapability(
  family: AdminCapabilityFamily,
  userId: string,
  epoch: number,
  error: Error,
) {
  if (typeof window === "undefined") return;
  denials[family] = { userId, epoch, error };
  revision += 1;
  listeners.forEach((listener) => {
    listener();
  });
}
export function clearAdminCapabilityDenials() {
  if (typeof window === "undefined") return;
  denials.policy = null;
  denials.resources = null;
  denials.partners = null;
  denials.payout = null;
  denials.reviews = null;
  denials.invitations = null;
  revision += 1;
  listeners.forEach((listener) => {
    listener();
  });
}
