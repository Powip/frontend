import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderWithPanel,
  TEST_SOURCES,
} from "@/components/panel-control/__tests__/render-with-panel";
import type { DetalleResponse } from "@/features/panel-control/detalle/models/detalle.model";
import type { CajaPanel } from "@/features/panel-control/finanzas/models/caja.model";
import type { CobranzaPanel } from "@/features/panel-control/finanzas/models/cobranza.model";
import type { ResultadoPanel } from "@/features/panel-control/finanzas/models/resultado.model";
import type {
  PanelSource,
  PanelSourceRegistry,
} from "@/features/panel-control/shared/data/panel-source";
import type { PanelEnvelope } from "@/features/panel-control/shared/models/panel-envelope.model";
import type { PanelSubtabId } from "@/features/panel-control/shared/models/panel-navigation.model";
import { DEFAULT_PANEL_STATE } from "@/features/panel-control/shared/state/panel-state.model";
import { PanelShell } from "../shell/PanelShell";

export const sobre = <T,>(actual: T): PanelEnvelope<T> => ({
  actual,
  anterior_misma_antiguedad: null,
  metas: null,
  generado_en: "2026-09-21T21:00:00Z",
});

/** Lo que construye axios ante una respuesta HTTP con error. */
export function errorHttp(status: number, message?: string) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status, data: message ? { message } : {} },
  });
}

/** Facturado 1000 = pagado 300 + por liquidar 200 + en curso 350 + perdido 100 + reembolsado 50. */
export const RESULTADO: ResultadoPanel = {
  diasPeriodo: 28,
  facturadoAlDinero: {
    facturado: 1000,
    entregado: 600,
    pagado: 300,
    porLiquidar: 200,
    vencido: null,
    enCurso: 350,
    perdido: 100,
    reembolsado: 50,
    adelantosRecibidos: null,
  },
  estadoResultados: {
    ventaEntregada: 600,
    costoProducto: 200,
    entregasSinCosto: 3,
    entregasSinFlete: 2,
    entregasSinComision: 1,
    publicidadDirecta: null,
    publicidadGeneralEstimada: null,
    envios: 60,
    comisiones: 30,
    ganancia: 310,
    gastosFijos: null,
    gastosFijosMensuales: null,
    utilidadOperativa: null,
    gananciaParcial: true,
  },
  puntoEquilibrio: {
    gananciaPorEntrega: null,
    entregasNecesarias: null,
    entregasLogradas: 12,
    margenSeguridad: null,
    fletePromedioPorRechazo: null,
  },
  evolucionMensual: [
    { mes: "2026-08", enCurso: false, facturado: 800, entregado: 500, pagado: 400 },
    { mes: "2026-09", enCurso: true, facturado: 1000, entregado: 600, pagado: 300 },
  ],
  rentabilidadPorCanal: [
    {
      canalId: "canal-1",
      canalNombre: "Canal Uno",
      entregado: 400,
      ganancia: null,
      gananciaParcial: true,
      margen: null,
      retornoPublicidad: null,
    },
    {
      canalId: null,
      canalNombre: "Sin canal",
      entregado: 200,
      ganancia: 90,
      gananciaParcial: true,
      margen: 0.45,
      retornoPublicidad: null,
    },
  ],
};

/** Todo lo que el backend puede mandar en null, en null. */
export const RESULTADO_TODO_NULL: ResultadoPanel = {
  ...RESULTADO,
  estadoResultados: {
    ...RESULTADO.estadoResultados,
    costoProducto: null,
    envios: null,
    comisiones: null,
    ganancia: null,
    entregasSinCosto: 0,
    entregasSinFlete: 0,
    entregasSinComision: 0,
  },
};

export const CAJA: CajaPanel = {
  entradas: [
    { concepto: "liquidacion_courier", monto: 500, pedidos: 5 },
    { concepto: "liquidacion_marketplace", monto: 0, pedidos: 0 },
    { concepto: "caja_pos", monto: 120, pedidos: 2 },
    { concepto: "prepago", monto: 80, pedidos: 1 },
    { concepto: "adelantos", monto: null, pedidos: null },
  ],
  salidas: [
    { concepto: "publicidad", monto: null, pedidos: null },
    { concepto: "fletes", monto: 90, pedidos: 6 },
    { concepto: "pasarela", monto: null, pedidos: null },
    { concepto: "comisiones_aliados", monto: null, pedidos: null },
    { concepto: "reembolsos", monto: 50, pedidos: 1 },
    { concepto: "gastos_fijos", monto: null, pedidos: null },
  ],
  totalEntro: 700,
  totalSalio: 140,
  netoCaja: 560,
  promedioDiarioEntra: 25,
  dias: 28,
  porDia: [
    { dia: "2026-09-19", entro: 300, salio: 40 },
    { dia: "2026-09-20", entro: 400, salio: 100 },
  ],
  incluyeComprasMercaderia: false,
};

export const COBRANZA: CobranzaPanel = {
  kpis: {
    porLiquidar: 800,
    pedidosPorLiquidar: 4,
    vencido: 120,
    pedidosVencidos: 1,
    enCurso: 300,
    pedidosEnCurso: 3,
    adelantosDeNoEntregadas: null,
    porLiquidarSinPlazo: 0,
  },
  liquidacionesPendientes: [
    {
      courierId: "olva",
      courier: "Olva",
      plazoDias: 7,
      pedidos: 3,
      monto: 500,
      diasMasAntiguo: 9,
      vencido: 120,
    },
    {
      courierId: "shalom",
      courier: "Shalom",
      plazoDias: null,
      pedidos: 1,
      monto: 300,
      diasMasAntiguo: 2,
      vencido: null,
    },
  ],
  antiguedad: [
    { bucket: "0_3d", monto: 300, pedidos: 1 },
    { bucket: "4_7d", monto: 200, pedidos: 1 },
    { bucket: "8_14d", monto: 200, pedidos: 1 },
    { bucket: "mas_14d", monto: 100, pedidos: 1 },
  ],
};

/** Sin ningún courier con plazo: el vencido no se puede juzgar. */
export const COBRANZA_SIN_PLAZO: CobranzaPanel = {
  ...COBRANZA,
  kpis: { ...COBRANZA.kpis, vencido: null, pedidosVencidos: null },
  liquidacionesPendientes: COBRANZA.liquidacionesPendientes.map((fila) => ({
    ...fila,
    plazoDias: null,
    vencido: null,
  })),
};

export const DETALLE_VACIO: DetalleResponse = {
  resumen: { facturacion: 0, ventas: 0, unidades: 0, ticket: null },
  pedidos: { filas: [], total: 0, pagina: 1, tamanoPagina: 100 },
  porProducto: [],
  porEstado: [],
};

type FinanzasId = "finanzas-resultado" | "finanzas-caja" | "finanzas-cobranza";

export function real<K extends FinanzasId>(
  contractId: K,
  fetch: PanelSource<K>["fetch"],
): PanelSource<K> {
  return { contractId, kind: "real", descripcion: `Prueba ${contractId}`, fetch };
}

export function fuentes(
  opciones: {
    resultado?: PanelSource<"finanzas-resultado">["fetch"];
    caja?: PanelSource<"finanzas-caja">["fetch"];
    cobranza?: PanelSource<"finanzas-cobranza">["fetch"];
    detalle?: PanelSource<"detalle">["fetch"];
  } = {},
): PanelSourceRegistry {
  return {
    ...TEST_SOURCES,
    // El estado del periodo también viene del backend: así cualquier «Demo» que aparezca es de Finanzas.
    "estado-periodo": {
      ...TEST_SOURCES["estado-periodo"],
      kind: "real",
    } as PanelSource<"estado-periodo">,
    "finanzas-resultado": real(
      "finanzas-resultado",
      opciones.resultado ?? (async () => sobre(RESULTADO)),
    ),
    "finanzas-caja": real("finanzas-caja", opciones.caja ?? (async () => sobre(CAJA))),
    "finanzas-cobranza": real(
      "finanzas-cobranza",
      opciones.cobranza ?? (async () => sobre(COBRANZA)),
    ),
    detalle: {
      contractId: "detalle",
      kind: "real",
      descripcion: "Detalle de prueba",
      fetch: opciones.detalle ?? (async () => DETALLE_VACIO),
    },
  };
}

export function renderFinanzas(subtab: PanelSubtabId, sources: PanelSourceRegistry) {
  const user = userEvent.setup();
  renderWithPanel(<PanelShell />, {
    role: "dueno",
    sources,
    state: { ...DEFAULT_PANEL_STATE, navigation: { tab: "finanzas", subtab } },
  });
  return user;
}

export const region = (nombre: string) => screen.getByRole("region", { name: nombre });

/** La tarjeta de un indicador, ya con sus datos (mientras carga también es una región con ese nombre). */
export async function tarjetaCargada(nombre: string) {
  await screen.findByRole("region", { name: nombre });
  await waitFor(() =>
    expect(screen.queryByRole("status", { name: `Cargando ${nombre}` })).toBeNull(),
  );
  return region(nombre);
}
