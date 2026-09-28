import type { VentaDiaria } from "../../resumen/models/resumen.model";

export interface ProductosKpis {
  facturacionNeta: number;
  ventas: number;
  unidades: number;
  ticket: number | null;
  unidadesPorVenta: number | null;
  descuentos: number;
  descuentoSobreLista: number | null;
  upsell: number;
  ventasConUpsell: number;
  anuladosMasRechazados: number;
  ingresados: number;
  tasaPerdida: number | null;
}

export interface ProductoFila {
  productoId: string;
  sku: string;
  productoBaseId: string;
  productoBaseNombre: string;
  variante: string | null;
  nombre: string;
  categoria: string | null;
  unidades: number;
  facturacionNeta: number;
  participacion: number | null;
  canalPrincipalId: string | null;
  canalPrincipalNombre: string | null;
  descuentoPromedio: number | null;
  costoUnitario?: number | null;
  margen?: number | null;
  tasaRechazo: number | null;
  stock: number | null;
}

export interface CuponFila {
  cupon: string;
  ventas: number;
  descuento: number;
  facturacion: number;
  efectividadEntrega: number | null;
}

export interface CategoriaFila {
  categoria: string;
  facturacionNeta: number;
}

export interface ProductosPanel {
  kpis: ProductosKpis;
  ventasDiarias: VentaDiaria[];
  productos: ProductoFila[];
  cupones: CuponFila[];
  categorias: CategoriaFila[];
}
