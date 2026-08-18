import type { SunatDocumentType } from "../../sunat-document/enums/sunat-document.enums";

export const sunatDocumentSequenceKeys = {
  all: ["sunat-document-sequences"] as const,

  lists: () => [...sunatDocumentSequenceKeys.all, "list"] as const,

  detail: (taxDocumentType: SunatDocumentType, series: string) =>
    [...sunatDocumentSequenceKeys.all, taxDocumentType, series] as const,
};
