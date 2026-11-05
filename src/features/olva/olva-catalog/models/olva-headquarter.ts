import type { OlvaPaymentMethod, OlvaWhoPays } from "../../shared/constants/olva-enums.constants";

export interface OlvaPaymentMethodOption {
  code: OlvaPaymentMethod;
  title: string;
  methodId: number;
}

export interface OlvaPaymentModality {
  code: OlvaWhoPays;
  title: string;
  description: string;
  sortOrder: number;
  requiresPaymentMethod: boolean;
  paymentMethods: OlvaPaymentMethodOption[];
}

/** An Olva branch that accepts shipments, with the payment options it offers. */
export interface OlvaHeadquarter {
  id: string;
  /** Official branch name. */
  headquarterName: string;
  /** Short name to show in lists. */
  name: string;
  address: string;
  department: string;
  province: string;
  district: string;
  ubigeoCode: string;
  ubigeoId: string;
  showInsuranceOption: boolean;
  showDeclarationOption: boolean;
  paymentModalities: OlvaPaymentModality[];
}
