/* -----------------------------------------
   4.9 partner (programa de referidos)
----------------------------------------- */
export type TipoPartner = "Agencia" | "Developer" | "Creador" | "Consultor";
export type OpcionComision = "A" | "B" | "C";
export type EstadoPartner = "activo" | "pendiente" | "suspendido";
export type NivelPartner = "Base" | "Plata" | "Oro";

export interface IPartner {
  id: string;
  nombre: string;
  handle: string;
  tipo: TipoPartner;
  opcionComision: OpcionComision;
  overridePct?: number;
  codigo: string;
  slugLink: string;
  estado: EstadoPartner;
  metodoCobro: string;
  nivel: NivelPartner;
  mrrActivo: number;
  descuentoPartnerPct: number;
  acuerdo: {
    vigenciaHasta?: string;
    exclusividadRubro?: string;
    residualNivel: number;
  };
  referidosCount: number;
  creadoEn: string;
}

/* -----------------------------------------
   referido
----------------------------------------- */
export type EstadoReferido =
  | "pendiente"
  | "aprobado"
  | "activo"
  | "rechazado"
  | "cancelado";

export interface IReferido {
  id: string;
  partnerId: string;
  partnerNombre: string;
  negocio: string;
  email: string;
  origen: string;
  plan: string;
  descuentoPct: number;
  estado: EstadoReferido;
  creadoEn: string;
}

/* -----------------------------------------
   comision
----------------------------------------- */
export type TipoComision = "primer_mes" | "recurrente" | "reverso";
export type EstadoComision = "pendiente" | "liquidada" | "reversada";

export interface IComision {
  id: string;
  partnerId: string;
  referidoId: string;
  referidoNombre: string;
  tipo: TipoComision;
  periodo: string;
  base: number;
  pct: number;
  monto: number;
  estado: EstadoComision;
}

/* -----------------------------------------
   liquidacion
----------------------------------------- */
export type EstadoLiquidacion = "pendiente" | "pagada";

export interface ILiquidacion {
  id: string;
  partnerId: string;
  partnerNombre: string;
  ciclo: string;
  montoBruto: number;
  montoReversos: number;
  retencion: number;
  neto: number;
  estado: EstadoLiquidacion;
}

/* -----------------------------------------
   Reglas del programa
----------------------------------------- */
export interface IConfigPrograma {
  opciones: { id: OpcionComision; firstPct: number; recPct: number }[];
  descuentoMaxPct: number;
  ventanaAtribucionDias: number;
  umbralMinimo: number;
  retencionPct: number;
  nivelPlataMrr: number;
  nivelOroMrr: number;
  antiFraude: boolean;
  clawback: boolean;
}
