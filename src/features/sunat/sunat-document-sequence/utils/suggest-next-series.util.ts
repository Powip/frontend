import type { SunatDocumentType } from "../../sunat-document/enums/sunat-document.enums";
import type { SunatDocumentSequence } from "../models/sunat-document-sequence";

const SERIES_PATTERN = /^([A-Z]+)(\d+)$/;

/**
 * Suggests the next series code for a document type by incrementing the
 * numeric suffix of the highest existing series sharing the same letter
 * prefix (e.g. existing F001, F002 -> suggests F003), preserving digit
 * width (F009 -> F010, not F0010).
 *
 * Falls back to `fallbackSeries` (typically the canonical default, e.g.
 * "F001") when the doc type has no existing series yet, or when its
 * existing series don't follow the LETTERS+DIGITS pattern SUNAT expects.
 *
 * This only pre-fills a starting point for the "Agregar serie" form - the
 * user can still type any valid series code themselves.
 */
export function suggestNextSeriesCode(
  existingSequences: SunatDocumentSequence[],
  taxDocumentType: SunatDocumentType,
  fallbackSeries: string,
): string {
  const parsedSeries = existingSequences
    .filter((sequence) => sequence.taxDocumentType === taxDocumentType)
    .map((sequence) => sequence.series.match(SERIES_PATTERN))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({ prefix: match[1], digits: match[2] }));

  const fallbackMatch = fallbackSeries.match(SERIES_PATTERN);
  const fallbackPrefix = fallbackMatch?.[1] ?? fallbackSeries.replace(/\d+$/, "");

  const sameGroup = parsedSeries.filter(({ prefix }) => prefix === fallbackPrefix);

  if (sameGroup.length === 0) {
    return fallbackSeries;
  }

  const highest = sameGroup.reduce((max, current) =>
    Number(current.digits) > Number(max.digits) ? current : max,
  );

  const nextNumber = Number(highest.digits) + 1;
  const nextDigits = String(nextNumber).padStart(highest.digits.length, "0");
  const nextSeries = `${highest.prefix}${nextDigits}`;

  // The series schema caps at 4 chars total - if incrementing would exceed
  // that (e.g. F999 -> F1000), fall back rather than suggest something
  // that'll fail validation on submit.
  return nextSeries.length <= 4 ? nextSeries : fallbackSeries;
}
