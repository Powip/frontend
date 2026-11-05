export interface CreateOlvaSenderProfileRequestDto {
  label: string;
  ruc: string;
  email: string;
  firstNames: string;
  lastName: string;
  phone?: string;
  isDefault?: boolean;
}
