import { OLVA_SENDER_DOCUMENT_TYPES } from "../constants/olva-sender-profile.constants";
import type { CreateOlvaSenderProfileRequestDto } from "../dto/create-olva-sender-profile-request.dto";
import type { CreateOlvaSenderProfileFormValues } from "../schemas/olva-sender-profile.schema";

export function toCreateOlvaSenderProfileRequestDto(
  values: CreateOlvaSenderProfileFormValues,
): CreateOlvaSenderProfileRequestDto {
  return {
    label: values.label,
    // The form only takes a RUC until Task 18 adds the DNI option
    documentType: OLVA_SENDER_DOCUMENT_TYPES.RUC,
    documentNumber: values.ruc,
    email: values.email,
    firstNames: values.firstNames,
    lastName: values.lastName,
    // The backend validates phone when present, so an empty input is omitted
    phone: values.phone === "" ? undefined : values.phone,
    isDefault: values.isDefault,
  };
}
