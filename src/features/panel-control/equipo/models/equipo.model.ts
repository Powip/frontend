export type AgrupacionEquipo = "zona" | "asesora";
export type ModoUpsell = "con" | "sin";

export interface EquipoVendedorasQueryExtra {
  agrupar: AgrupacionEquipo;
  upsell: ModoUpsell;
}

export interface VendedoraMetricas {
  pedidos: number;
  participacion: number | null;
  entregados: number;
  efectividadEntrega: number | null;
  pagado: number;
  pendiente: number;
  perdido: number;
  total: number;
  porcentajePagado: number | null;
  upsellPagado: number;
  conUpsell: number;
  tasaUpsell: number | null;
  entregaConUpsell: number | null;
  ticketEntregado: number | null;
  metaPeriodo: number | null;
  avanceMeta: number | null;
  comisionEstimada?: number;
}

export interface VendedoraGrupo {
  clave: string;
  etiqueta: string;
  asesorId: string | null;
  rol: "vendedora" | "caja" | null;
  metricas: VendedoraMetricas;
  hijos: {
    clave: string;
    etiqueta: string;
    asesorId: string | null;
    rol: "vendedora" | "caja" | null;
    metricas: VendedoraMetricas;
  }[];
}

export interface EquipoVendedorasPanel {
  agrupacion: AgrupacionEquipo;
  upsell: ModoUpsell;
  kpis: {
    pagado: number;
    pendiente: number;
    enCurso: number;
    porLiquidar: number;
    perdido: number;
    total: number;
    ventas: number;
    upsell: number;
  };
  grupos: VendedoraGrupo[];
  total: VendedoraMetricas;
  automaticas: { ventas: number; facturacion: number };
}

export interface ConfirmadoraEquipoFila {
  asesorId: string;
  asesorNombre: string;
  asignados: number;
  contactacion: number | null;
  confirmados: number;
  confirmacion: number | null;
  tiempoPrimeraLlamadaMin: number | null;
  entregados: number;
  efectividadEntrega: number | null;
  anulados: number;
  upsellTasa: number | null;
  upsellPagado: number;
  metaPeriodo: number | null;
  avanceMeta: number | null;
  comisionEstimada?: number;
}

export interface EquipoConfirmadorasPanel {
  kpis: {
    asignados: number;
    porConfirmar: number;
    confirmados: number;
    confirmacion: number | null;
    efectividadEntrega: number | null;
    upsellMonto: number;
    upsellTasa: number | null;
  };
  filas: ConfirmadoraEquipoFila[];
  total: Omit<ConfirmadoraEquipoFila, "asesorId" | "asesorNombre">;
  reglaComision?: { porEntrega: number; porcentajeUpsell: number };
}
