export type DeltaTono = "bueno" | "malo" | "neutro" | "sin_dato";

export interface Delta {
  variacion: number | null;
  tono: DeltaTono;
}

export type SentidoMetrica = "mas_es_mejor" | "menos_es_mejor";
