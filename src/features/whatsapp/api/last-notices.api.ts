import { API } from "@/lib/api";
import axiosAuth from "@/lib/axiosAuth";
import {
  assertWhatsAppContractAvailable,
  isWhatsAppContractAvailable,
} from "../constants/whatsapp-contracts";
import { parseWhatsAppLastNotice, type WhatsAppLastNotice } from "../utils/last-notice.util";

const BASE = `${API.integrations}/wa`;
const MAX_BATCH = 200;
const CACHE_MS = 60_000;

interface LastNoticeDto {
  orderId: string;
  status: string;
  templateName: string | null;
  at: string;
  reason: string | null;
}

/** C-29 — POST /wa/orders/last-notices. Devuelve solo los pedidos con algún aviso. */
export async function listWhatsAppLastNotices(
  orderIds: string[],
): Promise<Map<string, WhatsAppLastNotice>> {
  assertWhatsAppContractAvailable("lastNotices");
  const { data } = await axiosAuth.post<{ items: LastNoticeDto[] }>(`${BASE}/orders/last-notices`, {
    orderIds,
  });
  const result = new Map<string, WhatsAppLastNotice>();
  for (const item of data?.items ?? []) {
    const notice = parseWhatsAppLastNotice(item);
    if (notice) result.set(item.orderId, notice);
  }
  return result;
}

type Listener = () => void;
const cache = new Map<string, { notice: WhatsAppLastNotice | null; at: number }>();
const listeners = new Map<string, Set<Listener>>();
let queued = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

function notify(ids: Iterable<string>) {
  for (const id of ids) listeners.get(id)?.forEach((listener) => listener());
}

async function flush() {
  timer = null;
  const ids = [...queued];
  queued = new Set();
  for (let i = 0; i < ids.length; i += MAX_BATCH) {
    const chunk = ids.slice(i, i + MAX_BATCH);
    try {
      const found = await listWhatsAppLastNotices(chunk);
      const now = Date.now();
      for (const id of chunk) cache.set(id, { notice: found.get(id) ?? null, at: now });
    } catch {
      // Sin permiso o sin servicio: el indicador no se muestra; se reintenta más tarde.
      for (const id of chunk) cache.delete(id);
    }
    notify(chunk);
  }
}

/**
 * Pide el último aviso de un pedido. Las peticiones de una misma pintada se juntan
 * en una sola llamada al backend (las listas de pedidos piden decenas a la vez).
 */
export function requestWhatsAppLastNotice(orderId: string): void {
  if (!orderId || !isWhatsAppContractAvailable("lastNotices")) return;
  const hit = cache.get(orderId);
  if (hit && Date.now() - hit.at < CACHE_MS) return;
  queued.add(orderId);
  if (!timer) timer = setTimeout(() => void flush(), 30);
}

export function readWhatsAppLastNotice(orderId: string): WhatsAppLastNotice | null {
  return cache.get(orderId)?.notice ?? null;
}

export function subscribeWhatsAppLastNotice(orderId: string, listener: Listener): () => void {
  const set = listeners.get(orderId) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(orderId, set);
  return () => {
    set.delete(listener);
    if (!set.size) listeners.delete(orderId);
  };
}

/** Solo para pruebas. */
export function resetWhatsAppLastNoticesCache(): void {
  cache.clear();
  queued = new Set();
  if (timer) clearTimeout(timer);
  timer = null;
}
