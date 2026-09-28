export interface HistorialClientes {
  disponible: boolean;
  desde: string | null;
}

export interface ClientesKpis {
  conCompra: number;
  nuevos: number | null;
  recurrentes: number | null;
  recompra: number | null;
  valorHistoricoPorCliente: number | null;
  listaNegraPedidos: number | null;
  efectividadListaNegra: number | null;
  efectividadTotal: number | null;
}

export interface DepartamentoFila {
  departamento: string;
  zona: "lima" | "provincia";
  ventas: number;
  facturacion: number;
  participacion: number | null;
  ticket: number | null;
  efectividadEntrega: number | null;
}

export interface ZonaFila {
  zona: "lima" | "provincia";
  ventas: number;
  facturacion: number;
  participacion: number | null;
  ticket: number | null;
  efectividadEntrega: number | null;
}

export interface MetodoPagoFila {
  metodo: string;
  facturacion: number;
  pedidos: number;
}

export interface MejorClienteFila {
  clienteId: string;
  nombre: string;
  departamento: string | null;
  pedidos: number;
  entregado: number;
  rechazosPrevios: number;
}

export interface ClientesZonasPanel {
  historial: HistorialClientes;
  kpis: ClientesKpis;
  zonas: ZonaFila[];
  departamentos: DepartamentoFila[];
  metodosPago: MetodoPagoFila[];
  mejoresClientes: MejorClienteFila[] | null;
}
