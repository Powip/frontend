/**
 * El campo `courier` de los pedidos es texto libre: un mismo courier llega como «Olva Courier»,
 * «OLVA», «OLVA_COURIER», «Olva » (espacio final)… Los filtros por courier comparan esta clave.
 *
 * Reglas (idénticas a `normalizeCourierKey` de ms-ventas, que filtra en servidor): minúsculas,
 * espacios y «_» colapsados en un espacio, sin espacios en los bordes y sin la palabra final
 * «courier» (siempre que quede algo antes: «Olva Courier» → «olva»; «Courier» sigue igual).
 */
export function normalizeCourierKey(name: string | null | undefined): string {
  return (name ?? "")
    .replace(/[\s_]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/^(.+) courier$/, "$1");
}

/** Cuánto «se lee bien» una grafía ya recortada: sin guion bajo y no toda en mayúsculas. */
function readability(name: string): number {
  return (name.includes("_") ? 0 : 1) + (name !== name.toUpperCase() ? 1 : 0);
}

/** ¿`a` es mejor etiqueta que `b`? Más legible; si empatan, la más corta; si empatan, la alfabética. */
function isBetterLabel(a: { name: string; score: number }, b: { name: string; score: number }): boolean {
  if (a.score !== b.score) return a.score > b.score;
  if (a.name.length !== b.name.length) return a.name.length < b.name.length;
  return a.name.localeCompare(b.name, "es") < 0;
}

/**
 * Opciones del desplegable de courier: una por courier, aunque los pedidos lo tengan guardado de
 * varias formas. Si el courier está configurado en la empresa (`preferred`) se muestra con ese nombre;
 * si no, con la grafía más legible. Ordenadas y sin valores vacíos.
 */
export function courierOptions(names: readonly string[], preferred: readonly string[] = []): string[] {
  const best = new Map<string, { name: string; score: number }>();
  for (const raw of [...preferred, ...names]) {
    const key = normalizeCourierKey(raw);
    if (!key) continue;
    const name = raw.trim();
    const candidate = { name, score: preferred.includes(raw) ? 4 : readability(name) };
    const current = best.get(key);
    if (!current || isBetterLabel(candidate, current)) best.set(key, candidate);
  }
  return Array.from(best.values(), ({ name }) => name).sort((a, b) => a.localeCompare(b, "es"));
}

/** La opción equivalente al valor elegido (otra grafía del mismo courier), o el valor tal cual si no hay. */
export function matchCourierOption(options: readonly string[], value: string): string {
  const key = normalizeCourierKey(value);
  if (!key) return "";
  return options.find((option) => normalizeCourierKey(option) === key) ?? value;
}
