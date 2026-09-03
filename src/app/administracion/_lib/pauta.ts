import type { PautaLinea } from "../_mock/data";
import type { VentaProductoReal } from "./realData";

export interface ProductoAtribucion {
  sku: string;
  nombre: string;
  ventas: number;
  unidades: number;
  directo: number;
  prorrateoGeneral: number;
  atribuido: number;
  confianza: number; // >= 0.6 => "Directo", > 0 => "Estimado", 0 => "Prorrateo"
  cpv: number;
  roas: number;
}

export interface CanalComputo {
  canalId: string;
  total: number;
  ventasTotales: number;
  unidadesTotales: number;
  general: number;
  directoTotal: number;
  productos: ProductoAtribucion[];
  cpv: number;
  roas: number;
}

/**
 * Motor de atribución de pauta a producto — §8 doc técnica, simplificado a
 * un solo nivel (producto + General). El doc también contempla un nivel
 * "categoría" intermedio, pero `OrderItem` (ms-ventas) no trae categoría de
 * producto — eso vive en ms-products, sin endpoint expuesto en este módulo —
 * así que esa capa de atribución no está implementada todavía.
 */
export function computeCanal(canalId: string, lineas: PautaLinea[], ventas: VentaProductoReal[]): CanalComputo {
  const total = lineas.reduce((a, l) => a + l.monto, 0);
  const ventasTotales = ventas.reduce((a, v) => a + v.ventas, 0);
  const unidadesTotales = ventas.reduce((a, v) => a + v.unidades, 0);

  const porProducto: Record<string, number> = {};
  let general = 0;
  lineas.forEach((l) => {
    if (l.tipo === "prod") porProducto[l.ref] = (porProducto[l.ref] ?? 0) + l.monto;
    else general += l.monto;
  });

  const productos: ProductoAtribucion[] = ventas.map((v) => {
    const directo = porProducto[v.sku] ?? 0;
    const prorrateoGeneral = general * (ventasTotales > 0 ? v.ventas / ventasTotales : 0);
    const atribuido = directo + prorrateoGeneral;
    return {
      sku: v.sku,
      nombre: v.nombre,
      ventas: v.ventas,
      unidades: v.unidades,
      directo,
      prorrateoGeneral,
      atribuido,
      confianza: atribuido > 0 ? directo / atribuido : 0,
      cpv: v.unidades > 0 ? atribuido / v.unidades : 0,
      roas: atribuido > 0 ? v.ventas / atribuido : 0,
    };
  });

  const directoTotal = Object.values(porProducto).reduce((a, b) => a + b, 0);

  return {
    canalId,
    total,
    ventasTotales,
    unidadesTotales,
    general,
    directoTotal,
    productos,
    cpv: unidadesTotales > 0 ? total / unidadesTotales : 0,
    roas: total > 0 ? ventasTotales / total : 0,
  };
}

export function confianzaLabel(confianza: number): "Directo" | "Estimado" | "Prorrateo" {
  if (confianza >= 0.6) return "Directo";
  if (confianza > 0) return "Estimado";
  return "Prorrateo";
}
