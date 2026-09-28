import type { CobroCanal, EntradaCanal } from "../../shared/models/panel-filters.model";

export const FAMILIAS_CANAL = [
  "Online COD",
  "Live",
  "Conversacional",
  "Plataforma aliada",
  "Online prepago",
  "Presencial",
  "Marketplace",
] as const;

export type CampoFichaCanal =
  | "familia"
  | "entrada"
  | "cobro"
  | "usaCourier"
  | "comisionPct"
  | "pasarelaPct"
  | "recibePautaGeneral"
  | "metaMensual"
  | "color"
  | "tienePedidos";

export interface CanalFicha {
  id: string;
  nombre: string;
  clave: string;
  familia: string | null;
  color: string | null;
  entrada: EntradaCanal | null;
  cobro: CobroCanal | null;
  usaCourier: boolean | null;
  comisionPct?: number | null;
  pasarelaPct?: number | null;
  recibePautaGeneral: boolean | null;
  metaMensual: number | null;
  activo: boolean;
  tienePedidos: boolean | null;
  reglasPorConfirmar: boolean;
  camposPendientes: CampoFichaCanal[];
}

export interface CanalFichaGuardar {
  id?: string;
  nombre: string;
  familia: string;
  color: string;
  entrada?: EntradaCanal;
  cobro?: CobroCanal;
  usaCourier?: boolean;
  comisionPct: number;
  pasarelaPct: number;
  recibePautaGeneral: boolean;
  metaMensual: number;
}

export const CAMPOS_BLOQUEADOS_CON_PEDIDOS: CampoFichaCanal[] = ["entrada", "cobro", "usaCourier"];
