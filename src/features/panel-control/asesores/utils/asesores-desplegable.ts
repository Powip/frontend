import type { AsesorOpcion } from "../models/asesor-opcion.model";

/**
 * Qué asesoras ofrece el desplegable del filtro: oculta a quien lleva más de 90 días sin actividad
 * (la fuente la marca `inactiva`), salvo que sea la que ya está seleccionada, para no perder el filtro
 * activo. La lista completa sigue disponible para el resto del panel, que necesita todos los nombres.
 * `fijaId` es la asesora fija del rol: el selector ya la muestra aparte.
 */
export function asesoresParaDesplegable(
  asesores: AsesorOpcion[],
  { seleccionadaId, fijaId }: { seleccionadaId?: string | null; fijaId?: string | null },
): AsesorOpcion[] {
  return asesores.filter(
    (asesor) => asesor.id !== fijaId && (!asesor.inactiva || asesor.id === seleccionadaId),
  );
}
