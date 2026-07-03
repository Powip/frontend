const KNOWN_JUNK = new Set(['12345678', '87654321']);

/**
 * Returns true when a document number is clearly fabricated/generic.
 * Mirrors the backend's junk-document.util.ts — keep in sync.
 */
export function isJunkDni(value: string | null | undefined): boolean {
  if (value == null || value.trim() === '') return true;
  const normalized = value.trim();
  if (/^(.)\1+$/.test(normalized)) return true;
  return KNOWN_JUNK.has(normalized);
}
