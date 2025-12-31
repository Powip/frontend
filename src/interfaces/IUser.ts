export interface Role {
  id: string;
  name: string;
  description?: string;
}

export interface User {
  id: string;
  identityDocument: string;
  name: string;
  surname: string;
  email: string;
  address?: string;
  department?: string;
  province?: string;
  district?: string;
  phoneNumber?: string;
  status: boolean;
  role: Role | null;
}
