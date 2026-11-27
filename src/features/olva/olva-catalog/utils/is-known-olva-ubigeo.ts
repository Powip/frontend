import type { OlvaUbigeo } from "../models/olva-ubigeo";

/** Whether Olva knows this ubigeo code: the backend refuses a home delivery to an unknown one. */
export function isKnownOlvaUbigeo(
  index: ReadonlyMap<string, OlvaUbigeo>,
  code: string | null | undefined,
): boolean {
  return Boolean(code) && index.has(code as string);
}
