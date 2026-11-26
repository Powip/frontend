import type { DefaultValues } from "react-hook-form";
import type { OlvaSenderProfile } from "../models/olva-sender-profile";
import type {
  CreateOlvaSenderProfileFormValues,
  UpdateOlvaSenderProfileFormValues,
} from "./olva-sender-profile.schema";

export const createOlvaSenderProfileDefaultValues: DefaultValues<CreateOlvaSenderProfileFormValues> =
  {
    label: "",
    ruc: "",
    email: "",
    firstNames: "",
    lastName: "",
    phone: "",
    isDefault: false,
  };

export function toUpdateOlvaSenderProfileDefaultValues(
  profile: OlvaSenderProfile,
): UpdateOlvaSenderProfileFormValues {
  return {
    label: profile.label,
    email: profile.email,
    firstNames: profile.firstNames ?? "",
    lastName: profile.lastName ?? "",
    phone: profile.phone ?? "",
  };
}
