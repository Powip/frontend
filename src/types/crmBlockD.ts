/** Tipos del bloque D del CRM (mockup 152): Equipo, Objeciones VRPC y Auditoría por producto. */

export type ReviewKind = "good" | "slow" | "unanswered" | "lost";

export interface TeamBoardReview {
  conversationId: string;
  contactName: string | null;
  userId: string | null;
  userName: string | null;
  kind: ReviewKind;
  step: number | null;
  detail: string;
}

export interface TeamBoardMember {
  userId: string;
  userName: string;
  online: boolean;
  storeIds: string[];
  inRotation: boolean;
  openChats: number;
  unanswered: number;
  avgFirstResponseMinutes: number | null;
  fastestSaleMinutes: number | null;
  callSales: number;
  deliveredMonth: number;
  soldToday: number;
  ordersMonth: number;
  conversionPercent: number | null;
}

export interface TeamBoardWaiting {
  conversationId: string;
  contactName: string | null;
  storeId: string | null;
  assignedUserId: string | null;
  assignedUserName: string | null;
  waitingMinutes: number;
}

export interface TeamBoard {
  storeId: string | null;
  slaMinutes: number;
  dailyGoal: number;
  kpis: {
    chatsToday: number;
    storesToday: number;
    sellers: number;
    avgFirstResponseMinutes: number | null;
    lostToday: number;
    deliveredMonth: number;
  };
  waiting: TeamBoardWaiting[];
  members: TeamBoardMember[];
  reviews: TeamBoardReview[];
}

export type ObjectionFamily = "precio" | "confianza" | "eficacia" | "tiempo" | "logistica";

export const OBJECTION_FAMILIES: Record<ObjectionFamily, { label: string; says: string; feels: string; lever: string }> = {
  precio: { label: "Precio", says: "«Está caro», «¿no hay descuento?»", feels: "No ve el valor", lever: "Costo por día, pack, comparación" },
  confianza: {
    label: "Confianza",
    says: "«¿Es original?», «¿y si es estafa?»",
    feels: "Miedo a perder su dinero",
    lever: "Contraentrega, fotos reales, testimonios",
  },
  eficacia: {
    label: "Eficacia",
    says: "«¿Funciona de verdad?»",
    feels: "Ya probó algo que no funcionó",
    lever: "Prueba social, cómo funciona, tiempos honestos",
  },
  tiempo: {
    label: "Tiempo",
    says: "«Lo voy a pensar», «más tarde»",
    feels: "Duda sin nombrar o falta de urgencia",
    lever: "Pregunta abierta + reserva sin compromiso",
  },
  logistica: {
    label: "Logística",
    says: "«¿Llega a mi ciudad?», «no tengo Yape»",
    feels: "Fricción operativa",
    lever: "Resolver el detalle y cerrar",
  },
};

/** Campos que el backend añadió a cada objeción (familia VRPC y acción del negocio). */
export interface ObjectionExtra {
  id: string;
  family?: ObjectionFamily;
  businessAction?: string;
  actionDoneAt?: string | null;
}

export interface ObjectionStatD {
  objectionId: string;
  name: string;
  family: ObjectionFamily;
  uses: number;
  previousUses: number;
  conversations: number;
  won: number;
  byUser: { userId: string; userName: string; uses: number; won: number }[];
  phrases: string[];
}

export interface ObjectionStatsD {
  days: number;
  storeId: string | null;
  total: number;
  previousTotal: number;
  items: ObjectionStatD[];
}

export type CheckState = "ok" | "missing" | "na" | "partial";
export type ScriptSource = "producto" | "categoria" | "tienda" | "general" | "metodologia";

export interface AuditProductRow {
  id: string;
  name: string;
  storeId: string | null;
  category: string | null;
  scriptSource: ScriptSource;
  sheet: CheckState;
  sheetMissing: string[];
  photos: CheckState;
  photoCount: number;
  sizes: CheckState;
  testimonies: CheckState;
  videoAudio: CheckState;
  status: "ok" | "missing" | "bad";
  missing: string[];
}

export interface AuditReadCell {
  storeId: string;
  state: "read" | "old" | "unread" | "not_assigned";
  readVersion: number;
}

export interface AuditD {
  score: number;
  storeId: string | null;
  stores: string[];
  readiness: { percent: number; productsOk: number; products: number; withMissing: number; problems: number };
  products: AuditProductRow[];
  sheets: { id: string; name: string; status: "ok" | "warn" | "bad"; missing: string[] }[];
  problems: { severity: "bad" | "warn" | "info"; code: string; title: string; detail: string; href: string | null }[];
  script: {
    version: number;
    items: { userId: string; userName: string; readVersion: number | null; readAt: string | null; upToDate: boolean }[];
  };
  readsByStore: Record<string, AuditReadCell[]>;
}
