import type { DefaultValues } from "react-hook-form";
import type { InitializeSunatDocumentSequenceFormValues } from "./initialize-sunat-document-sequence.schema";

export const initializeSunatDocumentSequenceDefaultValues: DefaultValues<InitializeSunatDocumentSequenceFormValues> =
  {
    taxDocumentType: undefined,
    series: "",
    lastCorrelative: undefined,
  };
