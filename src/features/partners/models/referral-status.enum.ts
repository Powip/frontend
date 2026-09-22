export type ReferralStatus =
  | "correo_enviado"
  | "cuenta_creada"
  | "activo_sin_pago"
  | "pagando"
  | "en_revision"
  | "cancelado";

export const REFERRAL_STATUSES: ReferralStatus[] = [
  "correo_enviado",
  "cuenta_creada",
  "activo_sin_pago",
  "pagando",
  "en_revision",
  "cancelado",
];
