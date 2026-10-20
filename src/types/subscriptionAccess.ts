/** GET /subscription/subscriptions/access (FEAT-25): acceso de la empresa según la migración a Flow. */
export type AccessState = "OK" | "AVISO" | "BLOQUEADO";

export interface SubscriptionAccess {
  state: AccessState;
  /** Último día con acceso (yyyy-MM-dd, hora de Lima). null si OK. */
  deadline: string | null;
  /** Primer cobro de una migración a Flow programada (yyyy-MM-dd). */
  firstChargeDate: string | null;
  /** false = personal de la empresa. */
  owner: boolean;
}
