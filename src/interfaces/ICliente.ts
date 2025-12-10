export interface Cliente {
  id?: string;
  fullName: string;
  phoneNumber: string;
  clientType: "TRADICIONAL" | "MAYORISTA";
  province: string;
  city: string;
  district: string;
  address: string;
  reference?: string;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
}
