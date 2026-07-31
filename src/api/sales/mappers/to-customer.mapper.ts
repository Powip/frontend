import { Customer } from "@/models/sales/customer";
import { CustomerResponseDto } from "../dto/order.dto";

export function toCustomer(
  dto: CustomerResponseDto
): Customer {
  return {
    id: dto.id,
    companyId: dto.companyId,

    documentType: dto.documentType,
    documentNumber: dto.documentNumber,

    fullName: dto.fullName,
    phoneNumber: dto.phoneNumber,
    email: dto.email,

    clientType: dto.clientType,

    province: dto.province,
    city: dto.city,
    district: dto.district,
    address: dto.address,
    reference: dto.reference,
    zone: dto.zone,

    latitude: dto.latitude,
    longitude: dto.longitude,

    isActive: dto.isActive,

    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}
