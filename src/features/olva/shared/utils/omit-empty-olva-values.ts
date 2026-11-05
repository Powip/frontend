/**
 * Drops `undefined`, `null` and blank-string values from a flat object. The backend validates
 * bodies with strict schemas where a blank optional (`"phone": ""`) is an error, not "absent".
 */
export function omitEmptyOlvaValues<T extends object>(values: T): Partial<T> {
  const result: Partial<T> = {};

  for (const key of Object.keys(values) as (keyof T)[]) {
    const value = values[key];

    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;

    result[key] = typeof value === "string" ? (value.trim() as T[keyof T]) : value;
  }

  return result;
}
