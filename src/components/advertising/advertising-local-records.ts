export interface AdvertisingLocalManualRecord {
  source: "pauta" | "cierre";
  browserKey: string;
  sourceId: string;
  date: string;
  amount: string | null;
  currency: string | null;
  payload: Record<string, unknown>;
}

export interface AdvertisingLocalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface AdvertisingLocalRecordsResult {
  records: AdvertisingLocalManualRecord[];
  warnings: string[];
  nextOffset: number | null;
}

type LocalCandidate =
  | { source: "pauta"; storageKey: string; original: unknown; duplicate: boolean }
  | {
      source: "cierre";
      storageKey: string;
      storeId: string;
      date: string;
      field?: string;
      platform?: string;
      original: unknown;
    };

const MAX_RECORDS = 1000;
const MAX_STORES = 100;
const MAX_SOURCE_CHARACTERS = 2 * 1024 * 1024;
const MAX_TOTAL_SOURCE_CHARACTERS = 4 * 1024 * 1024;
const MAX_PAYLOAD_BYTES = 16 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_SCOPE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const PLATFORMS = [
  ["publiMeta", "meta"],
  ["publiTiktok", "tiktok"],
  ["publiGoogle", "google"],
] as const;

const COPY = {
  scope: "No se pudo identificar la empresa o sus tiendas.",
  storage: "No se pudo leer el historial de este navegador.",
  identity: "No se pudo guardar la identidad de este navegador.",
  damaged: "Se omitieron registros dañados.",
  date: "Se omitieron registros sin una fecha válida.",
  tenant: "Se omitieron registros de otra empresa o tienda.",
  amount: "Algunos importes requieren revisión.",
  size: "Se omitieron registros demasiado grandes.",
  limit: "Hay más registros. Lee el siguiente grupo.",
  cursor: "No se pudo leer ese grupo de registros.",
} as const;

function owns(value: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(value, key);
}

function isObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

function validSourceId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 255 &&
    value.trim().length > 0 &&
    Array.from(value).every((character) => {
      const point = character.codePointAt(0) ?? 0;
      return point > 31 && point !== 127;
    })
  );
}

function exactAmount(value: unknown): string | null {
  if (typeof value === "string") {
    return value.length <= 1024 && /^\d+(?:\.\d+)?$/.test(value) ? value : null;
  }
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER
  ) {
    return null;
  }
  // Use the stored number's representation, without toFixed or currency rounding.
  const decimal = value.toString();
  if (!decimal.includes("e")) return decimal;
  const [coefficient, exponent] = decimal.split("e");
  const [whole, fraction = ""] = coefficient.split(".");
  const digits = whole + fraction;
  const point = whole.length + Number(exponent);
  if (point <= 0) return `0.${"0".repeat(-point)}${digits}`;
  if (point >= digits.length) return digits + "0".repeat(point - digits.length);
  return `${digits.slice(0, point)}.${digits.slice(point)}`;
}

function explicitCurrency(original: Record<string, unknown>): string | null {
  return typeof original.currency === "string" && /^[A-Z]{3}$/.test(original.currency)
    ? original.currency
    : null;
}

function utf8Length(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    bytes += point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function safePayload(payload: Record<string, unknown>): "ok" | "damaged" | "size" {
  let nodes = 0;
  function inspect(value: unknown, depth: number): "ok" | "damaged" | "size" {
    nodes += 1;
    if (depth > 12 || nodes > 2000) return "size";
    if (typeof value === "number" && !Number.isFinite(value)) return "damaged";
    if (value === null || typeof value !== "object") return "ok";
    if (Array.isArray(value)) {
      if (value.length > 256) return "size";
      for (const item of value) {
        const result = inspect(item, depth + 1);
        if (result !== "ok") return result;
      }
      return "ok";
    }
    if (!isObject(value)) return "damaged";
    const keys = Object.keys(value);
    if (keys.length > 512) return "size";
    for (const key of keys) {
      if (FORBIDDEN_KEYS.has(key)) return "damaged";
      const result = inspect(value[key], depth + 1);
      if (result !== "ok") return result;
    }
    return "ok";
  }
  const inspection = inspect(payload, 0);
  if (inspection !== "ok") return inspection;
  return utf8Length(JSON.stringify(payload)) <= MAX_PAYLOAD_BYTES ? "ok" : "size";
}

function createBrowserIdentity(): string | null {
  try {
    if (typeof globalThis.crypto?.randomUUID === "function") return crypto.randomUUID();
    if (typeof globalThis.crypto?.getRandomValues !== "function") return null;
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  } catch {
    return null;
  }
}

/**
 * Reads only the selected company's Pauta and its explicitly supplied store IDs.
 * Legacy records are never rewritten. Callers send these records in batches of at most 200.
 * The cursor counts candidates, including damaged records, across 1000-candidate windows.
 */
export function readAdvertisingLocalRecords({
  companyId,
  storeIds,
  storage,
  offset = 0,
}: {
  companyId: string;
  storeIds: readonly string[];
  storage?: AdvertisingLocalStorage;
  offset?: number;
}): AdvertisingLocalRecordsResult {
  const records: AdvertisingLocalManualRecord[] = [];
  const warnings = new Set<string>();
  let nextOffset: number | null = null;
  const result = () => ({ records, warnings: Array.from(warnings), nextOffset });
  if (!Number.isSafeInteger(offset) || offset < 0) {
    warnings.add(COPY.cursor);
    return result();
  }
  if (typeof companyId !== "string" || !SAFE_SCOPE_ID.test(companyId)) {
    warnings.add(COPY.scope);
    return result();
  }
  if (!Array.isArray(storeIds) || storeIds.length > MAX_STORES) {
    warnings.add(COPY.scope);
    return result();
  }
  const stores = Array.from(new Set(storeIds)).sort();
  if (stores.some((id) => typeof id !== "string" || !SAFE_SCOPE_ID.test(id))) {
    warnings.add(COPY.scope);
    return result();
  }
  let local: AdvertisingLocalStorage;
  try {
    if (!storage && typeof window === "undefined") return result();
    local = storage ?? window.localStorage;
  } catch {
    warnings.add(COPY.storage);
    return result();
  }

  const identityKey = `powip:advertising:manual-browser:${companyId}`;
  let browserKey: string;
  try {
    const existing = local.getItem(identityKey);
    if (existing !== null) {
      // Replacing an invalid identity could duplicate an already imported history.
      if (!UUID.test(existing)) throw new Error("Invalid browser identity");
      browserKey = existing;
    } else {
      const generated = createBrowserIdentity();
      if (!generated) throw new Error("Browser identity unavailable");
      local.setItem(identityKey, generated);
      if (local.getItem(identityKey) !== generated)
        throw new Error("Browser identity not persisted");
      browserKey = generated;
    }
  } catch {
    warnings.add(COPY.identity);
    return result();
  }

  let sourceCharacters = 0;
  function readSource(key: string): unknown {
    if (sourceCharacters >= MAX_TOTAL_SOURCE_CHARACTERS) {
      warnings.add(COPY.size);
      return undefined;
    }
    let raw: string | null;
    try {
      raw = local.getItem(key);
    } catch {
      warnings.add(COPY.storage);
      return undefined;
    }
    if (raw === null) return undefined;
    if (typeof raw !== "string") {
      warnings.add(COPY.damaged);
      return undefined;
    }
    sourceCharacters += raw.length;
    if (raw.length > MAX_SOURCE_CHARACTERS || sourceCharacters > MAX_TOTAL_SOURCE_CHARACTERS) {
      warnings.add(COPY.size);
      return undefined;
    }
    try {
      return JSON.parse(raw);
    } catch {
      warnings.add(COPY.damaged);
      return undefined;
    }
  }
  function add(
    source: "pauta" | "cierre",
    sourceId: string,
    date: string,
    amountValue: unknown,
    original: Record<string, unknown>,
    payload: Record<string, unknown>,
  ): void {
    const safe = safePayload(payload);
    if (safe !== "ok") {
      warnings.add(COPY[safe]);
      return;
    }
    const amount = exactAmount(amountValue);
    if (amount === null && amountValue !== null) warnings.add(COPY.amount);
    records.push({
      source,
      browserKey,
      sourceId,
      date,
      amount,
      currency: explicitCurrency(original),
      payload,
    });
  }
  function belongsToCompany(original: Record<string, unknown>): boolean {
    if (owns(original, "companyId") && original.companyId !== companyId) {
      warnings.add(COPY.tenant);
      return false;
    }
    return true;
  }

  function* candidates(): Generator<LocalCandidate> {
    const pautaKey = `powip:admin:pauta:${companyId}`;
    const pauta = readSource(pautaKey);
    if (pauta !== undefined && !Array.isArray(pauta)) warnings.add(COPY.damaged);
    if (Array.isArray(pauta)) {
      const sourceIds = new Set<string>();
      for (const original of pauta) {
        let duplicate = false;
        if (
          isObject(original) &&
          validSourceId(original.id) &&
          validDate(original.fecha) &&
          (!owns(original, "companyId") || original.companyId === companyId) &&
          (!owns(original, "lineas") || Array.isArray(original.lineas)) &&
          safePayload({ storageKey: pautaKey, original }) === "ok"
        ) {
          // Retain seen identities across skipped windows, without reserving damaged entries.
          duplicate = sourceIds.has(original.id);
          sourceIds.add(original.id);
        }
        yield { source: "pauta", storageKey: pautaKey, original, duplicate };
      }
    }
    for (const storeId of stores) {
      const key = `powip_cierre_dia_${storeId}`;
      const cierre = readSource(key);
      if (cierre === undefined) continue;
      if (!isObject(cierre)) {
        warnings.add(COPY.damaged);
        continue;
      }
      for (const date of Object.keys(cierre).sort()) {
        const original = cierre[date];
        const platforms = isObject(original)
          ? PLATFORMS.filter(([field]) => owns(original, field))
          : [];
        if (platforms.length === 0) {
          // Damaged or incomplete entries still advance the cursor.
          yield { source: "cierre", storageKey: key, storeId, date, original };
        }
        for (const [field, platform] of platforms) {
          yield { source: "cierre", storageKey: key, storeId, date, field, platform, original };
        }
      }
    }
  }

  let candidateIndex = 0;
  for (const candidate of candidates()) {
    const index = candidateIndex;
    candidateIndex += 1;
    if (index < offset) continue;
    if (index - offset >= MAX_RECORDS) {
      nextOffset = candidateIndex - 1;
      warnings.add(COPY.limit);
      break;
    }
    const entry = candidate.original;
    if (candidate.source === "pauta") {
      if (
        !isObject(entry) ||
        candidate.duplicate ||
        !validSourceId(entry.id) ||
        (owns(entry, "lineas") && !Array.isArray(entry.lineas))
      ) {
        warnings.add(COPY.damaged);
        continue;
      }
      if (!belongsToCompany(entry)) continue;
      if (!validDate(entry.fecha)) {
        warnings.add(COPY.date);
        continue;
      }
      add("pauta", entry.id, entry.fecha, entry.monto, entry, {
        storageKey: candidate.storageKey,
        original: entry,
      });
      continue;
    }
    if (!isObject(entry) || candidate.field === undefined || candidate.platform === undefined) {
      warnings.add(COPY.damaged);
      continue;
    }
    if (!belongsToCompany(entry)) continue;
    if (entry.storeId !== candidate.storeId) {
      warnings.add(COPY.tenant);
      continue;
    }
    if (!validDate(candidate.date) || entry.date !== candidate.date) {
      warnings.add(COPY.date);
      continue;
    }
    add(
      "cierre",
      `${candidate.storeId}:${candidate.date}:${candidate.platform}`,
      candidate.date,
      entry[candidate.field],
      entry,
      {
        storageKey: candidate.storageKey,
        storeId: candidate.storeId,
        platform: candidate.platform,
        original: entry,
      },
    );
  }
  return result();
}
