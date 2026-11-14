import type { InitializeSunatDocumentSequenceRequestDto } from "../dto/initialize-sunat-document-sequence-request.dto";
import type { InitializeSunatDocumentSequenceFormValues } from "../schemas/initialize-sunat-document-sequence.schema";

export function toInitializeSunatDocumentSequenceRequestDto(
  values: InitializeSunatDocumentSequenceFormValues,
  sunatProfileId?: string,
): InitializeSunatDocumentSequenceRequestDto {
  return {
    ...(sunatProfileId ? { sunatProfileId } : {}),
    taxDocumentType: values.taxDocumentType,
    series: values.series.trim(),
    lastCorrelative: values.lastCorrelative,
  };
}
