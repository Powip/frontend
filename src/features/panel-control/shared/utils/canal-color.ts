import { hashSeed } from "../data/demo/seeded-random";
import { SERIES_COLORS } from "./chart";

export const COLOR_SIN_CANAL = "var(--pc-text-soft)";

export function colorCanal(canalId: string | null, colorFicha: string | null = null): string {
  if (colorFicha) return colorFicha;
  if (!canalId) return COLOR_SIN_CANAL;
  return SERIES_COLORS[hashSeed(canalId) % SERIES_COLORS.length];
}
