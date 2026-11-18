const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const MAX_CODE_POINT = 0x10ffff;

function fromCodePoint(codePoint: number, original: string): string {
  if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > MAX_CODE_POINT) {
    return original;
  }

  return String.fromCodePoint(codePoint);
}

/**
 * SUNAT devuelve sus mensajes con entidades HTML sin decodificar
 * ("informaci&#243;n"). Esto las convierte en texto normal sin pasar por
 * `innerHTML`: solo entidades numéricas (`&#243;`, `&#xF3;`) y las nombradas
 * más comunes. Una entidad desconocida o inválida se deja tal cual.
 */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const isHex = entity[1] === "x" || entity[1] === "X";
      const codePoint = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);

      return fromCodePoint(codePoint, match);
    }

    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}
