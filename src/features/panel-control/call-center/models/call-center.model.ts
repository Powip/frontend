export interface CallCenterKpis {
  leadsRecibidos: number;
  valorLeads: number;
  porLlamarAhora: number;
  sinIntentoAhora: number;
  tiempoPrimeraLlamadaMin: number | null;
  leadsConPrimeraLlamada: number;
  llamadasTardias: number;
  trabajados: number;
  contactados: number;
  contactacion: number | null;
  confirmados: number;
  anulados: number;
  abiertos: number;
  confirmacion: number | null;
  confirmadosConUpsell: number;
  upsellTasa: number | null;
  upsellMonto: number;
}

export const BUCKETS_ESPERA = ["menos_1h", "1_6h", "6_24h", "mas_24h"] as const;
export type BucketEspera = (typeof BUCKETS_ESPERA)[number];

export const BUCKET_ESPERA_LABEL: Record<BucketEspera, string> = {
  menos_1h: "Menos de 1 hora",
  "1_6h": "1 – 6 horas",
  "6_24h": "6 – 24 horas",
  mas_24h: "Más de 24 horas",
};

export interface ColaEsperaBucket {
  bucket: BucketEspera;
  leads: number;
  sinIntento: number;
}

export interface MotivoAnulacionFila {
  motivo: string;
  sinMotivo: boolean;
  leads: number;
}

export interface CalidadLeads {
  duplicados: number;
  listaNegra: number;
  confirmacionListaNegra: number | null;
  entregaListaNegra: number | null;
  confirmacionTotal: number | null;
  entregaTotal: number | null;
  anuladosSinMotivo: number;
}

export interface CeldaMapaCalor {
  diaSemana: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  hora: number;
  leads: number;
  confirmados: number;
  anulados: number;
  confirmacion: number | null;
}

export interface ConfirmadoraRankingFila {
  asesorId: string | null;
  asesorNombre: string;
  asignados: number;
  trabajados: number;
  contactacion: number | null;
  confirmados: number;
  anulados: number;
  confirmacion: number | null;
  tiempoPrimeraLlamadaMin: number | null;
  upsellTasa: number | null;
  upsellMonto: number;
  entregadosDeConfirmados: number;
  rechazadosDeConfirmados: number;
  entregaDeLoConfirmado: number | null;
  metaPeriodo: number | null;
}

export interface MiDiaConfirmadora {
  asesorId: string;
  asesorNombre: string;
  puesto: number | null;
  totalConfirmadoras: number;
  miCola: number;
  miConfirmacion: number | null;
  confirmacionEquipo: number | null;
  confirmados: number;
  metaPeriodo: number | null;
  upsellMonto: number;
  upsellTasa: number | null;
  upsellTasaEquipo: number | null;
}

export interface CallCenterPanel {
  kpis: CallCenterKpis;
  colaEspera: ColaEsperaBucket[];
  motivosAnulacion: MotivoAnulacionFila[];
  calidad: CalidadLeads;
  mapaCalor: CeldaMapaCalor[];
  ranking: ConfirmadoraRankingFila[];
  miDia: MiDiaConfirmadora | null;
}

export const DIAS_SEMANA_LABEL = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;
export const HORAS_MAPA_CALOR = Array.from({ length: 16 }, (_, index) => index + 8);
