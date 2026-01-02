import axios from "axios";

// Usar la URL base del ms-auth (sin /api/v1 ya que el endpoint lo incluye)
const API_AUTH = process.env.NEXT_PUBLIC_API_USERS?.replace("/api/v1", "") || "http://localhost:8080";

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
    accessToken: string
) => {
    const response = await axios.post(
        `${API_AUTH}/api/v1/auth/company/${companyId}/user`,
        request,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        }
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
    accessToken: string
): Promise<any[]> => {
    const response = await axios.get(
        `${API_AUTH}/api/v1/auth/company/${companyId}/users`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        }
    );
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
    accessToken: string
) => {
    const response = await axios.put(
        `${API_AUTH}/api/v1/auth/user/${userId}`,
        request,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        }
    );
    return response.data;
};
