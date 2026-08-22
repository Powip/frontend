import { PlanEmpresa } from "./IEmpresa";

/* -----------------------------------------
   4.7 suscripcion
----------------------------------------- */
export type EstadoSuscripcion = "activa" | "trial" | "vencida" | "cancelada";

export interface ISuscripcion {
  id: string;
  empresaId: string;
  empresaNombre: string;
  plan: PlanEmpresa;
  mrr: number;
  ciclo: "mensual" | "anual";
  estado: EstadoSuscripcion;
  proximoPago: string;
  metodoPago: string;
  addOns: string[];
  creadoEn: string;
}

/* -----------------------------------------
   4.8 factura (SaaS: POWIP -> cliente)
----------------------------------------- */
export type EstadoFactura = "pagado" | "pendiente" | "vencido";

export interface IFactura {
  id: string;
  empresaId: string;
  empresaNombre: string;
  plan: PlanEmpresa;
  monto: number;
  igv: number;
  fechaEmision: string;
  fechaVence: string;
  metodo: string;
  estado: EstadoFactura;
  diasVencida?: number;
  reintentos?: number;
}

/* -----------------------------------------
   12. Métricas y fórmulas — Finanzas POWIP
----------------------------------------- */
export interface IMrrWaterfallItem {
  label: string;
  valor: number;
  tipo: "inicial" | "positivo" | "negativo" | "cierre";
}

export interface IIngresoFuente {
  fuente: "Suscripciones" | "POWIP Payment" | "Add-ons";
  monto: number;
  pct: number;
}

export interface ICobro {
  id: string;
  empresaNombre: string;
  monto: number;
  estado: EstadoFactura | "proyectado";
  fecha: string;
}

/* -----------------------------------------
   8.22 Cohortes
----------------------------------------- */
export interface ICohorte {
  mes: string;
  tamano: number;
  retencion: number[]; // % activo por mes siguiente, índice 0 = mes 0
}

/* -----------------------------------------
   8.9 Suscripciones — KPIs
----------------------------------------- */
export interface IMrrHistorico {
  mes: string;
  mrr: number;
}

export interface IMrrPorPlan {
  plan: PlanEmpresa;
  mrr: number;
  pct: number;
}
