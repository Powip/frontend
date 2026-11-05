export interface OlvaSenderProfile {
  id: string;
  label: string;
  ruc: string;
  email: string;

  firstNames: string | null;
  lastName: string | null;
  phone: string | null;

  businessName: string | null;

  isDefault: boolean;

  createdAt: Date;
  updatedAt: Date;
}
