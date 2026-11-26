/** "  Ancash " / "ÁNCASH" -> "ancash": a key to compare place names typed by different people. */
export function normalizeOlvaPlaceName(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
