/**
 * FEAT-24 H9 (H9-D5) — migración única de los regalos (GIFT) que vivían en el localStorage del navegador a
 * `ventas.promos`. Corre una vez por empresa y navegador (la abre un Administrador en Promociones):
 * - cada regalo válido se crea en el servidor y se anota en la marca (`migrated`), así un reintento nunca
 *   lo duplica aunque no se haya podido borrar del navegador;
 * - lo que no se puede pasar (condición por cantidad total, solo canales que ya no existen, regalo con
 *   IMEI/serie) se mueve a una copia de respaldo con su motivo;
 * - lo migrado y lo respaldado sale de las claves que lee la venta; lo que falló por red queda para la
 *   próxima vez.
 */
import type { PromotionBody } from "@/services/promotionsService";
import { ORDER_CHANNELS, normalizeOrderChannel } from "./orderChannels";

export const legacyPackKeys = (companyId: string) => [`powip.packs.local.${companyId}`, `powip.packs.variants.v1.${companyId}`];
export const giftMigrationKey = (companyId: string) => `powip.promos.gift-migration.v1.${companyId}`;
export const giftBackupKey = (companyId: string) => `powip.promos.gift-backup.v1.${companyId}`;

interface LocalGiftOption {
  variantId: string;
  productName: string;
  trackingMode?: string;
  value?: number;
}

export interface LocalGiftPack {
  id: string;
  type: "GIFT";
  name: string;
  active: boolean;
  channels: string[];
  triggerBy: "amount" | "qty";
  minAmount?: number | null;
  minQty?: number | null;
  gifts: LocalGiftOption[];
}

interface MigrationState {
  done: boolean;
  /** id local → id de la promo creada. */
  migrated: Record<string, string>;
  /** id local → motivo por el que no se pasó. */
  skipped: Record<string, string>;
}

export interface GiftMigrationResult {
  status: "none" | "done" | "partial";
  migrated: Array<{ name: string; extraOptions: number }>;
  skipped: Array<{ name: string; reason: string }>;
  failed: Array<{ name: string; message: string }>;
}

const VALID_CHANNELS = new Set<string>(ORDER_CHANNELS.map((channel) => channel.value));

function isLocalGift(value: unknown): value is LocalGiftPack {
  if (!value || typeof value !== "object") return false;
  const pack = value as Record<string, unknown>;
  return (
    pack.type === "GIFT" && typeof pack.id === "string" && typeof pack.name === "string" &&
    Array.isArray(pack.channels) && Array.isArray(pack.gifts) &&
    pack.gifts.every((gift) => !!gift && typeof gift === "object" && typeof (gift as { variantId?: unknown }).variantId === "string")
  );
}

function readArray(storage: Storage, key: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readState(storage: Storage, companyId: string): MigrationState {
  try {
    const parsed = JSON.parse(storage.getItem(giftMigrationKey(companyId)) ?? "null") as Partial<MigrationState> | null;
    return { done: parsed?.done === true, migrated: { ...(parsed?.migrated ?? {}) }, skipped: { ...(parsed?.skipped ?? {}) } };
  } catch {
    return { done: false, migrated: {}, skipped: {} };
  }
}

/** Regalos que siguen guardados en este navegador. */
export function readLocalGifts(storage: Storage, companyId: string): LocalGiftPack[] {
  const byId = new Map<string, LocalGiftPack>();
  for (const key of legacyPackKeys(companyId)) for (const pack of readArray(storage, key)) if (isLocalGift(pack)) byId.set(pack.id, pack);
  return [...byId.values()];
}

/** Cuerpo de `/promos` para un regalo local, o el motivo por el que no se puede pasar. */
export function giftToPromotion(gift: LocalGiftPack): { body: PromotionBody; isActive: boolean; extraOptions: number } | { reason: string } {
  if (gift.triggerBy !== "amount") {
    return { reason: "La condición «cantidad total de unidades» ya no existe: créalo de nuevo como regalo por monto o por producto." };
  }
  const option = gift.gifts[0];
  if (!option) return { reason: "No tenía ningún producto de regalo." };
  if (option.trackingMode && option.trackingMode !== "NONE") return { reason: "El regalo lleva IMEI o serie y no se puede regalar automáticamente." };
  const channels = [...new Set(gift.channels.map(normalizeOrderChannel).filter((code): code is string => !!code && VALID_CHANNELS.has(code)))];
  if (gift.channels.length > 0 && channels.length === 0) {
    return { reason: "Solo tenía canales que ya no existen (Rappi o Pedidos Ya)." };
  }
  return {
    body: {
      name: gift.name.trim().slice(0, 150) || "Regalo",
      type: "GIFT",
      channels,
      storeIds: [],
      startsAt: null,
      endsAt: null,
      giftCondition: "AMOUNT",
      minAmount: Math.max(0.01, Math.round(Number(gift.minAmount ?? 0) * 100) / 100),
      giftVariantId: option.variantId,
      giftQuantity: 1,
    },
    isActive: gift.active !== false,
    extraOptions: gift.gifts.length - 1,
  };
}

/** ¿Hay algo que migrar en este navegador? */
export function hasPendingGiftMigration(storage: Storage, companyId: string): boolean {
  return readLocalGifts(storage, companyId).length > 0;
}

export async function migrateLocalGifts(input: {
  storage: Storage;
  companyId: string;
  create: (body: PromotionBody) => Promise<{ id: string }>;
  deactivate: (promoId: string) => Promise<void>;
}): Promise<GiftMigrationResult> {
  const { storage, companyId } = input;
  const gifts = readLocalGifts(storage, companyId);
  const state = readState(storage, companyId);
  const result: GiftMigrationResult = { status: "none", migrated: [], skipped: [], failed: [] };
  const save = () => storage.setItem(giftMigrationKey(companyId), JSON.stringify(state));
  if (gifts.length === 0) {
    if (!state.done) {
      state.done = true;
      save();
    }
    return result;
  }

  const backup: Array<LocalGiftPack & { reason: string }> = [];
  for (const gift of gifts) {
    if (state.migrated[gift.id]) continue;
    const mapped = giftToPromotion(gift);
    if ("reason" in mapped) {
      state.skipped[gift.id] = mapped.reason;
      backup.push({ ...gift, reason: mapped.reason });
      result.skipped.push({ name: gift.name, reason: mapped.reason });
      save();
      continue;
    }
    try {
      const created = await input.create(mapped.body);
      state.migrated[gift.id] = created.id;
      save();
      if (!mapped.isActive) await input.deactivate(created.id).catch(() => undefined);
      result.migrated.push({ name: gift.name, extraOptions: mapped.extraOptions });
    } catch (error) {
      result.failed.push({ name: gift.name, message: error instanceof Error ? error.message : "Error desconocido" });
    }
  }

  if (backup.length) {
    const previous = readArray(storage, giftBackupKey(companyId));
    storage.setItem(giftBackupKey(companyId), JSON.stringify([...previous, ...backup]));
  }
  const handled = new Set([...Object.keys(state.migrated), ...Object.keys(state.skipped)]);
  for (const key of legacyPackKeys(companyId)) {
    const raw = storage.getItem(key);
    if (raw === null) continue;
    const kept = readArray(storage, key).filter((pack) => !(isLocalGift(pack) && handled.has(pack.id)));
    storage.setItem(key, JSON.stringify(kept));
  }
  state.done = result.failed.length === 0;
  save();
  result.status = result.failed.length ? "partial" : "done";
  return result;
}
