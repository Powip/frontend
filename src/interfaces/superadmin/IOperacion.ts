/* -----------------------------------------
   8.19 Operación de Red (COD / SUNAT / fraude)
----------------------------------------- */
export interface ICajaCodEmpresa {
  empresaId: string;
  empresaNombre: string;
  gmv: number;
  codEnTransito: number;
  liquidacionPendiente: number;
  morosidadPct: number;
}

export interface ISunatEmpresa {
  empresaId: string;
  empresaNombre: string;
  emite: boolean;
  comprobantesMes: number;
  rechazosMes: number;
  certificadoVence?: string;
}

export type SeveridadFraude = "alta" | "media" | "baja";

export interface IAlertaFraude {
  id: string;
  empresaId: string;
  empresaNombre: string;
  senal: string;
  severidad: SeveridadFraude;
  detectadoEn: string;
}

/* -----------------------------------------
   8.5 Oportunidades
----------------------------------------- */
export interface IRadarUpsell {
  empresaId: string;
  empresaNombre: string;
  plan: string;
  mrrPotencial: number;
  motivo: string;
  caliente: boolean;
}

export interface ISegmentoRed {
  rubro: string;
  count: number;
  mrr: number;
}

export interface ICourierRed {
  courier: string;
  empresasCount: number;
  entregaPct: number;
  devolucionPct: number;
}
