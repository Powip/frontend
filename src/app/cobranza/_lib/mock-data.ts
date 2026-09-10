/* -----------------------------------------------------------------------
   Datos de ejemplo del Panel del negocio — Hito 1 · Cobranza.
   Reflejan 1:1 los datos de POWIP_Hito1_Mockup.html (fuente de verdad visual).
   Las APIs reales (§8 de la especificación) todavía no existen: esta sección
   es la referencia de FE mientras Backend construye los endpoints.
------------------------------------------------------------------------ */

export function money(n: number): string {
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export type EstadoCodigo = "activo" | "validado" | "en_camino" | "expirado";

export interface CodigoEntregaRow {
  codigo: string;
  orden: string;
  cliente: string;
  monto: number;
  estado: EstadoCodigo;
  validadoA: string;
}

export const CODIGOS_ENTREGA: CodigoEntregaRow[] = [
  { codigo: "7284", orden: "ORD-012247", cliente: "Joel García", monto: 121, estado: "activo", validadoA: "—" },
  { codigo: "3948", orden: "ORD-012244", cliente: "María Quispe", monto: 71.8, estado: "validado", validadoA: "2:30pm" },
  { codigo: "5712", orden: "ORD-012241", cliente: "Pedro Gil", monto: 79, estado: "en_camino", validadoA: "—" },
  { codigo: "8849", orden: "ORD-012238", cliente: "Ana Torres", monto: 85, estado: "activo", validadoA: "—" },
  { codigo: "1029", orden: "ORD-012230", cliente: "Rosa Chávez", monto: 65, estado: "expirado", validadoA: "—" },
];

export const CODIGOS_KPIS = {
  activos: 47,
  validadosHoy: 12,
  enCamino: 8,
  expirados: 3,
};

export interface GuiaOrderRow {
  orden: string;
  cliente: string;
  ciudad: string;
  total: number;
  cobrar: number | null;
}

export const GUIA_PEDIDOS: GuiaOrderRow[] = [
  { orden: "ORD-142781", cliente: "Ricardo Elias Briceño", ciudad: "Huamachuco", total: 169, cobrar: 139 },
  { orden: "ORD-142748", cliente: "Evelin Balcón Choque", ciudad: "Puno", total: 169, cobrar: 139 },
  { orden: "ORD-142732", cliente: "Jhuliana Meneses", ciudad: "Cajamarca", total: 99, cobrar: 69 },
  { orden: "ORD-142710", cliente: "Marina Paucar Baez", ciudad: "San Juan Bautista", total: 115, cobrar: 75 },
  { orden: "ORD-142312", cliente: "Fátima Hernández", ciudad: "Tambo Grande", total: 89, cobrar: null },
];

export const GUIA_ACTIVA = {
  codigo: "GE-202609-01647",
  creada: "04/09/2026",
  estado: "APROBADA",
  zona: "Provincias",
  pedidos: GUIA_PEDIDOS.length,
  cobranzaTotal: 422,
  pendientePago: 422,
  courier: "Shalom",
  tipoCobro: "Contra entrega · Provincias",
  linkRepartidor: "powip.lat/rep/SHL-7B29X-01647",
};

export interface YapeComprobanteRow {
  orden: string;
  cliente: string;
  monto: number;
  hora: string;
}

export const YAPES_PENDIENTES: YapeComprobanteRow[] = [
  { orden: "ORD-010637", cliente: "Yesenia Quispe", monto: 84, hora: "10:32" },
  { orden: "ORD-010635", cliente: "Patricia Huamanchumo", monto: 65, hora: "10:48" },
  { orden: "ORD-010639", cliente: "Patricia Huamanchumo", monto: 120, hora: "11:05" },
];

export type MetodoPago = "Efectivo" | "Yape" | "MP" | "Pago Link";
export type CanalPago = "WhatsApp" | "Catálogo" | "Live" | "Upsell";

export interface PagoManualRow {
  orden: string;
  cliente: string;
  telefono: string;
  canal: CanalPago;
  metodo: MetodoPago;
  codigoOp: string;
  region: "Lima" | "Provincia";
  courier: string;
  estado: "Pendiente" | "Aprobado MP";
}

export const PAGOS_MANUALES: PagoManualRow[] = [
  { orden: "ORD-010636", cliente: "Joel Coila Osnayo", telefono: "+51 947 424 006", canal: "WhatsApp", metodo: "Efectivo", codigoOp: "—", region: "Lima", courier: "—", estado: "Pendiente" },
  { orden: "ORD-010637", cliente: "Yesenia Quispe", telefono: "+51 966 305 638", canal: "Catálogo", metodo: "Yape", codigoOp: "847392", region: "Provincia", courier: "Shalom", estado: "Pendiente" },
  { orden: "ORD-010635", cliente: "Patricia Huamanchumo", telefono: "+51 970 776 823", canal: "WhatsApp", metodo: "Yape", codigoOp: "512938", region: "Provincia", courier: "Olva", estado: "Pendiente" },
  { orden: "ORD-010640", cliente: "Patricia Huamanchumo", telefono: "+51 970 776 823", canal: "WhatsApp", metodo: "Pago Link", codigoOp: "—", region: "Lima", courier: "—", estado: "Pendiente" },
  { orden: "ORD-010639", cliente: "Patricia Huamanchumo", telefono: "+51 970 776 823", canal: "Live", metodo: "Yape", codigoOp: "293847", region: "Provincia", courier: "Shalom", estado: "Pendiente" },
  { orden: "ORD-010633", cliente: "Patricia Huamanchumo", telefono: "+51 970 776 823", canal: "Upsell", metodo: "MP", codigoOp: "Auto MP", region: "Provincia", courier: "Olva", estado: "Aprobado MP" },
];

export interface NotificacionTemplate {
  id: string;
  trigger: string;
  mensaje: string;
  activo: boolean;
}

export const NOTIFICACIONES_INICIALES: NotificacionTemplate[] = [
  { id: "pago_confirmado", trigger: "Pago confirmado", mensaje: "✅ ¡Pago recibido, Joel! Tu código de entrega es *7284*. Te avisamos cuando tu pedido esté en camino.", activo: true },
  { id: "despachado", trigger: "Despachado", mensaje: "📦 Tu pedido ORD-012247 salió con Shalom (guía GE-…01647). Síguelo aquí: powip.lat/s/8f2a", activo: true },
  { id: "listo_agencia", trigger: "Listo en agencia", mensaje: "🏢 ¡Llegó! Recoge tu pedido en la Agencia Shalom Cercado (Av. Ejército 210) con tu DNI y tu código 7284.", activo: true },
  { id: "saldo_pendiente", trigger: "Saldo pendiente", mensaje: "👋 Hola Joel, tu pedido está listo. Paga tu saldo aquí para activar tu entrega: powip.lat/s/8f2a", activo: true },
];

export interface FlotaRepartidorRow {
  nombre: string;
  iniciales: string;
  color: string;
  detalle: string;
  entregados: number;
  totalPedidos: number;
  ultimaActualizacion: string;
  conGps: boolean;
}

export const FLOTA_REPARTIDORES: FlotaRepartidorRow[] = [
  { nombre: "Luis Mamani", iniciales: "LM", color: "#4C2FB5", detalle: "Moto propia · Guía SHL-7B29X-01647", entregados: 2, totalPedidos: 5, ultimaActualizacion: "hace 12 s", conGps: true },
  { nombre: "Ana Flores", iniciales: "AF", color: "#027778", detalle: "Moto propia · Cercado y Cayma", entregados: 1, totalPedidos: 4, ultimaActualizacion: "hace 20 s", conGps: true },
  { nombre: "Shalom — Provincias", iniciales: "SH", color: "#8b93a1", detalle: "Seguimiento por estados · sin GPS", entregados: 0, totalPedidos: 0, ultimaActualizacion: "en tránsito", conGps: false },
];

export const MP_ACCOUNT = {
  email: "jookbusiness@gmail.com",
  razonSocial: "Jook Business SAC · APP ID 12847392",
  activaDesde: "12 ene 2026",
  comisionPct: 0.5,
};

export const MP_COBROS_POR_CANAL = [
  { label: "Cobranza link (deuda)", monto: 4840, pct: 57, color: "bg-blue-500" },
  { label: "Catálogo / recompra", monto: 2350, pct: 28, color: "bg-violet-500" },
  { label: "Upsell pre-despacho", monto: 1230, pct: 15, color: "bg-green-500" },
];
