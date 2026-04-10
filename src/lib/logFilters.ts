/**
 * Determina si una nota o log debe ser visible para el usuario final.
 * Filtra mensajes técnicos crudos de integraciones (especialmente de Shalom).
 */
export function shouldDisplayNote(text: string | null | undefined): boolean {
  if (!text) return false;

  const technicalPatterns = [
    /Xalom API/i,
    /Shalom API/i,
    /Error de Xalom/i,
    /fetch failed/i,
    /Network Error/i,
    /status code (4|5)\d{2}/i,
    /Sistema Xalon: \d+ envíos fallaron/i,
    /\{.*"error":/i, // JSON crudo con errores
  ];

  // Si coincide con un patrón técnico, no lo mostramos
  return !technicalPatterns.some((pattern) => pattern.test(text));
}

/**
 * Formatea el texto de una nota si es necesario.
 */
export function formatNote(text: string): string {
  // Por ahora solo removemos espacios extra, pero podemos extenderlo
  return text.trim();
}
