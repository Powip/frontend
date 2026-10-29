function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") return value;
  if (Array.isArray(value)) {
    const messages = value.filter((item): item is string => typeof item === "string");
    return messages.length > 0 ? messages.join(" ") : null;
  }
  return null;
}

export function toFieldErrors<Field extends string>(
  details: Record<string, unknown>,
  fields: readonly Field[],
): Partial<Record<Field, string>> {
  const result: Partial<Record<Field, string>> = {};
  const isField = (value: unknown): value is Field =>
    typeof value === "string" && (fields as readonly string[]).includes(value);

  const sources = isRecord(details.fields) ? [details.fields, details] : [details];
  for (const source of sources) {
    for (const field of fields) {
      const message = toMessage(source[field]);
      if (message && !result[field]) result[field] = message;
    }
  }

  for (const key of ["fieldErrors", "errors", "violations"]) {
    const entries = details[key];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (!isRecord(entry) || !isField(entry.field)) continue;
      const message = toMessage(entry.message);
      if (message && !result[entry.field]) result[entry.field] = message;
    }
  }

  return result;
}
