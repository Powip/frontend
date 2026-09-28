import type { Delta, SentidoMetrica } from "../models/comparison.model";

const UMBRAL_NEUTRO = 0.005;

export function calcularDelta(
  actual: number | null | undefined,
  anterior: number | null | undefined,
  sentido: SentidoMetrica = "mas_es_mejor",
): Delta {
  if (
    typeof actual !== "number" ||
    typeof anterior !== "number" ||
    !Number.isFinite(actual) ||
    !Number.isFinite(anterior) ||
    anterior === 0
  ) {
    return { variacion: null, tono: "sin_dato" };
  }
  const variacion = (actual - anterior) / Math.abs(anterior);
  if (Math.abs(variacion) < UMBRAL_NEUTRO) return { variacion, tono: "neutro" };
  const mejora = sentido === "mas_es_mejor" ? variacion > 0 : variacion < 0;
  return { variacion, tono: mejora ? "bueno" : "malo" };
}
