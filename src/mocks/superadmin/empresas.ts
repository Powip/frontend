import {
  IEmpresa,
  IUsuarioEmpresa,
  ICompletitudEmpresa,
  IHealthFactor,
  IVentaMensual,
  IVentaCanal,
  IPedidoResumen,
  ISkuResumen,
  IComprobanteSunat,
  IUpsellOportunidad,
  IIntegracionEmpresa,
  PlanEmpresa,
  EstadoEmpresa,
  OrigenEmpresa,
  CanalVenta,
} from "@/interfaces/superadmin";
import { NEGOCIOS, PERSONAS, COURIERS, daysAgoISO, money } from "./seed";

const PLANES: PlanEmpresa[] = ["Basic", "Pro", "Scale", "Enterprise", "Trial"];
const ESTADOS: EstadoEmpresa[] = ["activo", "activo", "activo", "riesgo", "trial", "activo", "inactivo", "activo"];
const ORIGENES: OrigenEmpresa[] = ["lead_sdr", "web_self_serve", "partner", "organico"];
const CANALES: CanalVenta[] = ["WhatsApp", "Web", "TikTok", "Instagram", "Shopify", "Mercado Libre", "Falabella", "Ripley", "TikTok Live"];

export const empresasMock: IEmpresa[] = NEGOCIOS.map((n, i) => {
  const plan = PLANES[i % PLANES.length];
  const estado = ESTADOS[i % ESTADOS.length];
  const mrr = plan === "Trial" ? 0 : money(i + 1, 180, 3200);
  const canalesVenta = [CANALES[i % CANALES.length], CANALES[(i + 3) % CANALES.length]].filter(
    (v, idx, arr) => arr.indexOf(v) === idx
  );
  return {
    id: `emp-${String(i + 1).padStart(3, "0")}`,
    nombre: n.nombre,
    dominio: `${n.iniciales.toLowerCase()}.pe`,
    ruc: `20${600000000 + i * 137}`,
    plan,
    estado,
    mrr,
    healthScore: estado === "riesgo" ? 35 + (i % 15) : estado === "inactivo" ? 12 : 68 + (i % 30),
    canalesVenta,
    pedidos30d: estado === "trial" ? 0 : Math.round(20 + money(i, 0, 400)),
    usuariosCount: 1 + (i % 6),
    ultimoAcceso: daysAgoISO(i % 12),
    origen: ORIGENES[i % ORIGENES.length],
    partnerId: ORIGENES[i % ORIGENES.length] === "partner" ? `par-${(i % 6) + 1}` : undefined,
    partnerCod: ORIGENES[i % ORIGENES.length] === "partner" ? `REF-${n.iniciales}` : undefined,
    rubro: n.rubro,
    tipoProductos: n.rubro,
    ltv: mrr * (10 + (i % 20)),
    antiguedadMeses: 2 + (i % 30),
    logoIniciales: n.iniciales,
    colorAvatar: n.color,
    creadoEn: daysAgoISO(60 + i * 23),
  };
});

export const usuariosEmpresaMock: IUsuarioEmpresa[] = empresasMock.flatMap((emp, i) =>
  Array.from({ length: 1 + (i % 3) }, (_, j) => ({
    id: `ue-${emp.id}-${j}`,
    empresaId: emp.id,
    empresaNombre: emp.nombre,
    nombre: PERSONAS[(i + j) % PERSONAS.length],
    email: `${PERSONAS[(i + j) % PERSONAS.length].toLowerCase().split(" ")[0]}@${emp.dominio}`,
    rol: j === 0 ? "Administrador" : j === 1 ? "Vendedor" : "Soporte",
    estado: i % 9 === 0 && j === 2 ? "invitado" : "activo",
    registro: daysAgoISO(50 + i * 10 + j),
    ultimoAcceso: daysAgoISO(i % 10),
  }))
);

export function getCompletitud(empresa: IEmpresa): ICompletitudEmpresa {
  const usaModulos = empresa.estado !== "trial" && empresa.plan !== "Trial";
  const catalogo = usaModulos;
  const pedidos = usaModulos && empresa.pedidos30d > 0;
  const courier = usaModulos && empresa.pedidos30d > 30;
  const sunat = usaModulos && empresa.plan !== "Basic";
  const pagos = usaModulos;
  const canales = empresa.canalesVenta.length > 0;
  const flags = [catalogo, pedidos, courier, sunat, pagos, canales];
  const pct = Math.round((flags.filter(Boolean).length / flags.length) * 100);
  return { catalogo, pedidos, courier, sunat, pagos, canales, pct };
}

export function getHealthFactores(empresa: IEmpresa): IHealthFactor[] {
  return [
    { label: "Uso diario (DAU)", valor: empresa.estado === "riesgo" ? "Bajó 40% este mes" : "Estable", positivo: empresa.estado !== "riesgo" },
    { label: "Pedidos últimos 30d", valor: `${empresa.pedidos30d} pedidos`, positivo: empresa.pedidos30d > 20 },
    { label: "Pagos a POWIP", valor: empresa.estado === "riesgo" ? "1 factura vencida" : "Al día", positivo: empresa.estado !== "riesgo" },
    { label: "Tickets de soporte", valor: empresa.estado === "riesgo" ? "2 abiertos, alta prioridad" : "Sin tickets abiertos", positivo: empresa.estado !== "riesgo" },
  ];
}

export function getVentasMensuales(empresaSeed: number): IVentaMensual[] {
  const meses = ["Mar", "Abr", "May", "Jun", "Jul", "Ago"];
  return meses.map((mes, i) => ({ mes, gmv: money(empresaSeed + i, 4000, 42000) }));
}

export function getVentasPorCanal(empresa: IEmpresa): IVentaCanal[] {
  const total = 100;
  const n = empresa.canalesVenta.length || 1;
  const base = Math.floor(total / n);
  return empresa.canalesVenta.map((canal, i) => ({
    canal,
    gmv: money(empresa.mrr + i, 2000, 18000),
    pct: i === n - 1 ? total - base * (n - 1) : base,
  }));
}

export function getPedidosRecientes(empresa: IEmpresa): IPedidoResumen[] {
  if (empresa.pedidos30d === 0) return [];
  const estados: IPedidoResumen["estado"][] = ["Entregado", "En camino", "Preparando", "Devuelto", "Entregado", "Anulado"];
  return Array.from({ length: 6 }, (_, i) => ({
    id: `PED-${empresa.id}-${i + 1}`,
    cliente: PERSONAS[(i + empresa.nombre.length) % PERSONAS.length],
    monto: money(i + empresa.mrr, 45, 480),
    estado: estados[i % estados.length],
    courier: COURIERS[i % COURIERS.length],
    fecha: daysAgoISO(i * 2),
  }));
}

export function getSkusTop(empresa: IEmpresa): ISkuResumen[] {
  if (!empresa.tipoProductos) return [];
  return Array.from({ length: 5 }, (_, i) => ({
    sku: `SKU-${empresa.logoIniciales}-${100 + i}`,
    nombre: `${empresa.tipoProductos} · variante ${i + 1}`,
    stock: Math.round(money(i + 3, 0, 120)),
    precio: money(i + empresa.mrr, 25, 220),
    vendidos30d: Math.round(money(i + 7, 5, 90)),
  }));
}

export function getComprobantesSunat(empresa: IEmpresa): IComprobanteSunat[] {
  if (empresa.plan === "Basic" || empresa.plan === "Trial") return [];
  return Array.from({ length: 4 }, (_, i) => ({
    id: `cbt-${empresa.id}-${i}`,
    tipo: i % 3 === 0 ? "Factura" : "Boleta",
    numero: `${i % 3 === 0 ? "F001" : "B001"}-${1000 + i}`,
    monto: money(i + empresa.mrr, 60, 900),
    igv: money(i + empresa.mrr, 10, 160),
    estado: i === 3 ? "Rechazado" : "Emitido",
    fecha: daysAgoISO(i * 3),
  }));
}

export function getUpsellOportunidades(empresa: IEmpresa): IUpsellOportunidad[] {
  const oportunidades: IUpsellOportunidad[] = [];
  if (empresa.plan === "Basic" || empresa.plan === "Pro") {
    oportunidades.push({
      titulo: "Módulo SUNAT",
      motivo: "Factura boletas manualmente fuera de POWIP — riesgo de incumplimiento.",
      mrrPotencial: 49,
      caliente: empresa.estado === "activo",
    });
  }
  if (!empresa.canalesVenta.includes("TikTok Live")) {
    oportunidades.push({
      titulo: "Canal TikTok Live",
      motivo: "Su rubro tiene alta conversión en TikTok Live y aún no lo usa.",
      mrrPotencial: 0,
      caliente: false,
    });
  }
  if (empresa.plan !== "Enterprise" && empresa.pedidos30d > 250) {
    oportunidades.push({
      titulo: "Upgrade a Scale/Enterprise",
      motivo: `${empresa.pedidos30d} pedidos/mes superan el límite recomendado de su plan actual.`,
      mrrPotencial: 120,
      caliente: true,
    });
  }
  return oportunidades;
}

export interface IPagosEmpresa {
  metodoCobro: string;
  codEnTransito: number;
  liquidacionPendiente: number;
  morosidadPct: number;
}

/** Simulado — ver docs/superadmin/empresas-endpoints.md, ya documentado en src/components/finanzas/BACKEND_REQUERIMIENTOS.md. */
export function getPagosEmpresa(empresa: IEmpresa): IPagosEmpresa {
  return {
    metodoCobro: "Contra entrega (COD)",
    codEnTransito: money(empresa.mrr + 3, 400, 6000),
    liquidacionPendiente: money(empresa.mrr + 9, 100, 2000),
    morosidadPct: empresa.estado === "riesgo" ? 8.4 : 0,
  };
}

export interface ITicketEmpresa {
  id: string;
  asunto: string;
  prioridad: "Alta" | "Media" | "Baja";
  estado: "Abierto" | "En proceso" | "Resuelto";
  creadoEn: string;
}

/** Simulado — no hay servicio de tickets real en el repo (ver /superadmin/soporte). */
export function getSoporteEmpresa(empresa: IEmpresa): ITicketEmpresa[] {
  if (empresa.estado !== "riesgo") return [];
  return [{ id: `tck-${empresa.id}`, asunto: "Consulta sobre facturación", prioridad: "Media", estado: "Abierto", creadoEn: daysAgoISO(2) }];
}

export function getIntegracionesEmpresa(empresa: IEmpresa): IIntegracionEmpresa[] {
  return [
    { nombre: "WhatsApp Business", conectada: true, categoria: "Comunicación" },
    { nombre: "Shopify", conectada: empresa.canalesVenta.includes("Shopify"), categoria: "Ecommerce" },
    { nombre: "Mercado Pago", conectada: empresa.plan !== "Trial", categoria: "Pagos" },
    { nombre: "SUNAT / OSE", conectada: empresa.plan !== "Basic" && empresa.plan !== "Trial", categoria: "Facturación" },
    { nombre: "Shalom Courier", conectada: empresa.pedidos30d > 30, categoria: "Envíos" },
  ];
}
