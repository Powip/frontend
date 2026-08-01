export interface CreateSunatProfileRequestDto {
  name: string;
  description?: string;
  ruc: string;
  razonSocial: string;
  ubigeo: string;
  address: string;
  solUser: string;
  solPassword: string;
  certificatePassword: string;
  certificate: File;
  isDefault?: boolean;
}

export interface SunatProfileResponseDto {
  id: string;
  companyId: string;
  name: string;
  description: string;
  ruc: string;
  razonSocial: string;
  ubigeo: string;
  address: string;
  certificateSubject: string;
  certificateSerial: string;
  certificateValidFrom: string;
  certificateValidUntil: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
