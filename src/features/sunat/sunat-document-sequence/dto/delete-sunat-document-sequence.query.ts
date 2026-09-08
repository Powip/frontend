import type { GetSunatDocumentSequenceQuery } from "./get-sunat-document-sequence.query";

/**
 * The DELETE endpoint accepts the exact same query shape as GET
 * (taxDocumentType + series) - same reuse the backend's own
 * `toDeleteSunatDocumentSequenceQueryMapper` makes off `GetSunatDocumentSequenceQuery`.
 * Kept as its own type alias (rather than importing the GET one directly at
 * every call site) so this endpoint reads as its own thing if it ever needs
 * to diverge.
 */
export type DeleteSunatDocumentSequenceQuery = GetSunatDocumentSequenceQuery;
