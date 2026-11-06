import type {
  AccionPedidoRequest,
  AccionPedidoResponse,
} from "../../acciones/models/accion-pedido.model";
import type { AsesoresQuery, AsesorOpcion } from "../../asesores/models/asesor-opcion.model";
import type { CallCenterPanel } from "../../call-center/models/call-center.model";
import type { CanalDetalle } from "../../canales/models/canal-detalle.model";
import type { CanalFicha, CanalFichaGuardar } from "../../canales/models/canal-ficha.model";
import type {
  CanalesComparativo,
  CanalesComparativoQueryExtra,
} from "../../canales/models/canales-comparativo.model";
import type { ClientesZonasPanel } from "../../clientes-zonas/models/clientes-zonas.model";
import type {
  ConfigCuadres,
  ConfigEstados,
  ConfigMetas,
  ConfigMetasGuardar,
} from "../../configuracion/models/configuracion.model";
import type { DetalleQuery, DetalleResponse } from "../../detalle/models/detalle.model";
import type {
  EquipoConfirmadorasPanel,
  EquipoVendedorasPanel,
  EquipoVendedorasQueryExtra,
} from "../../equipo/models/equipo.model";
import type { EstadoPeriodo } from "../../estado-periodo/models/estado-periodo.model";
import type {
  CompartirReporteResponse,
  ExportLibroQuery,
  ExportLibroResponse,
} from "../../exportacion/models/exportacion.model";
import type { CajaPanel } from "../../finanzas/models/caja.model";
import type { CobranzaPanel } from "../../finanzas/models/cobranza.model";
import type { ResultadoPanel } from "../../finanzas/models/resultado.model";
import type { MisVentasPanel } from "../../mis-ventas/models/mis-ventas.model";
import type { ColaPanel } from "../../operaciones/models/cola.model";
import type { CouriersPanel } from "../../operaciones/models/couriers.model";
import type { InventarioPanel } from "../../operaciones/models/inventario.model";
import type { ProductosPanel } from "../../productos/models/productos.model";
import type { PublicidadPanel } from "../../publicidad/models/publicidad.model";
import type { ResumenPanel } from "../../resumen/models/resumen.model";
import type { PanelContractId } from "../models/panel-contract.model";
import type { PanelEnvelope } from "../models/panel-envelope.model";
import type { PanelQuery } from "../models/panel-query.model";

interface Contract<Q, R> {
  query: Q;
  result: R;
}

export interface PanelContractMap {
  "estado-periodo": Contract<PanelQuery, PanelEnvelope<EstadoPeriodo>>;
  resumen: Contract<PanelQuery, PanelEnvelope<ResumenPanel>>;
  "canales-fichas": Contract<{ empresaId: string }, CanalFicha[]>;
  "canales-fichas-guardar": Contract<CanalFichaGuardar, CanalFicha>;
  "canales-comparativo": Contract<
    PanelQuery & CanalesComparativoQueryExtra,
    PanelEnvelope<CanalesComparativo>
  >;
  "canales-detalle": Contract<PanelQuery & { canal_id: string }, PanelEnvelope<CanalDetalle>>;
  productos: Contract<PanelQuery, PanelEnvelope<ProductosPanel>>;
  publicidad: Contract<PanelQuery, PanelEnvelope<PublicidadPanel>>;
  "clientes-zonas": Contract<PanelQuery, PanelEnvelope<ClientesZonasPanel>>;
  callcenter: Contract<PanelQuery, PanelEnvelope<CallCenterPanel>>;
  "operaciones-cola": Contract<PanelQuery, PanelEnvelope<ColaPanel>>;
  "operaciones-couriers": Contract<PanelQuery, PanelEnvelope<CouriersPanel>>;
  "operaciones-inventario": Contract<PanelQuery, PanelEnvelope<InventarioPanel>>;
  "finanzas-resultado": Contract<PanelQuery, PanelEnvelope<ResultadoPanel>>;
  "finanzas-caja": Contract<PanelQuery, PanelEnvelope<CajaPanel>>;
  "finanzas-cobranza": Contract<PanelQuery, PanelEnvelope<CobranzaPanel>>;
  "equipo-vendedoras": Contract<
    PanelQuery & EquipoVendedorasQueryExtra,
    PanelEnvelope<EquipoVendedorasPanel>
  >;
  "equipo-confirmadoras": Contract<PanelQuery, PanelEnvelope<EquipoConfirmadorasPanel>>;
  "mis-ventas": Contract<PanelQuery, PanelEnvelope<MisVentasPanel>>;
  "config-metas": Contract<{ empresaId: string }, ConfigMetas>;
  "config-metas-guardar": Contract<ConfigMetasGuardar, ConfigMetas>;
  "config-estados": Contract<PanelQuery, ConfigEstados>;
  "config-cuadres": Contract<PanelQuery, ConfigCuadres>;
  detalle: Contract<DetalleQuery, DetalleResponse>;
  "acciones-pedido": Contract<AccionPedidoRequest, AccionPedidoResponse>;
  "exportacion-libro": Contract<ExportLibroQuery, ExportLibroResponse>;
  "compartir-reporte": Contract<PanelQuery, CompartirReporteResponse>;
  "opciones-asesores": Contract<AsesoresQuery, AsesorOpcion[]>;
}

type EnsureCoverage<T extends Record<PanelContractId, Contract<unknown, unknown>>> = T;

export type PanelContracts = EnsureCoverage<PanelContractMap>;

export type ContractQuery<K extends PanelContractId> = PanelContracts[K]["query"];
export type ContractResult<K extends PanelContractId> = PanelContracts[K]["result"];
