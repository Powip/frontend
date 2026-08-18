import type { DefaultValues } from "react-hook-form";
import { COUNTRY_CODES } from "../../shared/enums/sunat.enums";
import type { CreateSunatProfileFormValues } from "./create-sunat-profile.schema";

export const createSunatProfileDefaultValues: DefaultValues<CreateSunatProfileFormValues> = {
  name: "",
  description: "",
  ruc: "",
  razonSocial: "",
  countryCode: COUNTRY_CODES.PERU,
  ubigeo: "",
  address: "",
  establishmentCode: "",
  solUser: "",
  solPassword: "",
  certificatePassword: "",
  certificate: undefined,
  logo: undefined,
};
