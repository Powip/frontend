import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderWithPanel,
  TEST_SOURCES,
} from "@/components/panel-control/__tests__/render-with-panel";
import type { DetalleResponse } from "@/features/panel-control/detalle/models/detalle.model";
import {
  type ColaPanel,
  ETAPAS_OPERATIVAS,
} from "@/features/panel-control/operaciones/models/cola.model";
import type { CouriersPanel } from "@/features/panel-control/operaciones/models/couriers.model";
import type { InventarioPanel } from "@/features/panel-control/operaciones/models/inventario.model";
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

export const COLA: ColaPanel = {
  kpis: {
    colaActiva: 12,
    sinGuiaMas24h: 3,
    enviosRetrasados: 1,
    enviosSinTiempoNormal: 0,
    diasConfirmadoAEntregado: 2.5,
    entregasMedidas: 8,
    entregados: 20,
    rechazados: 4,
    incidenciaRechazo: 0.1667,
  },
  matriz: [
    {
      estado: "LLAMADO",
      accion: "preparar",
      porAntiguedad: { menos_24h: 1, "1_2d": 1, "3_5d": 1, mas_5d: 1 },
      total: 4,
      sinFecha: 0,
    },
    {
      estado: "PREPARADO",
      accion: "asignar_guia",
      porAntiguedad: { menos_24h: 1, "1_2d": 1, "3_5d": 1, mas_5d: 1 },
      total: 4,
      sinFecha: 0,
    },
    {
      estado: "CON_GUIA",
      accion: "coordinar_recojo",
      porAntiguedad: { menos_24h: 1, "1_2d": 1, "3_5d": 1, mas_5d: 1 },
      total: 4,
      sinFecha: 0,
    },
    {
      estado: "EN_ENVIO",
      accion: "reclamar_courier",
      porAntiguedad: { menos_24h: 1, "1_2d": 1, "3_5d": 1, mas_5d: 1 },
      total: 4,
      sinFecha: 0,
    },
  ],
  tiemposPorEtapa: ETAPAS_OPERATIVAS.map((etapa) => ({
    etapa,
    medianaHoras: 10,
    metaHoras: 12,
    pedidosMedidos: 8,
    sobreMeta: 2,
    sinFechas: 0,
  })),
  despachosPorDia: [{ dia: "2026-09-20", despachados: 2 }],
  motivosRechazo: [
    { motivo: "Cliente no estaba", sinMotivo: false, pedidos: 3 },
    { motivo: "Sin motivo", sinMotivo: true, pedidos: 1 },
  ],
};

export const COURIERS: CouriersPanel = {
  kpis: {
    envios: 10,
    entregados: 6,
    rechazados: 2,
    enTransito: 2,
    efectividadEntrega: 0.75,
    primerIntento: null,
    entregasSinDatoPrimerIntento: 6,
    diasEntrega: 3.2,
    fletePromedio: null,
    fleteTotal: null,
    enviosSinFlete: 7,
    porLiquidar: 800,
    pedidosPorLiquidar: 4,
    liquidacionVencida: 120,
    pedidosVencidos: 1,
    porLiquidarSinPlazo: 0,
  },
  couriers: [
    {
      courierId: "shalom",
      nombre: "Shalom",
      tipo: null,
      plazoLiquidacionDias: 7,
      tiempoNormalDias: null,
      envios: 7,
      entregados: 4,
      rechazados: 2,
      enTransito: 1,
      efectividad: 0.67,
      primerIntento: null,
      diasPromedio: 3,
      fletePromedio: null,
      fleteTotal: null,
      costoRechazos: null,
      porLiquidar: 500,
      vencido: 0,
      score: "C",
    },
    {
      courierId: "olva",
      nombre: "Olva",
      tipo: null,
      plazoLiquidacionDias: 7,
      tiempoNormalDias: null,
      envios: 3,
      entregados: 2,
      rechazados: 0,
      enTransito: 1,
      efectividad: 1,
      primerIntento: null,
      diasPromedio: 4,
      fletePromedio: 15,
      fleteTotal: 450,
      costoRechazos: 0,
      porLiquidar: 300,
      vencido: 120,
      score: "A",
    },
  ],
  departamentos: [
    {
      departamento: "Lima",
      envios: 7,
      entregados: 4,
      rechazados: 2,
      efectividad: 0.67,
      courierPrincipal: "Shalom",
      ticket: 120,
      fletePromedio: null,
    },
  ],
};

export const INVENTARIO: InventarioPanel = {
  kpis: {
    productos: 4,
    sinCosto: 1,
    valorAlCosto: 1500,
    agotados: 1,
    criticos: 1,
    erroresDatos: 0,
    ventasEsperandoStock: 0,
  },
  productos: [
    {
      productoId: "var-1",
      sku: "POLO-1",
      nombre: "Polo básico",
      tiendaId: "tienda-1",
      unidades30Dias: 30,
      stock: 20,
      reservado: 5,
      disponible: 15,
      ventaDiaria: 1,
      coberturaDias: 15,
      estado: "bajo",
      costoUnitario: 25,
      valor: 500,
    },
  ],
};

/** Con `mostrarCostos` en false el backend OMITE las claves de costos (no van en null ni en 0). */
export const INVENTARIO_SIN_COSTOS: InventarioPanel = {
  kpis: {
    productos: 4,
    sinCosto: 4,
    agotados: 1,
    criticos: 1,
    erroresDatos: 0,
    ventasEsperandoStock: 0,
  },
  productos: [
    {
      productoId: "var-1",
      sku: "POLO-1",
      nombre: "Polo básico",
      tiendaId: "tienda-1",
      unidades30Dias: 30,
      stock: 20,
      reservado: 5,
      disponible: 15,
      ventaDiaria: 1,
      coberturaDias: 15,
      estado: "bajo",
    },
  ],
};

/** El mismo producto en tres tiendas físicas: el backend devuelve una fila por (tienda, variante). */
export const INVENTARIO_MULTITIENDA: InventarioPanel = {
  kpis: { ...INVENTARIO.kpis, productos: 4, sinCosto: 0 },
  productos: [
    { ...INVENTARIO.productos[0], tiendaId: "tienda-1", stock: 20, disponible: 15 },
    { ...INVENTARIO.productos[0], tiendaId: "tienda-2", stock: 7, reservado: 2, disponible: 5 },
    { ...INVENTARIO.productos[0], tiendaId: "tienda-3", stock: 3, reservado: 1, disponible: 2 },
    {
      ...INVENTARIO.productos[0],
      productoId: "var-2",
      sku: "POLO-2",
      nombre: "Polo estampado",
      tiendaId: "tienda-1",
      stock: 50,
      reservado: 0,
      disponible: 50,
    },
  ],
};

export const DETALLE_VACIO: DetalleResponse = {
  resumen: { facturacion: 0, ventas: 0, unidades: 0, ticket: null },
  pedidos: { filas: [], total: 0, pagina: 1, tamanoPagina: 100 },
  porProducto: [],
  porEstado: [],
};

export function real<
  K extends "operaciones-cola" | "operaciones-couriers" | "operaciones-inventario",
>(contractId: K, fetch: PanelSource<K>["fetch"]): PanelSource<K> {
  return { contractId, kind: "real", descripcion: `Prueba ${contractId}`, fetch };
}

export function fuentes(
  opciones: {
    couriers?: PanelSource<"operaciones-couriers">["fetch"];
    inventario?: PanelSource<"operaciones-inventario">["fetch"];
    detalle?: PanelSource<"detalle">["fetch"];
  } = {},
): PanelSourceRegistry {
  return {
    ...TEST_SOURCES,
    // El estado del periodo también viene del backend: así cualquier «Demo» que aparezca es de Operaciones.
    "estado-periodo": {
      ...TEST_SOURCES["estado-periodo"],
      kind: "real",
    } as PanelSource<"estado-periodo">,
    "operaciones-cola": real("operaciones-cola", async () => sobre(COLA)),
    "operaciones-couriers": real(
      "operaciones-couriers",
      opciones.couriers ?? (async () => sobre(COURIERS)),
    ),
    "operaciones-inventario": real(
      "operaciones-inventario",
      opciones.inventario ?? (async () => sobre(INVENTARIO)),
    ),
    detalle: {
      contractId: "detalle",
      kind: "real",
      descripcion: "Detalle de prueba",
      fetch: opciones.detalle ?? (async () => DETALLE_VACIO),
    },
  };
}

export function renderOperaciones(subtab: PanelSubtabId, sources: PanelSourceRegistry) {
  const user = userEvent.setup();
  renderWithPanel(<PanelShell />, {
    role: "dueno",
    sources,
    state: { ...DEFAULT_PANEL_STATE, navigation: { tab: "operaciones", subtab } },
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
