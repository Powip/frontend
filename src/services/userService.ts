import axios from "axios";

// Usar la URL base del ms-auth (sin /api/v1 ya que el endpoint lo incluye)
const API_AUTH =
  process.env.NEXT_PUBLIC_API_USERS?.replace("/api/v1", "") ||
  "http://localhost:8080";

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
  accessToken: string,
) => {
  const response = await axios.post(
    `${API_AUTH}/api/v1/auth/company/${companyId}/user`,
    request,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );
  return response.data;
};

// Obtener todos los roles disponibles
export const getRoles = async (accessToken: string): Promise<Role[]> => {
  const response = await axios.get(`${API_AUTH}/api/v1/roles`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
};

// Obtener usuarios por compañía
export const getUsersByCompany = async (
  companyId: string,
  accessToken: string,
): Promise<any[]> => {
  const response = await axios.get(
    `${API_AUTH}/api/v1/auth/company/${companyId}/users`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  return response.data;
};

// Obtener todos los usuarios de la plataforma
export const getAllUsers = async (accessToken: string): Promise<any[]> => {
  const response = await axios.get(`${API_AUTH}/api/v1/auth/users`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
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
  accessToken: string,
) => {
  const response = await axios.put(
    `${API_AUTH}/api/v1/auth/user/${userId}`,
    request,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );
  return response.data;
};

export const createPlatformUser = async (
  request: CreateCompanyUserRequest,
  accessToken: string,
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
    city: request.department || 'LIMA',
    province: request.province || 'LIMA',
    district: request.district || 'LIMA',
    phoneNumber: request.phoneNumber,
    // roleName no existe en RegisterRequest del backend — se omite intencionalmente
  };

  console.log('[createPlatformUser] Endpoint:', `${API_AUTH}/api/v1/auth/register`);
  console.log('[createPlatformUser] Payload (sin password):', { ...registerPayload, password: '***' });

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
    console.error('[createPlatformUser] Validación fallida:', msg);
    throw new Error(msg);
  }

  // Validar regex de password del backend: al menos 6 chars, una minúscula y un número
  const passwordRegex = /^(?=.*[a-z])(?=.*\d).{6,}$/;
  if (!passwordRegex.test(registerPayload.password)) {
    const msg = `La contraseña '${registerPayload.password.slice(0, 4)}...' no cumple el formato requerido (mín. 6 chars, una minúscula, un número)`;
    console.error('[createPlatformUser] Password inválida:', msg);
    throw new Error(msg);
  }

  try {
    const response = await axios.post(`${API_AUTH}/api/v1/auth/register`, registerPayload, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
    console.log('[createPlatformUser] Respuesta exitosa:', response.status);
    console.log('[createPlatformUser] Response data completa:', response.data);

    // Si el userId no viene en el body, intentar extraerlo del JWT (accessToken)
    const data = response.data;
    if (!data.userId && data.accessToken) {
      try {
        // Decodificar el JWT (sin verificar firma) para extraer el sub (userId)
        const payloadBase64 = data.accessToken.split('.')[1];
        const decoded = JSON.parse(atob(payloadBase64));
        console.log('[createPlatformUser] JWT decoded payload:', decoded);
        // IMPORTANTE: decoded.id = UUID, decoded.sub = email. Usar id.
        data.userId = decoded.id || decoded.userId || decoded.sub;
        console.log('[createPlatformUser] userId extraído del JWT:', data.userId);
      } catch (jwtErr) {
        console.warn('[createPlatformUser] No se pudo decodificar el JWT:', jwtErr);
      }
    }

    return data;
  } catch (err: any) {
    const backendError = err?.response?.data;
    console.error('[createPlatformUser] Error del backend (status:', err?.response?.status, '):', backendError);
    // Relanzar con mensaje legible
    const errorMsg =
      backendError?.message ||
      (Array.isArray(backendError?.errors) ? backendError.errors.join(', ') : null) ||
      JSON.stringify(backendError) ||
      err.message;
    throw new Error(`ms-auth 400: ${errorMsg}`);
  }
};

// Eliminar usuario de la plataforma (Rollback)
export const deleteUser = async (
  userId: string,
  accessToken: string,
) => {
  const response = await axios.delete(`${API_AUTH}/api/v1/auth/user/${userId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data;
};
