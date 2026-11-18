import type { SunatDocumentType } from "../../sunat-document/enums/sunat-document.enums";

// Multi-RUC: every key carries the issuer profile so one RUC's series never
// overwrite another's in the cache. `undefined` = the default profile.
const issuerKey = (sunatProfileId?: string) => sunatProfileId ?? "default";

export const sunatDocumentSequenceKeys = {
  all: ["sunat-document-sequences"] as const,
  /** Prefix of every list query - invalidate this to refresh all RUCs. */
  lists: () => [...sunatDocumentSequenceKeys.all, "list"] as const,
  list: (sunatProfileId?: string) =>
    [...sunatDocumentSequenceKeys.lists(), issuerKey(sunatProfileId)] as const,
  detail: (taxDocumentType: SunatDocumentType, series: string, sunatProfileId?: string) =>
    [
      ...sunatDocumentSequenceKeys.all,
      "detail",
      issuerKey(sunatProfileId),
      taxDocumentType,
      series,
    ] as const,
};
