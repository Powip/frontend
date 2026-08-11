import { CierreDiaFunnel, CierreDiaMetrics, CierreDiaProductoRow, CierreDiaRecord } from "@/interfaces/ICierreDia";
import { CierreDiaDayTotals } from "@/services/cierreDiaProductosService";
import { EMPTY_FUNNEL } from "@/utils/cierreDiaFunnel";

export { EMPTY_FUNNEL };

/** Fila "TOTAL" vacía — placeholder mientras carga o cuando no hay datos. */
export const EMPTY_PRODUCT_TOTALS: CierreDiaProductoRow = {
  productVariantId: "TOTAL",
  nombre: "TOTAL",
  sku: "",
  ...EMPTY_FUNNEL,
  upsell: 0,
  ingreso: 0,
  costo: 0,
  margen: 0,
  pctMargen: 0,
};

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

interface FunnelStateConfig {
  key: keyof CierreDiaFunnel;
  label: string;
  colorClass: string;
  barClass: string;
}

export const FUNNEL_STATES: FunnelStateConfig[] = [
  { key: "porConfirmar", label: "Por confirmar", colorClass: "text-slate-500 dark:text-slate-400", barClass: "bg-slate-400" },
  { key: "contactado", label: "Contactado", colorClass: "text-blue-600 dark:text-blue-400", barClass: "bg-blue-500" },
  { key: "noContesta", label: "No contesta", colorClass: "text-amber-600 dark:text-amber-400", barClass: "bg-amber-500" },
  { key: "confirmado", label: "Confirmado", colorClass: "text-emerald-600 dark:text-emerald-400", barClass: "bg-emerald-500" },
  { key: "despachado", label: "Despachado", colorClass: "text-teal-600 dark:text-teal-400", barClass: "bg-teal-500" },
  { key: "entregado", label: "Entregado", colorClass: "text-green-800 dark:text-green-400", barClass: "bg-green-700" },
  { key: "anulado", label: "Anulado", colorClass: "text-red-600 dark:text-red-400", barClass: "bg-red-500" },
];

export function funnelTotal(f: CierreDiaFunnel): number {
  return (
    f.porConfirmar + f.contactado + f.noContesta + f.confirmado + f.despachado + f.entregado + f.anulado
  );
}

/** Registro "efectivo" a mostrar: lo guardado manualmente, o si no existe, lo autocompletado desde pedidos reales. */
export interface CierreDiaEffectiveRecord extends CierreDiaRecord {
  /** true si viene de pedidos reales (auto) y todavía nadie lo guardó a mano. */
  isAuto: boolean;
}

/**
 * El embudo/ingreso/costo/upsells se pueden calcular solos a partir de los
 * pedidos reales del día (`byDay`) — lo único que nunca se puede autocompletar
 * es el gasto publicitario (Meta/TikTok/Google), porque no hay integración
 * con esas plataformas. Por eso el registro "automático" siempre trae publi
 * en 0: hay que cargarlo a mano una vez, el resto se recalcula solo.
 *
 * Si ya existe un registro guardado manualmente, ese manda siempre (permite
 * corregir el mapeo automático si se equivoca).
 */
export function toEffectiveRecord(
  storeId: string,
  date: string,
  manual: CierreDiaRecord | null | undefined,
  auto: CierreDiaDayTotals | undefined,
): CierreDiaEffectiveRecord | undefined {
  // `manual.pedidosIngresados` puede venir undefined en registros guardados
  // antes de que este campo existiera — se completa con el valor en vivo
  // como mejor referencia disponible en vez de dejarlo en blanco/NaN.
  if (manual) {
    return {
      ...manual,
      pedidosIngresados: manual.pedidosIngresados ?? auto?.pedidosIngresados ?? 0,
      isAuto: false,
    };
  }
  // También cuenta como "hay algo que mostrar" si entraron pedidos ese día
  // aunque el embudo (agrupado por última actualización) haya quedado en 0
  // — ver BUG CONFIRMADO en cierreDiaProductosService.ts.
  if (auto && (funnelTotal(auto) > 0 || auto.pedidosIngresados > 0)) {
    return {
      storeId,
      date,
      pedidosIngresados: auto.pedidosIngresados,
      porConfirmar: auto.porConfirmar,
      contactado: auto.contactado,
      noContesta: auto.noContesta,
      confirmado: auto.confirmado,
      despachado: auto.despachado,
      entregado: auto.entregado,
      anulado: auto.anulado,
      ingreso: auto.ingreso,
      costo: auto.costo,
      upsells: auto.upsells,
      publiMeta: 0,
      publiTiktok: 0,
      publiGoogle: 0,
      savedAt: 0,
      updatedAt: 0,
      isAuto: true,
    };
  }
  return undefined;
}

export function computeMetrics(record: CierreDiaRecord): CierreDiaMetrics {
  const total = funnelTotal(record);
  const publi = record.publiMeta + record.publiTiktok + record.publiGoogle;
  const margenBruto = record.ingreso - record.costo;
  const margenNeto = margenBruto - publi;
  const enGestion = record.porConfirmar + record.contactado + record.noContesta;
  const confirmadosOMas = record.confirmado + record.despachado + record.entregado;

  return {
    total,
    publi,
    margenBruto,
    margenNeto,
    pctMargenBruto: record.ingreso ? (margenBruto / record.ingreso) * 100 : 0,
    pctMargenNeto: record.ingreso ? (margenNeto / record.ingreso) * 100 : 0,
    tasaConfirmacion: total ? (confirmadosOMas / total) * 100 : 0,
    tasaAnulacion: total ? (record.anulado / total) * 100 : 0,
    tasaEnGestion: total ? (enGestion / total) * 100 : 0,
  };
}

export function formatDate(dateStr: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString(
    "es-PE",
    opts ?? { day: "2-digit", month: "short", year: "numeric" },
  );
}

export function marginColorClass(pct: number): string {
  if (pct >= 45) return "text-emerald-600 dark:text-emerald-400";
  if (pct >= 38) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export function todayISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60000).toISOString().slice(0, 10);
}
