import type {
  OlvaHeadquarterResponseDto,
  OlvaPaymentModalityResponseDto,
} from "../dto/list-olva-headquarters-response.dto";
import type { OlvaHeadquarter, OlvaPaymentModality } from "../models/olva-headquarter";

function toOlvaPaymentModality(dto: OlvaPaymentModalityResponseDto): OlvaPaymentModality {
  return {
    code: dto.code,
    title: dto.title,
    description: dto.description,
    sortOrder: dto.sortOrder,
    requiresPaymentMethod: dto.requiresPaymentMethod,
    paymentMethods: dto.paymentMethods.map((method) => ({ ...method })),
  };
}

export function toOlvaHeadquarter(dto: OlvaHeadquarterResponseDto): OlvaHeadquarter {
  return {
    id: dto.headquarterId,
    headquarterName: dto.headquarterName,
    name: dto.name,
    address: dto.address,
    department: dto.department,
    province: dto.province,
    district: dto.district,
    ubigeoCode: dto.ubigeoCode,
    ubigeoId: dto.ubigeoId,
    showInsuranceOption: dto.showInsuranceOption,
    showDeclarationOption: dto.showDeclarationOption,
    paymentModalities: dto.paymentModalities.map(toOlvaPaymentModality),
  };
}
