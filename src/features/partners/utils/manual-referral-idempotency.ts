import type { RegisterReferralRequestDto } from "../dto/register-referral-request.dto";
import { createIdempotencyKey } from "./create-idempotency-key";

const OPERATION = "partner.referral.register";
const VERSION = 1;
// Conservatively shorter than ms-partners' default 30-day idempotency retention.
export const MANUAL_REFERRAL_RETRY_TTL_MS = 24 * 60 * 60 * 1000;

export interface ManualReferralRetryKey {
  fingerprint: string;
  key: string;
  createdAt: number;
}

interface RetryRegistry {
  version: number;
  userId: string;
  operation: string;
  entries: ManualReferralRetryKey[];
}

export function manualReferralStorageKey(userId: string): string {
  return `powip:partners:manual-referral:${userId}`;
}

function invalidRegistry(): Error {
  return new Error(
    "El registro de reintentos no es válido. Revisá el estado del referido antes de intentar nuevamente.",
  );
}

function storageUnavailable(): Error {
  return new Error(
    "No pudimos acceder al registro seguro de reintentos. Habilitá el almacenamiento de esta pestaña.",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return (
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
  );
}

function readRegistry(userId: string, now: number = Date.now()): RetryRegistry {
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(manualReferralStorageKey(userId));
  } catch {
    throw storageUnavailable();
  }
  if (raw === null) return { version: VERSION, userId, operation: OPERATION, entries: [] };

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw invalidRegistry();
  }
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ["version", "userId", "operation", "entries"]) ||
    value.version !== VERSION ||
    value.userId !== userId ||
    value.operation !== OPERATION ||
    !Array.isArray(value.entries)
  ) {
    throw invalidRegistry();
  }

  const fingerprints = new Set<string>();
  const keys = new Set<string>();
  const entries = value.entries.map((entry: unknown): ManualReferralRetryKey => {
    if (
      !isRecord(entry) ||
      !hasOnlyKeys(entry, ["fingerprint", "key", "createdAt"]) ||
      typeof entry.fingerprint !== "string" ||
      !/^[a-f0-9]{64}$/.test(entry.fingerprint) ||
      typeof entry.key !== "string" ||
      !/^[A-Za-z0-9._:-]{8,200}$/.test(entry.key) ||
      typeof entry.createdAt !== "number" ||
      !Number.isSafeInteger(entry.createdAt) ||
      entry.createdAt < 0 ||
      entry.createdAt > now ||
      fingerprints.has(entry.fingerprint) ||
      keys.has(entry.key)
    ) {
      throw invalidRegistry();
    }
    fingerprints.add(entry.fingerprint);
    keys.add(entry.key);
    return { fingerprint: entry.fingerprint, key: entry.key, createdAt: entry.createdAt };
  });
  return { version: VERSION, userId, operation: OPERATION, entries };
}

function writeRegistry(registry: RetryRegistry): void {
  try {
    const key = manualReferralStorageKey(registry.userId);
    const serialized = JSON.stringify(registry);
    window.sessionStorage.setItem(key, serialized);
    if (window.sessionStorage.getItem(key) !== serialized) throw storageUnavailable();
  } catch {
    throw storageUnavailable();
  }
}

async function fingerprintOf(requestDto: RegisterReferralRequestDto): Promise<string> {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(requestDto));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  } catch {
    throw new Error(
      "El navegador no pudo crear una huella segura del reintento. Usá un navegador actualizado y una conexión segura.",
    );
  }
}

export async function resolveManualReferralRetryKey(
  userId: string | undefined,
  requestDto: RegisterReferralRequestDto,
  now: number = Date.now(),
): Promise<ManualReferralRetryKey> {
  if (!userId) throw new Error("La sesión no está disponible. Volvé a iniciar sesión.");
  const fingerprint = await fingerprintOf(requestDto);
  const registry = readRegistry(userId, now);
  const existing = registry.entries.find((entry) => entry.fingerprint === fingerprint);
  if (existing) {
    if (now - existing.createdAt >= MANUAL_REFERRAL_RETRY_TTL_MS) {
      throw new Error(
        "La clave de esta solicitud venció. Revisá el estado del referido antes de volver a registrarlo.",
      );
    }
    writeRegistry(registry);
    return existing;
  }

  const entry = { fingerprint, key: createIdempotencyKey(), createdAt: now };
  registry.entries.push(entry);
  writeRegistry(registry);
  return entry;
}

export function confirmManualReferralRetryKey(
  userId: string,
  confirmed: ManualReferralRetryKey,
): void {
  const registry = readRegistry(userId);
  const existing = registry.entries.find((entry) => entry.fingerprint === confirmed.fingerprint);
  if (!existing || existing.key !== confirmed.key) throw invalidRegistry();
  registry.entries = registry.entries.filter(
    (entry) => entry.fingerprint !== confirmed.fingerprint,
  );
  writeRegistry(registry);
}
