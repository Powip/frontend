import type { AxiosRequestConfig } from "axios";

// FEAT-24 H6-D (H6-D4) — opciones de las escrituras del modo almacén: la clave
// de idempotencia de cada acción de la cola y un timeout (sin él, una petición
// colgada nunca se resuelve y la cola no puede verificar ni reintentar).
//
// El header `Idempotency-Key` se manda solo si NEXT_PUBLIC_IDEMPOTENCY_HEADER=on.
// Motivo: ms-ventas y ms-products declaran en CORS `allowedHeaders` sin ese
// header (el gateway sí lo acepta). Mandarlo antes de que H6-A/H6-B lo agreguen
// hace fallar el preflight y bloquea TODAS las escrituras del celular. Mientras
// tanto la cola no depende de él: después de un envío sin respuesta consulta el
// estado antes de reenviar (ver offlineQueue.ts).

export const IDEMPOTENCY_HEADER = "Idempotency-Key";

export interface WriteOptions {
  idempotencyKey?: string;
  timeoutMs?: number;
}

export function idempotencyHeaderEnabled(): boolean {
  return process.env.NEXT_PUBLIC_IDEMPOTENCY_HEADER === "on";
}

/**
 * Argumentos extra para axios: `[]` sin opciones (la llamada queda igual que siempre) o `[config]` con el
 * timeout y, si está habilitado, el header.
 */
export function writeConfigArgs(options?: WriteOptions): [] | [AxiosRequestConfig] {
  if (!options) return [];
  const config: AxiosRequestConfig = {};
  if (options.timeoutMs) config.timeout = options.timeoutMs;
  if (options.idempotencyKey && idempotencyHeaderEnabled()) config.headers = { [IDEMPOTENCY_HEADER]: options.idempotencyKey };
  return Object.keys(config).length ? [config] : [];
}
