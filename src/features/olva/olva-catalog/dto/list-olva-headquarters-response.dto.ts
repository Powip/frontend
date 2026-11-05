import type { OlvaPaymentMethod, OlvaWhoPays } from "../../shared/constants/olva-enums.constants";

// GET /olva/catalog/headquarters -> 200 { results }
export interface OlvaPaymentMethodOptionResponseDto {
  code: OlvaPaymentMethod;
  title: string;
  methodId: number;
}

export interface OlvaPaymentModalityResponseDto {
  code: OlvaWhoPays;
  title: string;
  description: string;
  sortOrder: number;
  requiresPaymentMethod: boolean;
  paymentMethods: OlvaPaymentMethodOptionResponseDto[];
}

export interface OlvaHeadquarterResponseDto {
  headquarterId: string;
  headquarterName: string;
  name: string;
  address: string;
  department: string;
  province: string;
  district: string;
  ubigeoCode: string;
  ubigeoId: string;
  showInsuranceOption: boolean;
  showDeclarationOption: boolean;
  paymentModalities: OlvaPaymentModalityResponseDto[];
}

export interface ListOlvaHeadquartersResponseDto {
  results: OlvaHeadquarterResponseDto[];
}
