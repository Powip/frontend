import { useQuery } from "@tanstack/react-query";
import type { ListSunatDocumentsQueryDto } from "../dto/list-sunat-documents-query.dto";
import { SUNAT_DOCUMENT_CDR_STATUSES } from "../enums/sunat-document.enums";
import { sunatDocumentKeys } from "../keys/sunat-document.keys";
import type { ListSunatDocumentsResult } from "../mappers/to-list-sunat-documents.mapper";
import { listSunatDocuments } from "../services/list-sunat-documents.service";

// Polling interval while SUNAT/OSE is still processing a document (ms).
const PENDING_POLL_INTERVAL_MS = 4000;

function hasPendingDocuments(data: ListSunatDocumentsResult | undefined): boolean {
  return (
    data?.documents.some(
      (document) => document.cdrStatus === SUNAT_DOCUMENT_CDR_STATUSES.PENDING,
    ) ?? false
  );
}

export function useListSunatDocuments(query: ListSunatDocumentsQueryDto = {}) {
  return useQuery({
    queryKey: sunatDocumentKeys.list(query),
    queryFn: () => listSunatDocuments(query),
    // The initial POST only enqueues the SUNAT submission; the real CDR
    // (ACCEPTED/REJECTED) arrives later on the backend. Without this, a
    // document can stay stuck showing "Enviado a SUNAT" / "Procesando"
    // indefinitely until the user manually reloads the page. Poll only
    // while at least one document is still PENDING, and stop automatically
    // once everything has resolved.
    refetchInterval: (activeQuery) =>
      hasPendingDocuments(activeQuery.state.data) ? PENDING_POLL_INTERVAL_MS : false,
  });
}
