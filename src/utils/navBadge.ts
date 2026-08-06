/**
 * Fecha límite hasta la que se muestra un badge "Nuevo"/"Actualizado" en la
 * navegación — pasado ese día desaparece solo, sin tener que volver a tocar
 * el código. Compartido por el Sidebar y tabs sueltos (ej. Cierre del Día).
 */
export function isBadgeActive(badgeUntil?: string): boolean {
  if (!badgeUntil) return false;
  return new Date() < new Date(badgeUntil);
}
