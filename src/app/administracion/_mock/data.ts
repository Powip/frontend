/**
 * Datos de ejemplo para las pestañas nuevas de Administración.
 *
 * TODO(conexión real): todo este archivo es MOCK — ninguna de estas
 * estructuras viene de ms-ventas/ms-company/ms-courier todavía. Cuando se
 * conecte cada pestaña a datos reales, reemplazar el import de estas
 * constantes por hooks de React Query (mismo patrón que
 * `useAdminQueries.ts`) y borrar lo que ya no se use de este archivo.
 *
 * Referencia: POWIP_Administracion_DocTecnica_Devs_v1.pdf
 */

// ────────────────────────────────────────────────────────────────────────
// Reporte rápido (§16 doc)
// ────────────────────────────────────────────────────────────────────────

export type ReportePeriodo = "hoy" | "semana" | "quincena" | "mes";

export interface ReporteData {
  label: string;
  ventaTotal: number;
  producto: number; // COGS del periodo
  publicidad: number;
  envios: number;
  pedidos: number;
  unidades: number;
}

export const REPORTE_MOCK: Record<ReportePeriodo, ReporteData> = {
  hoy: { label: "Hoy · 18 mayo", ventaTotal: 4090, producto: 830, publicidad: 830, envios: 296, pedidos: 37, unidades: 30 },
  semana: { label: "Semana · 12–18 mayo", ventaTotal: 26840, producto: 5450, publicidad: 5320, envios: 1936, pedidos: 236, unidades: 197 },
  quincena: { label: "Quincena · 1–15 mayo", ventaTotal: 55120, producto: 11190, publicidad: 10870, envios: 3968, pedidos: 484, unidades: 402 },
  mes: { label: "Mes · mayo (al 18)", ventaTotal: 66330, producto: 13460, publicidad: 13100, envios: 4776, pedidos: 583, unidades: 484 },
};

export const REPORTE_META_MES = 45000;

export type NivelAlerta = "verde" | "ambar" | "rojo";

export interface AlertaItem {
  nivel: NivelAlerta;
  texto: string;
}

export const ALERTAS_MOCK: AlertaItem[] = [
  { nivel: "rojo", texto: "Planilla general vence en 3 días (S/ 8,700). Asegura la caja o programa el pago." },
  { nivel: "ambar", texto: "Shalom Arequipa lleva 9 días sin liquidar (S/ 4,893). Reclama la liquidación." },
  { nivel: "ambar", texto: "Tasa de confirmación en 82% (ámbar). Revisa la calidad de leads de WhatsApp." },
  { nivel: "verde", texto: "Mayo ya superó la meta de profit (178%). Puedes escalar ads con confianza." },
];

export const SIMULADOR_BASE = {
  precioNetoProm: 134.6,
  cogsProm: 27,
  unidadesBase: 298,
  adsBase: 7745,
  gastosFijos: 8480,
};

// ────────────────────────────────────────────────────────────────────────
// Semáforo COD compuesto (§7.7 doc) — usado en Resumen
// ────────────────────────────────────────────────────────────────────────

export interface SemaforoIndicador {
  nombre: string;
  valor: string;
  umbral: string;
  nivel: NivelAlerta;
}

export const SEMAFORO_COD_MOCK: SemaforoIndicador[] = [
  { nombre: "CPV neto total", valor: "S/ 16.40", umbral: "< S/18 · 18-22 · > 22", nivel: "verde" },
  { nombre: "ROAS POWIP", valor: "3.1×", umbral: "> 4.0× · 3-4× · < 3×", nivel: "ambar" },
  { nombre: "Tasa de confirmación", valor: "82%", umbral: "> 85% · 75-85% · < 75%", nivel: "ambar" },
  { nombre: "Margen neto", valor: "22.2%", umbral: "> 28% · 20-28% · < 20%", nivel: "verde" },
];

// ────────────────────────────────────────────────────────────────────────
// Canales (compartido entre Control diario y Pauta por canal — §6, §8, §9)
// ────────────────────────────────────────────────────────────────────────

export type CanalGrupo = "ecommerce" | "marketplace";
export type CanalModelo = "COD" | "Prepago" | "Marketplace";

export interface CanalVentaDef {
  id: string;
  nombre: string;
  grupo: CanalGrupo;
  modelo: CanalModelo;
}

export const CANALES_VENTA: CanalVentaDef[] = [
  { id: "wa", nombre: "WhatsApp COD", grupo: "ecommerce", modelo: "COD" },
  { id: "ig", nombre: "Instagram", grupo: "ecommerce", modelo: "COD" },
  { id: "tk", nombre: "TikTok", grupo: "ecommerce", modelo: "COD" },
  { id: "webp", nombre: "Web Pasarela", grupo: "ecommerce", modelo: "Prepago" },
  { id: "webc", nombre: "Web COD", grupo: "ecommerce", modelo: "COD" },
  { id: "fala", nombre: "Falabella", grupo: "marketplace", modelo: "Marketplace" },
  { id: "ml", nombre: "Mercado Libre", grupo: "marketplace", modelo: "Marketplace" },
  { id: "rip", nombre: "Ripley", grupo: "marketplace", modelo: "Marketplace" },
];

// ────────────────────────────────────────────────────────────────────────
// Control diario de pauta (§9 doc) — solo ventas, sin mensajes/CxM/efectividad
// ────────────────────────────────────────────────────────────────────────

export interface DiaCanal {
  dia: number;
  ordenes: number;
  unidades: number;
  venta: number;
  inversion: number;
}

function genDias(seedOrdenes: number, seedVenta: number, seedInv: number): DiaCanal[] {
  return Array.from({ length: 18 }, (_, i) => {
    const dia = i + 1;
    const wave = 1 + Math.sin(dia / 2.4) * 0.22;
    const ordenes = Math.max(3, Math.round(seedOrdenes * wave));
    const unidades = Math.round(ordenes * 1.22);
    const venta = Math.round(seedVenta * wave);
    const inversion = Math.round(seedInv * wave);
    return { dia, ordenes, unidades, venta, inversion };
  });
}

export interface CanalDiarioData {
  canalId: string;
  objetivoCpv: number;
  presupuestoMes: number;
  metaVentasMes: number;
  dias: DiaCanal[];
}

export const DIARIO_MOCK: Record<string, CanalDiarioData> = {
  wa: { canalId: "wa", objetivoCpv: 20, presupuestoMes: 8000, metaVentasMes: 40000, dias: genDias(24, 3600, 780) },
  ig: { canalId: "ig", objetivoCpv: 22, presupuestoMes: 4000, metaVentasMes: 18000, dias: genDias(11, 1750, 480) },
  tk: { canalId: "tk", objetivoCpv: 18, presupuestoMes: 3000, metaVentasMes: 14000, dias: genDias(9, 1300, 360) },
  webp: { canalId: "webp", objetivoCpv: 16, presupuestoMes: 2200, metaVentasMes: 12000, dias: genDias(7, 1500, 260) },
  webc: { canalId: "webc", objetivoCpv: 21, presupuestoMes: 1200, metaVentasMes: 6000, dias: genDias(4, 620, 130) },
  fala: { canalId: "fala", objetivoCpv: 25, presupuestoMes: 1500, metaVentasMes: 9000, dias: genDias(6, 1050, 190) },
  ml: { canalId: "ml", objetivoCpv: 25, presupuestoMes: 900, metaVentasMes: 7000, dias: genDias(5, 820, 140) },
  rip: { canalId: "rip", objetivoCpv: 28, presupuestoMes: 500, metaVentasMes: 3000, dias: genDias(2, 350, 60) },
};

// ────────────────────────────────────────────────────────────────────────
// Pauta por canal → atribución producto/categoría (§8 doc)
// ────────────────────────────────────────────────────────────────────────

export interface CatalogoItem {
  sku: string;
  nombre: string;
  categoria: string;
}

export const CATALOGO_MOCK: CatalogoItem[] = [
  { sku: "BELCUI-043P3F", nombre: "Crema ACLARI", categoria: "Skincare" },
  { sku: "BELCUI-SR24VI", nombre: "Crema Centella", categoria: "Skincare" },
  { sku: "BELCUI-HG12", nombre: "Gotas Hongi", categoria: "Skincare" },
  { sku: "SHOIMP-VSA01", nombre: "Pantalón Sastre", categoria: "Ropa" },
  { sku: "SHOIMP-PDA-C", nombre: "Denim Afelpado", categoria: "Ropa" },
];

export interface VentaCanalProducto {
  sku: string;
  ventas: number;
  unidades: number;
}

export const VENTAS_POR_CANAL_MOCK: Record<string, VentaCanalProducto[]> = {
  wa: [
    { sku: "BELCUI-043P3F", ventas: 6540, unidades: 40 },
    { sku: "SHOIMP-VSA01", ventas: 3180, unidades: 20 },
    { sku: "SHOIMP-PDA-C", ventas: 2120, unidades: 14 },
    { sku: "BELCUI-HG12", ventas: 1290, unidades: 11 },
  ],
  ig: [
    { sku: "BELCUI-SR24VI", ventas: 2860, unidades: 16 },
    { sku: "BELCUI-043P3F", ventas: 2240, unidades: 14 },
    { sku: "SHOIMP-PDA-C", ventas: 1490, unidades: 10 },
  ],
  tk: [
    { sku: "BELCUI-HG12", ventas: 1680, unidades: 15 },
    { sku: "BELCUI-SR24VI", ventas: 1430, unidades: 8 },
    { sku: "BELCUI-043P3F", ventas: 980, unidades: 6 },
  ],
  webp: [
    { sku: "SHOIMP-VSA01", ventas: 2380, unidades: 15 },
    { sku: "BELCUI-043P3F", ventas: 1610, unidades: 10 },
  ],
  webc: [
    { sku: "SHOIMP-PDA-C", ventas: 1190, unidades: 8 },
    { sku: "BELCUI-HG12", ventas: 740, unidades: 6 },
  ],
  fala: [
    { sku: "BELCUI-043P3F", ventas: 4120, unidades: 26 },
    { sku: "SHOIMP-VSA01", ventas: 2650, unidades: 17 },
  ],
  ml: [
    { sku: "BELCUI-043P3F", ventas: 3080, unidades: 19 },
    { sku: "BELCUI-SR24VI", ventas: 1740, unidades: 10 },
    { sku: "SHOIMP-PDA-C", ventas: 980, unidades: 7 },
  ],
  rip: [{ sku: "SHOIMP-VSA01", ventas: 1520, unidades: 10 }],
};

export type PautaLineaTipo = "prod" | "cat" | "gen";

export interface PautaLinea {
  tipo: PautaLineaTipo;
  ref: string; // sku | categoría | "General del canal"
  monto: number;
}

export const PAUTA_MOCK: Record<string, PautaLinea[]> = {
  wa: [
    { tipo: "prod", ref: "BELCUI-043P3F", monto: 1400 },
    { tipo: "cat", ref: "Ropa", monto: 800 },
    { tipo: "gen", ref: "General del canal", monto: 1000 },
  ],
  ig: [
    { tipo: "prod", ref: "BELCUI-SR24VI", monto: 900 },
    { tipo: "gen", ref: "General del canal", monto: 1200 },
  ],
  tk: [
    { tipo: "cat", ref: "Skincare", monto: 1000 },
    { tipo: "gen", ref: "General del canal", monto: 600 },
  ],
  webp: [{ tipo: "gen", ref: "Google Ads", monto: 700 }],
  webc: [{ tipo: "gen", ref: "General del canal", monto: 300 }],
  fala: [{ tipo: "gen", ref: "Retail media Falabella Ads", monto: 1200 }],
  ml: [
    { tipo: "prod", ref: "BELCUI-043P3F", monto: 500 },
    { tipo: "gen", ref: "Mercado Ads", monto: 300 },
  ],
  rip: [],
};

// ────────────────────────────────────────────────────────────────────────
// Cuentas por Cobrar / Pagar (§11 doc)
// ────────────────────────────────────────────────────────────────────────

export type UrgenciaCuenta = "roja" | "ambar" | "azul";

export interface CuentaItem {
  id: string;
  icono: string;
  concepto: string;
  descripcion: string;
  monto: number;
  vencimiento: string;
  urgencia: UrgenciaCuenta;
  auto: boolean;
}

export const CUENTAS_COBRAR_MOCK: CuentaItem[] = [
  { id: "c1", icono: "📦", concepto: "Shalom · Arequipa", descripcion: "34 guías COD · sem 5-14 mayo", monto: 4893, vencimiento: "Vencido 9 días", urgencia: "roja", auto: true },
  { id: "c2", icono: "📦", concepto: "Olva · Cusco", descripcion: "18 guías COD · sem 8-14 mayo", monto: 2100, vencimiento: "Vence en 2 días", urgencia: "ambar", auto: true },
  { id: "c3", icono: "📦", concepto: "Shalom · Trujillo", descripcion: "12 guías COD · sem 10-14 mayo", monto: 1540, vencimiento: "Vence en 5 días", urgencia: "ambar", auto: true },
  { id: "c4", icono: "🚚", concepto: "Saldos COD pendientes", descripcion: "67 pedidos en tránsito por entregar", monto: 9307, vencimiento: "En tránsito", urgencia: "azul", auto: true },
  { id: "c5", icono: "💳", concepto: "Devolución Google Ads", descripcion: "Crédito publicitario aprobado", monto: 400, vencimiento: "Vence en 15 días", urgencia: "azul", auto: false },
];

export const CUENTAS_PAGAR_MOCK: CuentaItem[] = [
  { id: "p1", icono: "👤", concepto: "Joaquín · Content Manager", descripcion: "Marketing · Sueldo mayo · vence HOY", monto: 750, vencimiento: "Vence HOY", urgencia: "roja", auto: true },
  { id: "p2", icono: "👥", concepto: "Planilla completa · mayo", descripcion: "8 personas · prorrata ambas tiendas", monto: 8700, vencimiento: "Vence en 3 días", urgencia: "ambar", auto: true },
  { id: "p3", icono: "📦", concepto: "Laboratorio Bioma", descripcion: "COM-0020 · compra 28 abr · 30 días crédito", monto: 1400, vencimiento: "Vence 28 mayo", urgencia: "ambar", auto: true },
  { id: "p4", icono: "🚚", concepto: "Olva · guías mayo", descripcion: "87 guías provincia × S/ 12 prom.", monto: 2100, vencimiento: "Fin de mes", urgencia: "azul", auto: true },
  { id: "p5", icono: "🏦", concepto: "BCP · cuota mayo", descripcion: "Préstamo S/ 10,000 · S/ 1,070/mes", monto: 1070, vencimiento: "Vence 25 mayo", urgencia: "azul", auto: false },
  { id: "p6", icono: "💻", concepto: "Adobe Creative Suite", descripcion: "Herramientas Marketing", monto: 200, vencimiento: "Vence 20 mayo", urgencia: "azul", auto: false },
];

export type TipoMovimiento = "ingreso" | "egreso";

export interface MovimientoHistorial {
  id: string;
  mes: string; // YYYY-MM
  tipo: TipoMovimiento;
  concepto: string;
  monto: number;
}

export const HISTORIAL_MOCK: MovimientoHistorial[] = [
  { id: "h1", mes: "2026-05", tipo: "ingreso", concepto: "Liquidación Shalom · Trujillo", monto: 1540 },
  { id: "h2", mes: "2026-05", tipo: "ingreso", concepto: "Adelantos COD cobrados", monto: 1240 },
  { id: "h3", mes: "2026-05", tipo: "egreso", concepto: "Sueldo Heidi Medina", monto: 1100 },
  { id: "h4", mes: "2026-04", tipo: "ingreso", concepto: "Liquidación Olva · abril", monto: 2380 },
  { id: "h5", mes: "2026-04", tipo: "egreso", concepto: "Alquiler oficina principal", monto: 1800 },
  { id: "h6", mes: "2026-04", tipo: "egreso", concepto: "Cuota BCP 4", monto: 1070 },
];

// ────────────────────────────────────────────────────────────────────────
// Flujo de Caja (§12 doc)
// ────────────────────────────────────────────────────────────────────────

export const MESES_CORTOS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
export const MESES_LARGOS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export interface FlujoFila {
  concepto: string;
  valores: number[];
  destacado?: boolean;
}

export const FLUJO_INGRESOS_MOCK: FlujoFila[] = [
  { concepto: "Ventas entregadas", valores: [25420, 14703, 0, 0, 40123, 0, 0, 0, 0, 0, 0, 0] },
  { concepto: "Adelantos cobrados", valores: [0, 0, 0, 0, 8240, 0, 0, 0, 0, 0, 0, 0] },
  { concepto: "Otros ingresos", valores: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
];

export const FLUJO_EGRESOS_MOCK: FlujoFila[] = [
  { concepto: "Gastos fijos (planilla + oficina)", valores: [10450, 10650, 9400, 9400, 10450, 9850, 9850, 10000, 10000, 10000, 10000, 10000] },
  { concepto: "Publicidad (manual)", valores: [7745, 4512, 0, 0, 7745, 0, 0, 0, 0, 0, 0, 0] },
  { concepto: "COGS (precio neto real)", valores: [6350, 4100, 0, 0, 8023, 0, 0, 0, 0, 0, 0, 0] },
  { concepto: "Courier integrado", valores: [4128, 4128, 4128, 4128, 8400, 0, 0, 0, 0, 0, 0, 0] },
  { concepto: "Préstamo BCP · cuota", valores: [1070, 1070, 1070, 1070, 1070, 1070, 1070, 1070, 1070, 1070, 1070, 1070] },
];

export const ADELANTOS_MOCK = [
  { label: "Adelantos recibidos hoy", valor: 1240, sub: "Pagos parciales COD" },
  { label: "Adelantos del mes", valor: 8240, sub: "Acumulado mayo" },
  { label: "Pendientes de entregar", valor: 8240, sub: "Pedidos confirmados" },
];

// ────────────────────────────────────────────────────────────────────────
// Liquidaciones — courier y vendedoras (§13 doc)
// ────────────────────────────────────────────────────────────────────────

export interface CourierLiquidacionMock {
  id: string;
  nombre: string;
  urgente: boolean;
  dias: number;
  guias: number;
  devoluciones: number;
  recaudado: number;
  costoEnvio: number;
  devolucionMonto: number;
  neto: number;
}

export const COURIERS_MOCK: CourierLiquidacionMock[] = [
  { id: "co1", nombre: "Shalom · Arequipa", urgente: true, dias: 9, guias: 34, devoluciones: 3, recaudado: 5814, costoEnvio: 408, devolucionMonto: 513, neto: 4893 },
  { id: "co2", nombre: "Olva · Cusco", urgente: false, dias: 3, guias: 18, devoluciones: 6, recaudado: 3240, costoEnvio: 276, devolucionMonto: 864, neto: 2100 },
  { id: "co3", nombre: "Shalom · Trujillo", urgente: false, dias: 5, guias: 12, devoluciones: 2, recaudado: 1980, costoEnvio: 180, devolucionMonto: 260, neto: 1540 },
];

export interface EscalaComisionItem {
  umbral: string;
  bono: number;
  actual?: boolean;
}

export type EstadoComision = "alcanzado" | "parcial" | "pagado";

export interface VendedoraMock {
  id: string;
  nombre: string;
  iniciales: string;
  base: number;
  facturacion: number;
  meta: number;
  pedidosRealizados: number;
  efectividad: number;
  cpo: number;
  cpv: number;
  bono: number;
  total: number;
  estado: EstadoComision;
  escala: EscalaComisionItem[];
}

export const VENDEDORAS_MOCK: VendedoraMock[] = [
  {
    id: "v1", nombre: "Cecia de la Cruz", iniciales: "CC", base: 1100, facturacion: 42000, meta: 40000,
    pedidosRealizados: 210, efectividad: 95, cpo: 25, cpv: 20, bono: 700, total: 1800, estado: "alcanzado",
    escala: [{ umbral: "101%+", bono: 700, actual: true }, { umbral: "100%", bono: 500 }, { umbral: "80%", bono: 400 }, { umbral: "70%", bono: 350 }],
  },
  {
    id: "v2", nombre: "Heidi Medina", iniciales: "HM", base: 1200, facturacion: 38000, meta: 40000,
    pedidosRealizados: 198, efectividad: 93, cpo: 26, cpv: 21, bono: 350, total: 1550, estado: "parcial",
    escala: [{ umbral: "101%+", bono: 700 }, { umbral: "100%", bono: 500 }, { umbral: "80%", bono: 350, actual: true }, { umbral: "70%", bono: 250 }],
  },
];

// ────────────────────────────────────────────────────────────────────────
// Capital & ROI (§14 doc)
// ────────────────────────────────────────────────────────────────────────

export type CapitalTipo = "Capital propio" | "Aumento de capital" | "Préstamo" | "Utilidad reinvertida";

export interface CapitalEntryMock {
  id: string;
  tipo: CapitalTipo;
  descripcion: string;
  monto: number;
  tienda: string;
}

export const CAPITAL_MOCK: CapitalEntryMock[] = [
  { id: "cap1", tipo: "Capital propio", descripcion: "Aporte inicial · Dic 2024", monto: 20000, tienda: "Consolidado" },
  { id: "cap2", tipo: "Capital propio", descripcion: "Aumento · Mar 2025", monto: 5000, tienda: "Tienda A" },
  { id: "cap3", tipo: "Préstamo", descripcion: "BCP · 18% anual · 12 cuotas · S/ 1,070/mes", monto: 10000, tienda: "Consolidado" },
  { id: "cap4", tipo: "Utilidad reinvertida", descripcion: "Utilidad Q1 2025 → stock", monto: 5875, tienda: "Tienda B" },
];

export const CAPITAL_HERO_MOCK = {
  capitalTotal: 40875,
  utilidadAcumulada: 42875,
  roi: 104.9,
  mesesRecupero: 8.2,
};

export type EstadoCuota = "pagada" | "proxima" | "pendiente";

export interface CuotaAmortizacion {
  n: number;
  fecha: string;
  cuota: number;
  capital: number;
  interes: number;
  saldo: number;
  estado: EstadoCuota;
}

function genAmortizacion(): CuotaAmortizacion[] {
  const meses = ["25 ene 2026", "25 feb 2026", "25 mar 2026", "25 abr 2026", "25 may 2026", "25 jun 2026", "25 jul 2026", "25 ago 2026", "25 sep 2026", "25 oct 2026", "25 nov 2026", "25 dic 2026"];
  let saldo = 10000;
  const tasaMensual = 0.18 / 12;
  const cuotaFija = 1070;
  return meses.map((fecha, i) => {
    const n = i + 1;
    const interes = Math.round(saldo * tasaMensual);
    let capital = cuotaFija - interes;
    let cuota = cuotaFija;
    if (n === 12) {
      capital = saldo;
      cuota = saldo + interes;
    }
    saldo = Math.max(0, saldo - capital);
    const estado: EstadoCuota = n <= 4 ? "pagada" : n === 5 ? "proxima" : "pendiente";
    return { n, fecha, cuota: Math.round(cuota), capital: Math.round(capital), interes, saldo: Math.round(saldo), estado };
  });
}

export const AMORTIZACION_MOCK: CuotaAmortizacion[] = genAmortizacion();

// ────────────────────────────────────────────────────────────────────────
// Resumen Anual (§15 doc)
// ────────────────────────────────────────────────────────────────────────

export type SemaforoMes = "verde" | "ambar" | "rojo" | "sin-datos";

export interface MesKpi {
  mes: string;
  ventas: number;
  metaVentas: number;
  profit: number;
  metaProfit: number;
  cogs: number;
  margenBrutoPct: number;
  cpv: number | null;
  roas: number | null;
  margenNetoPct: number | null;
  semaforo: SemaforoMes;
}

export const ANUAL_MOCK: MesKpi[] = [
  { mes: "Enero", ventas: 25420, metaVentas: 25000, profit: 875, metaProfit: 3333, cogs: 6350, margenBrutoPct: 75.0, cpv: 30.49, roas: 3.3, margenNetoPct: 3.4, semaforo: "ambar" },
  { mes: "Febrero", ventas: 14703, metaVentas: 25000, profit: -4559, metaProfit: 3333, cogs: 4100, margenBrutoPct: 72.1, cpv: 31.33, roas: 3.3, margenNetoPct: null, semaforo: "rojo" },
  { mes: "Marzo", ventas: 0, metaVentas: 25000, profit: 0, metaProfit: 3333, cogs: 0, margenBrutoPct: 0, cpv: null, roas: null, margenNetoPct: null, semaforo: "sin-datos" },
  { mes: "Abril", ventas: 0, metaVentas: 25000, profit: 0, metaProfit: 3333, cogs: 0, margenBrutoPct: 0, cpv: null, roas: null, margenNetoPct: null, semaforo: "sin-datos" },
  { mes: "Mayo", ventas: 40123, metaVentas: 45000, profit: 8920, metaProfit: 5000, cogs: 8023, margenBrutoPct: 80.0, cpv: 16.40, roas: 3.1, margenNetoPct: 22.2, semaforo: "verde" },
  { mes: "Junio", ventas: 0, metaVentas: 41667, profit: 0, metaProfit: 7083, cogs: 0, margenBrutoPct: 0, cpv: null, roas: null, margenNetoPct: null, semaforo: "sin-datos" },
  { mes: "Julio", ventas: 0, metaVentas: 41667, profit: 0, metaProfit: 7083, cogs: 0, margenBrutoPct: 0, cpv: null, roas: null, margenNetoPct: null, semaforo: "sin-datos" },
  { mes: "Agosto", ventas: 0, metaVentas: 41667, profit: 0, metaProfit: 7083, cogs: 0, margenBrutoPct: 0, cpv: null, roas: null, margenNetoPct: null, semaforo: "sin-datos" },
  { mes: "Septiembre", ventas: 0, metaVentas: 41667, profit: 0, metaProfit: 7083, cogs: 0, margenBrutoPct: 0, cpv: null, roas: null, margenNetoPct: null, semaforo: "sin-datos" },
  { mes: "Octubre", ventas: 0, metaVentas: 41667, profit: 0, metaProfit: 7083, cogs: 0, margenBrutoPct: 0, cpv: null, roas: null, margenNetoPct: null, semaforo: "sin-datos" },
  { mes: "Noviembre", ventas: 0, metaVentas: 41667, profit: 0, metaProfit: 7083, cogs: 0, margenBrutoPct: 0, cpv: null, roas: null, margenNetoPct: null, semaforo: "sin-datos" },
  { mes: "Diciembre", ventas: 0, metaVentas: 41663, profit: 0, metaProfit: 7083, cogs: 0, margenBrutoPct: 0, cpv: null, roas: null, margenNetoPct: null, semaforo: "sin-datos" },
];

export const METAS_CONFIG_MOCK = {
  ventasAnual: 500000,
  profitAnual: 85000,
  margenObjetivoPct: 20,
};

export const METAS_TIENDA_MOCK = [
  { tienda: "Tienda A", ventas: 40123, metaVentas: 300000, profit: 875, metaProfit: 40000 },
  { tienda: "Tienda B", ventas: 14703, metaVentas: 200000, profit: 8045, metaProfit: 45000 },
];

export const MEJOR_MES_MOCK = {
  mes: "Mayo 2026",
  filas: [
    { label: "Ventas", valor: "S/ 40,123" },
    { label: "Profit", valor: "S/ 8,920" },
    { label: "Margen", valor: "22.2%" },
    { label: "CPV", valor: "S/ 16.40" },
  ],
  porque: "Ventas 2.7× más que enero. Courier más eficiente (CPV bajó a S/ 16.40 vs S/ 30.49 en enero). Mayor volumen diluye gastos fijos.",
};

export const PEOR_MES_MOCK = {
  mes: "Febrero 2026",
  filas: [
    { label: "Ventas", valor: "S/ 14,703" },
    { label: "Pérdida", valor: "−S/ 4,559" },
    { label: "Margen", valor: "—" },
    { label: "CPV", valor: "S/ 31.33" },
  ],
  porque: "Ventas de S/ 14,703 no cubrieron gastos fijos de S/ 10,650. Se necesitaban al menos S/ 18,000 en ventas para no perder. Punto de equilibrio: 85 unidades.",
};

export interface GastoAnualFila {
  categoria: string;
  valores: number[]; // 12 meses, 0 = sin registrar (proyectado)
  proyectado?: boolean[];
}

export const GASTOS_ANUAL_MOCK: GastoAnualFila[] = [
  { categoria: "Planilla", valores: [6650, 6650, 6650, 6650, 6650, 6650, 6650, 6650, 6650, 6650, 6650, 6650], proyectado: [false, false, true, true, false, true, true, true, true, true, true, true] },
  { categoria: "Alquiler", valores: [2800, 2800, 2800, 2800, 2800, 2800, 2800, 2800, 2800, 2800, 2800, 2800], proyectado: [false, false, true, true, false, true, true, true, true, true, true, true] },
  { categoria: "Servicios", valores: [300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 300, 300], proyectado: [false, false, true, true, false, true, true, true, true, true, true, true] },
  { categoria: "Suscripciones", valores: [310, 310, 310, 310, 310, 310, 310, 310, 310, 310, 310, 310], proyectado: [false, false, true, true, false, true, true, true, true, true, true, true] },
  { categoria: "Útiles", valores: [340, 0, 0, 0, 340, 0, 0, 0, 0, 0, 0, 0], proyectado: [false, true, true, true, false, true, true, true, true, true, true, true] },
];

export const COMPARATIVO_MOCK = [
  { kpi: "Ventas", v2025: "S/ 40,123", v2026: "S/ 80,246", delta: "+100%" },
  { kpi: "Profit", v2025: "S/ 875", v2026: "S/ 5,236", delta: "+498%" },
  { kpi: "Margen prom.", v2025: "3.4%", v2026: "16.1%", delta: "+12.7pp" },
  { kpi: "CPV prom.", v2025: "S/ 30.49", v2026: "S/ 16.40", delta: "−46.2%" },
];
