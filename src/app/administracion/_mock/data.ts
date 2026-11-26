/**
 * Tipos del registro manual de publicidad (`_lib/pauta.ts`, `_lib/pautaStorage.ts`, `pauta/ManualAdvertisingPage.tsx`).
 * El registro manual se guarda solo en el navegador, ya no entra en ningún cálculo (FEAT-34, D2) y se retira en la
 * Fase 3. Los meses viven en `_lib/periodo.ts`.
 */

export type PautaLineaTipo = "prod" | "cat" | "gen";

export interface PautaLinea {
  tipo: PautaLineaTipo;
  ref: string; // sku | categoría | "General del canal"
  monto: number;
}
