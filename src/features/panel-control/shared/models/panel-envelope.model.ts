import type { MetasPanel } from "./goal.model";

export interface PanelEnvelope<T> {
  actual: T;
  anterior_misma_antiguedad: T | null;
  metas: MetasPanel | null;
  generado_en: string;
}
