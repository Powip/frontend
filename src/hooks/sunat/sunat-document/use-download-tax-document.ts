"use client";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import * as service from "@/services/sunat/sunat-document.service";
import { saveDownloadedFile } from "@/utils/sunat/save-downloaded-file";
import { buildComprobanteFileName, SunatDocument } from "@/models/sunat/sunat-document";

/**
 * No queryKey/mutationKey here on purpose: downloading a PDF/XML
 * doesn't create/update/delete a sunat_documents row, so there's
 * nothing in the query cache to invalidate (unlike
 * useCreateManualInvoice, which invalidates sunatDocumentKeys.lists()
 * after a successful emission). It's also deliberately not a useQuery
 * — we don't want react-query caching a Blob in memory, and a cached
 * signed URL would go stale anyway.
 *
 * Mutation variable is the full SunatDocument (not just externalId) so
 * we can build the exact same filename the backend uses
 * (ruc-docType-series-correlative, raw code, no label) without
 * depending on Content-Disposition making it across the gateway/CORS
 * boundary intact.
 */
export function useDownloadTaxDocument() {
  const pdfMutation = useMutation({
    mutationFn: (doc: SunatDocument) => service.downloadTaxDocumentPdf(doc.externalId),
    onSuccess: (file, doc) => {
      saveDownloadedFile(file, `${buildComprobanteFileName(doc)}.pdf`);
    },
    onError: () => {
      toast.error("No se pudo descargar el PDF del comprobante");
    },
  });

  const xmlMutation = useMutation({
    mutationFn: (doc: SunatDocument) => service.downloadTaxDocumentXml(doc.externalId),
    onSuccess: (file, doc) => {
      saveDownloadedFile(file, `${buildComprobanteFileName(doc)}.zip`);
    },
    onError: () => {
      toast.error("No se pudo descargar el XML del comprobante");
    },
  });

  const isDownloading = (externalId: string, kind: "pdf" | "xml") =>
    kind === "pdf"
      ? pdfMutation.isPending && pdfMutation.variables?.externalId === externalId
      : xmlMutation.isPending && xmlMutation.variables?.externalId === externalId;

  return {
    downloadPdf: pdfMutation.mutate,
    downloadXml: xmlMutation.mutate,
    isDownloading,
  };
}
