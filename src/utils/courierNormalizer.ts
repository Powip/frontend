const COURIER_NORMALIZE_MAP: Record<string, string> = {
  "motorizado propio": "Motorizado Propio",
  shalom: "Shalom",
  "olva courier": "Olva Courier",
  marvisur: "Marvisur",
  flores: "Flores",
  aliclik: "Aliclik",
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
