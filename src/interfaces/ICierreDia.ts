/* -----------------------------------------
   Cierre del Día — CC v2
   Cierre financiero/operativo diario del call center:
   embudo de pedidos, ingreso/costo, gasto publicitario (CPV)
   por plataforma y upsells. Se completa manualmente (modal
   de regularización) hasta que exista un endpoint dedicado
   en ms-ventas que lo calcule a partir de los pedidos reales.
----------------------------------------- */

export interface CierreDiaFunnel {
  porConfirmar: number;
  contactado: number;
  noContesta: number;
  confirmado: number;
  despachado: number;
  entregado: number;
  anulado: number;
}

export interface CierreDiaRecord extends CierreDiaFunnel {
  storeId: string;
  date: string; // YYYY-MM-DD
  ingreso: number;
  costo: number;
  publiMeta: number;
  publiTiktok: number;
  publiGoogle: number;
  upsells: number;
  savedAt: number; // epoch ms
  updatedAt: number; // epoch ms
}

export interface CierreDiaFormInput extends CierreDiaFunnel {
  ingreso: number;
  costo: number;
  publiMeta: number;
  publiTiktok: number;
  publiGoogle: number;
  upsells: number;
}

/**
 * Fila de rendimiento por producto — se calcula en vivo a partir de los
 * pedidos reales del día (getPedidosCC + costo por variante + upsell-records),
 * no se guarda. Ver `cierreDiaProductosService.ts`.
 */
export interface CierreDiaProductoRow extends CierreDiaFunnel {
  productVariantId: string;
  nombre: string;
  sku: string;
  upsell: number;
  ingreso: number;
  costo: number;
  margen: number;
  pctMargen: number;
}

/** Métricas derivadas — se recalculan siempre a partir del record, nunca se guardan. */
export interface CierreDiaMetrics {
  total: number;
  publi: number;
  margenBruto: number;
  margenNeto: number;
  pctMargenBruto: number;
  pctMargenNeto: number;
  tasaConfirmacion: number; // (confirmado+despachado+entregado) / total
  tasaAnulacion: number; // anulado / total
  tasaEnGestion: number; // (porConfirmar+contactado+noContesta) / total
}
