export const ESTADOS_STOCK = [
  "error_datos",
  "agotado",
  "critico",
  "bajo",
  "ok",
  "sobrestock",
] as const;
export type EstadoStock = (typeof ESTADOS_STOCK)[number];

export const ESTADO_STOCK_LABEL: Record<EstadoStock, string> = {
  error_datos: "Error de datos",
  agotado: "Agotado",
  critico: "Crítico",
  bajo: "Bajo",
  ok: "OK",
  sobrestock: "Sobrestock",
};

export interface InventarioKpis {
  productos: number;
  sinCosto: number;
  valorAlCosto?: number;
  agotados: number;
  criticos: number;
  erroresDatos: number;
  ventasEsperandoStock: number;
}

export interface InventarioFila {
  productoId: string;
  sku: string;
  nombre: string;
  tiendaId: string;
  unidades30Dias: number | null;
  stock: number;
  reservado: number | null;
  disponible: number | null;
  ventaDiaria: number | null;
  coberturaDias: number | null;
  estado: EstadoStock;
  costoUnitario?: number | null;
  valor?: number | null;
}

export interface InventarioPanel {
  kpis: InventarioKpis;
  productos: InventarioFila[];
}
