/**
 * Heurística local de "más vendidos": cuenta cuántas veces se agregó cada
 * producto al carrito desde este dispositivo, para poder ordenar el listado
 * de productos sin depender de un endpoint de ventas históricas (que hoy no
 * existe en ms-logistics/inventory-item/search).
 */
const STORAGE_PREFIX = "powip.productFreq.";

function storageKey(companyId: string) {
  return `${STORAGE_PREFIX}${companyId}`;
}

export function getProductFrequencies(
  companyId?: string,
): Record<string, number> {
  if (!companyId || typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(companyId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Incrementa el contador del producto y devuelve el mapa actualizado. */
export function bumpProductFrequency(
  companyId: string | undefined,
  productKey: string,
): Record<string, number> {
  const freq = getProductFrequencies(companyId);
  if (!companyId || !productKey) return freq;
  freq[productKey] = (freq[productKey] ?? 0) + 1;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(storageKey(companyId), JSON.stringify(freq));
    } catch {
      // localStorage lleno o deshabilitado — no es crítico, se ignora
    }
  }
  return freq;
}
