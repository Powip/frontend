import axiosAuth from "@/lib/axiosAuth";
import { GATEWAY } from "@/lib/gateway";

const API_AUTH = GATEWAY.auth;

export interface CreateCompanyUserRequest {
  identityDocument: string;
  name: string;
  surname: string;
  email: string;
  password: string;
  address?: string;
  department?: string;
  province?: string;
  district?: string;
  phoneNumber?: string;
  roleName: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
}

// Crear usuario asociado a una compañía
export const createCompanyUser = async (
  companyId: string,
  request: CreateCompanyUserRequest,
) => {
  const response = await axiosAuth.post(
    `${API_AUTH}/api/v1/auth/company/${companyId}/user`,
    request,
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
  return response.data;
};

// Obtener todos los roles disponibles
export const getRoles = async (): Promise<Role[]> => {
  const response = await axiosAuth.get(`${API_AUTH}/api/v1/roles`);
  return response.data;
};

// Obtener usuarios por compañía
export const getUsersByCompany = async (
  companyId: string,
): Promise<any[]> => {
  const response = await axiosAuth.get(
    `${API_AUTH}/api/v1/auth/company/${companyId}/users`,
  );
  return response.data;
};

// Obtener todos los usuarios de la plataforma
export const getAllUsers = async (): Promise<any[]> => {
  const response = await axiosAuth.get(`${API_AUTH}/api/v1/auth/users`);
  return response.data;
};

export interface UpdateUserRequest {
  name?: string;
  surname?: string;
  address?: string;
  city?: string; // Departamento
  province?: string;
  district?: string;
  phoneNumber?: string;
  roleName?: string;
  password?: string; // Opcional - solo si el admin quiere cambiar la contraseña
}

// Actualizar usuario existente
export const updateUser = async (
  userId: string,
  request: UpdateUserRequest,
) => {
  const response = await axiosAuth.put(
    `${API_AUTH}/api/v1/auth/user/${userId}`,
    request,
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
  return response.data;
};

export const createPlatformUser = async (
  request: CreateCompanyUserRequest,
) => {
  // Mapear CreateCompanyUserRequest a lo que RegisterRequest (backend) espera
  // El backend espera: identityDocument, name, surname, email, password, address, city, province, district, phoneNumber
  const registerPayload = {
    identityDocument: request.identityDocument,
    name: request.name,
    surname: request.surname,
    email: request.email,
    password: request.password,
    address: request.address || 'Pendiente',
    department: request.department || 'LIMA',
    province: request.province || 'LIMA',
    district: request.district || 'LIMA',
    phoneNumber: request.phoneNumber,
    roleName: request.roleName,
  };

  // Validaciones previas al envío
  const missingFields: string[] = [];
  if (!registerPayload.identityDocument) missingFields.push('identityDocument');
  if (!registerPayload.name) missingFields.push('name');
  if (!registerPayload.surname) missingFields.push('surname');
  if (!registerPayload.email) missingFields.push('email');
  if (!registerPayload.password) missingFields.push('password');
  if (!registerPayload.address) missingFields.push('address');
  if (!registerPayload.district) missingFields.push('district');
  if (!registerPayload.phoneNumber) missingFields.push('phoneNumber');

  if (missingFields.length > 0) {
    const msg = `Campos requeridos faltantes: ${missingFields.join(', ')}`;
    throw new Error(msg);
  }

  // Validar regex de password del backend: al menos 6 chars, una minúscula y un número
  const passwordRegex = /^(?=.*[a-z])(?=.*\d).{6,}$/;
  if (!passwordRegex.test(registerPayload.password)) {
    const msg = `La contraseña '${registerPayload.password.slice(0, 4)}...' no cumple el formato requerido (mín. 6 chars, una minúscula, un número)`;
    throw new Error(msg);
  }

  try {
    const response = await axiosAuth.post(`${API_AUTH}/api/v1/auth/admin/register`, registerPayload, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    const data = response.data;

    // Normalizar userId (el backend devuelve el objeto User)
    if (!data.userId && data.id) {
       data.userId = data.id;
    }

    return data;
  } catch (err: any) {
    const backendError = err?.response?.data;
    // Relanzar con mensaje legible
    const errorMsg =
      backendError?.message ||
      (Array.isArray(backendError?.errors) ? backendError.errors.join(', ') : null) ||
      JSON.stringify(backendError) ||
      err.message;
    throw new Error(`ms-auth 400: ${errorMsg}`);
  }
};

// Obtener perfil completo de un usuario por ID
export interface UserProfile {
  id: string;
  name: string;
  surname: string;
  email: string;
  address?: string;
  city?: string;       // Departamento
  province?: string;
  district?: string;
  phoneNumber?: string;
  identityDocument?: string;
  status: boolean;
}

export const getUserProfile = async (
  userId: string,
): Promise<UserProfile | null> => {
  try {
    const response = await axiosAuth.get(
      `${API_AUTH}/api/v1/auth/user/${userId}`,
    );
    return response.data;
  } catch {
    return null;
  }
};

// Eliminar usuario de la plataforma (Rollback)
export const deleteUser = async (
  userId: string,
) => {
  const response = await axiosAuth.delete(`${API_AUTH}/api/v1/auth/user/${userId}`);
  return response.data;
};
