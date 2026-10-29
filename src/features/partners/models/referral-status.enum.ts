export type ReferralStatus =
  | "registrado"
  | "correo_enviado"
  | "cuenta_creada"
  | "activo_sin_pago"
  | "pagando"
  | "en_revision"
  | "cancelado"
  | "desconocido";

export const REFERRAL_STATUSES: ReferralStatus[] = [
  "registrado",
  "correo_enviado",
  "cuenta_creada",
  "activo_sin_pago",
  "pagando",
  "en_revision",
  "cancelado",
  "desconocido",
];
