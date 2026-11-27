import type { UpdateOlvaSenderProfileRequestDto } from "../dto/update-olva-sender-profile-request.dto";
import type { UpdateOlvaSenderProfileFormValues } from "../schemas/olva-sender-profile.schema";

export function toUpdateOlvaSenderProfileRequestDto(
  values: UpdateOlvaSenderProfileFormValues,
): UpdateOlvaSenderProfileRequestDto {
  return {
    label: values.label,
    email: values.email,
    firstNames: values.firstNames,
    lastName: values.lastName,
    // null removes the phone override on the backend
    phone: values.phone === "" ? null : values.phone,
  };
}
