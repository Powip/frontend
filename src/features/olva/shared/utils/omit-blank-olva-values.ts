/**
 * Trims every string value and drops the blank ones, so `{ q: "  " }` and `{}` are the same
 * filter (and the same query key). The backend already reads a blank filter as "no filter".
 */
export function omitBlankOlvaValues<T extends Record<string, string | undefined>>(
  values: T,
): Partial<T> {
  const result: Partial<T> = {};

  for (const key of Object.keys(values) as (keyof T)[]) {
    const trimmed = values[key]?.trim();

    if (trimmed) {
      result[key] = trimmed as T[keyof T];
    }
  }

  return result;
}
