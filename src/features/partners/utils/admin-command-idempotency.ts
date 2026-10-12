import z from "zod";
import { createIdempotencyKey } from "./create-idempotency-key";

const RETRY_TTL = 24 * 60 * 60 * 1000;
const entrySchema = z
  .object({
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    key: z.string().regex(/^[A-Za-z0-9._:-]{8,200}$/),
    createdAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
const registrySchema = z
  .object({
    version: z.literal(1),
    userId: z.uuid(),
    operation: z.string().min(1),
    entries: z.array(entrySchema).max(100),
  })
  .strict();

// Persist only command hashes and retry keys, never tokens, draft values or reasons.
export async function resolveAdminCommandIdempotencyKey(
  userId: string,
  operation: string,
  command: unknown,
  now?: number,
): Promise<string> {
  if (typeof window === "undefined")
    throw new Error("La operación requiere una sesión del navegador.");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(command)),
  );
  const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const storageKey = `powip:partners:admin-command:${operation}:${userId}`;
  // Hash completion can be out of invocation order. Evaluate registry time at the
  // synchronous read/write boundary, not before awaiting the asynchronous digest.
  const observedAt = now ?? Date.now();
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    const registry =
      raw === null
        ? { version: 1 as const, userId, operation, entries: [] as z.infer<typeof entrySchema>[] }
        : registrySchema.parse(JSON.parse(raw));
    if (registry.userId !== userId || registry.operation !== operation)
      throw new Error("Invalid retry identity");
    const fingerprints = new Set<string>();
    const keys = new Set<string>();
    for (const entry of registry.entries) {
      if (
        entry.createdAt > observedAt ||
        fingerprints.has(entry.fingerprint) ||
        keys.has(entry.key)
      )
        throw new Error("Invalid retry registry");
      fingerprints.add(entry.fingerprint);
      keys.add(entry.key);
    }
    let entry = registry.entries.find((candidate) => candidate.fingerprint === fingerprint);
    if (entry && observedAt - entry.createdAt >= RETRY_TTL) {
      throw new Error(
        "El reintento venció. Revisá las versiones guardadas antes de crear otra solicitud.",
      );
    }
    if (!entry) {
      if (registry.entries.length >= 100)
        throw new Error("El registro de reintentos está lleno. Revisá las operaciones guardadas.");
      entry = { fingerprint, key: createIdempotencyKey(), createdAt: observedAt };
      registry.entries.push(entry);
    }
    const encoded = JSON.stringify(registry);
    window.sessionStorage.setItem(storageKey, encoded);
    if (window.sessionStorage.getItem(storageKey) !== encoded)
      throw new Error("Retry registry unavailable");
    return entry.key;
  } catch (error) {
    if (
      error instanceof Error &&
      /reintento venció|registro de reintentos está lleno/.test(error.message)
    )
      throw error;
    throw new Error(
      "No pudimos conservar la clave de reintento. Revisá el almacenamiento de esta pestaña antes de guardar.",
    );
  }
}
