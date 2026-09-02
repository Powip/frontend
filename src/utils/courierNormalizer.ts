const COURIER_NORMALIZE_MAP: Record<string, string> = {
  "motorizado propio": "Motorizado Propio",
  shalom: "Shalom",
  "olva courier": "Olva Courier",
  marvisur: "Marvisur",
  flores: "Flores",
  aliclik: "Aliclik",
  eva: "EVA",
};

export const normalizeCourier = (courier?: string | null): string | null => {
  if (!courier) return null;

  const cleaned = courier.trim().toLowerCase();
  return COURIER_NORMALIZE_MAP[cleaned] || courier.trim();
};

export const isShalomCourier = (courier?: string | null): boolean => {
  return normalizeCourier(courier) === "Shalom";
};

export function isAliclikCourier(courierName?: string | null): boolean {
  return normalizeCourier(courierName) === "Aliclik";
}

export function isEvaCourier(courierName?: string | null): boolean {
  if (!courierName) return false;
  const c = courierName.trim().toLowerCase();
  // "eva" sola, o "eva" como primera palabra: "eva courier", "eva courrier",
  // "eva currier", "eva - fly express", etc. Ancla al inicio para no matchear
  // nombres tipo "nueva agencia" o "Evaristo".
  return /^eva\b/.test(c);
}
