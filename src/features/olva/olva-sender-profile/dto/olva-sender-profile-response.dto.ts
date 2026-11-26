export interface OlvaSenderProfileResponseDto {
  id: string;
  label: string;
  ruc: string;
  email: string;

  // Null only on profiles created before these fields existed: complete them with PATCH
  firstNames: string | null;
  lastName: string | null;
  phone: string | null;

  // Business name Olva reported when the RUC was verified
  businessName: string | null;

  isDefault: boolean;

  createdAt: string;
  updatedAt: string;
}
