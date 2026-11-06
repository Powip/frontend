import { TEST_NOW, TEST_SOURCES } from "@/components/panel-control/__tests__/render-with-panel";
import type { CanalFicha } from "@/features/panel-control/canales/models/canal-ficha.model";
import type { CanalesComparativo } from "@/features/panel-control/canales/models/canales-comparativo.model";
import type {
  ConfigComisiones,
  ConfigCouriers,
  ConfigCuadres,
  ConfigEstados,
  ConfigGastosFijos,
} from "@/features/panel-control/configuracion/models/configuracion.model";
import { METAS_ESPECIFICACION } from "@/features/panel-control/shared/config/panel-goals.defaults";
import type {
  PanelSource,
  PanelSourceRegistry,
} from "@/features/panel-control/shared/data/panel-source";
import type { MetasPanel } from "@/features/panel-control/shared/models/goal.model";
import type { PanelEnvelope } from "@/features/panel-control/shared/models/panel-envelope.model";

export function sobre<T>(actual: T): PanelEnvelope<T> {
  return {
    actual,
    anterior_misma_antiguedad: null,
    metas: null,
    generado_en: new Date(TEST_NOW).toISOString(),
  };
}

/** Ficha como la devuelve /panel/canales: porcentajes en FRACCIÓN. */
export const FICHA: CanalFicha = {
  id: "canal-1",
  nombre: "Canal real 1",
  clave: "canal1",
  familia: "Online COD",
  color: null,
  entrada: "lead",
  cobro: null,
  usaCourier: null,
  tipo: "lead",
  comisionPct: 0.125,
  pasarelaPct: 0.035,
  plazoDepositoDias: 7,
  recibePautaGeneral: null,
  metaMensual: 3000,
  activo: true,
  tienePedidos: null,
  reglasPorConfirmar: true,
  camposPendientes: ["cobro"],
};

export function comparativoCon(fichas: CanalFicha[]): PanelSource<"canales-comparativo"> {
  return {
    contractId: "canales-comparativo",
    kind: "real",
    descripcion: "Comparativo de prueba",
    fetch: async () =>
      sobre({
        vista: "ventas",
        canales: fichas,
        filas: [],
        total: {},
        tendencia: [],
        semanaEnCurso: null,
      } as unknown as CanalesComparativo),
  };
}

export const METAS_REALES: MetasPanel = {
  indicadores: METAS_ESPECIFICACION.indicadores,
  mensuales: {
    porCanal: { "canal-1": 3000 },
    porVendedora: { "asesora-1": 8000 },
    porConfirmadora: {},
  },
};

export const COMISIONES: ConfigComisiones = {
  reglas: [
    { rol: "confirmadora", concepto: "por_entrega", valor: 1.5 },
    { rol: "confirmadora", concepto: "pct_upsell", valor: 10 },
    { rol: "vendedora", concepto: "pct_pagado", valor: 2 },
  ],
};
export const GASTOS: ConfigGastosFijos = { gastos: [{ storeId: "tienda-1", montoMensual: 1200 }] };
export const COURIERS: ConfigCouriers = {
  couriers: [
    { key: "olva", nombre: "Olva", plazoLiquidacionDias: 7, tiempoNormalDias: 3 },
    { key: "shalom", nombre: "Shalom", plazoLiquidacionDias: null, tiempoNormalDias: null },
  ],
};

function real<K extends keyof PanelSourceRegistry>(
  contractId: K,
  datos: unknown,
): PanelSource<never> {
  return {
    contractId,
    kind: "real",
    descripcion: "Fuente de prueba",
    fetch: async () => datos,
  } as unknown as PanelSource<never>;
}

export const ESTADOS: ConfigEstados = {
  conteoActual: [
    { estado: "PENDIENTE", pedidos: 4 },
    { estado: "ENTREGADO", pedidos: 6 },
  ],
};

export const CUADRES: ConfigCuadres = {
  cuadres: [],
  calidad: {
    porcentajeCompleto: 0.9,
    pedidosRevisados: 10,
    anulacionesSinMotivo: 1,
    importadosSinCanal: 0,
    ventasConProductoSinCosto: 2,
    productosSinCosto: [{ productoId: "p1", nombre: "Polo" }],
    productosStockNegativo: null,
    avisos: ["No se pudo revisar el stock: ms-logistics no respondió."],
  },
};

export function fuentesConfig(parcial: Partial<Record<string, unknown>> = {}): PanelSourceRegistry {
  return {
    ...TEST_SOURCES,
    "canales-comparativo": comparativoCon([FICHA]),
    "config-metas": real("config-metas", METAS_REALES),
    "config-comisiones": real("config-comisiones", COMISIONES),
    "config-gastos-fijos": real("config-gastos-fijos", GASTOS),
    "config-couriers": real("config-couriers", COURIERS),
    "config-estados": real("config-estados", sobre(ESTADOS)),
    "config-cuadres": real("config-cuadres", sobre(CUADRES)),
    ...(parcial as PanelSourceRegistry),
  } as PanelSourceRegistry;
}
