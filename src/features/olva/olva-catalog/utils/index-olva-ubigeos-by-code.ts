import type { OlvaUbigeo } from "../models/olva-ubigeo";

/** Lookup table `code -> ubigeo`; the catalog has thousands of rows, so index it once. */
export function indexOlvaUbigeosByCode(ubigeos: readonly OlvaUbigeo[]): Map<string, OlvaUbigeo> {
  return new Map(ubigeos.map((ubigeo) => [ubigeo.code, ubigeo]));
}
