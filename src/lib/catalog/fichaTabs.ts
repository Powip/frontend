/** Pestañas de la ficha del producto (FEAT-24 H4 y FEAT-32 M1). */
export const FICHA_TABS = ["general", "componentes", "variantes", "lotes", "contenido", "stock", "canales", "historial"] as const;
export type FichaTab = (typeof FICHA_TABS)[number];

/**
 * FEAT-32 M7 — `?tab=` de la URL de la ficha (p. ej. «Editar en la ficha del producto ↗» de POWIP Live abre
 * `?tab=contenido`). Un valor desconocido o ausente abre General, como hasta ahora.
 */
export function fichaTabFromQuery(value: string | string[] | null | undefined): FichaTab {
  const text = (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase();
  return FICHA_TABS.find((tab) => tab === text) ?? "general";
}
