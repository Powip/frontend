import type { CrmSettings } from "@/types/crmTeam";

/** Ajustes del bloque E (mockup 152): lo que el servidor devuelve además de `CrmSettings`. */

export type AssignModeE = "manual" | "round_robin" | "least_load";

export const WELCOME_ACTIONS = ["catalogo", "asesora", "pau", "pedido", "mayor"] as const;
export type WelcomeAction = (typeof WELCOME_ACTIONS)[number];

export const WELCOME_ACTION_LABEL: Record<WelcomeAction, string> = {
  catalogo: "Enviar el catálogo",
  asesora: "Pasar con una asesora",
  pau: "Atender con Pau",
  pedido: "Ver su pedido",
  mayor: "Ventas por mayor",
};

export interface WelcomeButton {
  /** WhatsApp acepta hasta 20 caracteres. */
  text: string;
  action: WelcomeAction;
}

export interface StoreWelcome {
  storeId: string;
  enabled: boolean;
  message: string;
  /** Máximo 3 (regla de WhatsApp). */
  buttons: WelcomeButton[];
}

/** Tiendas de cada vendedora. Vacío = todas. */
export interface MemberStores {
  userId: string;
  storeIds: string[];
}

export type AttributionPau = "persona" | "inicio";
export type AttributionCod = "confirma" | "tienda";

export const COD_MAX_USERS = 2;
export const WELCOME_MAX_BUTTONS = 3;
export const WELCOME_BUTTON_MAX = 20;

export interface CrmSettingsE extends Omit<CrmSettings, "assignMode"> {
  assignMode: AssignModeE;
  stickySeller?: boolean;
  showPresence?: boolean;
  attributionDays?: number;
  attributionPau?: AttributionPau;
  attributionCod?: AttributionCod;
  attributionReturning?: boolean;
  codUserIds?: string[];
  welcomeByStore?: StoreWelcome[];
  memberStores?: MemberStores[];
}

export type CrmSettingsEInput = Partial<CrmSettingsE>;

/** Ventas › datos del Core por pedido (V3). */
export interface SalesExtraPayment {
  id: string;
  amount: number;
  method: string | null;
  status: string | null;
  paidAt: string | null;
  proofUrl: string | null;
}

export interface SalesBoardExtra {
  orderId: string;
  city: string | null;
  province: string | null;
  district: string | null;
  units: number | null;
  phone: string | null;
  deliveryType: string | null;
  courier: string | null;
  trackingUrl: string | null;
  guideNumber: string | null;
  paymentMethods: string[];
  payments: SalesExtraPayment[];
}

/** Quién está viendo cada chat. */
export interface PresenceViewer {
  userId: string;
  userName: string;
}

export interface PresenceResponse {
  enabled: boolean;
  viewers: Record<string, PresenceViewer[]>;
}
