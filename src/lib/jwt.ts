import { jwtDecode } from "jwt-decode";

// Payload raw del JWT — acepta múltiples formatos (ms-auth, Supabase, etc.)
interface RawToken {
  // ms-auth format
  id?: string;
  role?: string;
  companyId?: string;
  permissions?: string[];
  name?: string;
  surname?: string;
  // Supabase / estándar JWT
  sub?: string;
  email?: string;
  app_metadata?: {
    userId?: string;
    role?: string;
    companyId?: string;
    permissions?: string[];
  };
  // Otros posibles nombres
  userId?: string;
  user_id?: string;
  exp: number;
  iat: number;
}

export interface DecodedToken {
  id: string;
  email: string;
  role: string;
  companyId?: string;
  permissions?: string[];
  name?: string;
  surname?: string;
  exp: number;
  iat: number;
}

export const decodeToken = (token: string): DecodedToken | null => {
  try {
    const raw = jwtDecode<RawToken>(token);

    // Extraer userId desde múltiples campos posibles
    const id =
      raw.id ||           // ms-auth: claims.put("id", ...)
      raw.userId ||       // alternativa camelCase
      raw.user_id ||      // alternativa snake_case
      raw.app_metadata?.userId || // Supabase: app_metadata.userId
      raw.sub ||          // JWT estándar: subject (puede ser email o UUID)
      "";

    // Extraer role
    const role =
      raw.role ||
      raw.app_metadata?.role ||
      "";

    // Extraer companyId
    const companyId =
      raw.companyId ||
      raw.app_metadata?.companyId;

    // Extraer permissions
    const permissions =
      raw.permissions ||
      raw.app_metadata?.permissions ||
      [];

    const email = raw.email || "";

    return {
      id,
      email,
      role,
      companyId,
      permissions,
      name: raw.name,
      surname: raw.surname,
      exp: raw.exp,
      iat: raw.iat,
    };
  } catch {
    return null;
  }
};

export const isExpired = (exp: number) => {
  const now = Math.floor(Date.now() / 1000);
  // +30s de margen para clock skew y tokens que expiran durante el request
  return exp < now + 30;
};
