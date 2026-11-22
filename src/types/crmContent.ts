// Contrato de ms-crm para guion, objeciones y fichas de venta.

export interface ScriptStep {
  name: string;
  /** Admite `{nombre}`: primer nombre del contacto. */
  message: string;
  question: string;
}

export type TemperatureKey = "caliente" | "tibio" | "frio";

/** Señal del cliente y jugada que toca. */
export interface ScriptTemperature {
  key: TemperatureKey;
  signal: string;
  play: string;
}

export interface ScriptClosingRules {
  /** HH:mm, hora de Lima: antes se ofrece «despacho hoy». */
  cutoffTime: string;
  /** «Últimas unidades» solo con este stock o menos. */
  lastUnits: number;
  /** Responder al instante a quien llega por un anuncio. */
  instantReply: boolean;
  /** Promo del día, la misma para todas las vendedoras. */
  promo: string;
}

export interface ScriptPlaybookInput {
  temperature?: ScriptTemperature[];
  closingRules?: ScriptClosingRules;
}

export interface Script {
  steps: ScriptStep[];
  temperature: ScriptTemperature[];
  closingRules: ScriptClosingRules;
  /** 0 y sin pasos = aún no hay guion. */
  version: number;
  note: string | null;
  updatedAt: string | null;
  updatedByName: string | null;
  myReadVersion: number;
}

export interface ScriptInput {
  steps: ScriptStep[];
  note?: string;
}

export interface ScriptRead {
  userId: string;
  userName: string;
  readVersion: number;
  readAt: string | null;
  upToDate: boolean;
}

export interface ScriptReads {
  version: number;
  items: ScriptRead[];
}

export interface Objection {
  id: string;
  name: string;
  response: string;
  position: number;
  active: boolean;
  createdAt: string;
  /** Quien la propuso desde un chat (no nulo = propuesta; inactiva hasta que un administrador la apruebe). */
  proposedByName: string | null;
}

export interface ObjectionInput {
  name: string;
  response: string;
}

export interface ObjectionUpdate {
  name?: string;
  response?: string;
  active?: boolean;
  position?: number;
}

export interface ObjectionStat {
  objectionId: string;
  name: string;
  uses: number;
  conversations: number;
  won: number;
  byUser: { userId: string; userName: string; uses: number }[];
}

export interface ObjectionStats {
  days: number;
  total: number;
  items: ObjectionStat[];
}

export type MaterialKind = "photo" | "video" | "audio" | "pdf" | "link";

export interface Material {
  id: string;
  sheetId: string | null;
  kind: MaterialKind;
  title: string;
  url: string;
  position: number;
  /** Método de pago del negocio (Yape, cuenta bancaria…). */
  payment?: boolean;
}

export interface MaterialInput {
  sheetId?: string;
  payment?: boolean;
  kind: MaterialKind;
  title: string;
  url: string;
}

export interface MaterialUpdate {
  kind?: MaterialKind;
  title?: string;
  url?: string;
  position?: number;
}

export interface Sheet {
  id: string;
  name: string;
  price: string | null;
  forWhom: string;
  highlights: string;
  alternatives: string;
  complements: string;
  active: boolean;
  materials: Material[];
  updatedAt: string;
}

export interface SheetInput {
  name: string;
  price?: string;
  forWhom?: string;
  highlights?: string;
  alternatives?: string;
  complements?: string;
}

export type SheetUpdate = Partial<SheetInput> & { active?: boolean };
