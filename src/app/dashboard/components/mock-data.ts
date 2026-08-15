// Datos de ejemplo para maquetar el Panel de Control.
// TODO: reemplazar por datos reales de los microservicios cuando se conecte la API.
//
// Nota: en el tab "Resumen General" (OverviewTab) ya casi todo está conectado a
// datos reales — solo mockAlert y mockModulos siguen en uso ahí (ver comentarios
// en OverviewTab.tsx). Todo lo demás en este archivo alimenta las otras 7 tabs,
// que todavía son 100% mock.

export const mockAlert = {
  title: "5 pedidos TikTok sin confirmar +12h · S/ 795 en riesgo",
  subtitle: "8 pedidos Web COD sin contactar hace 3+ días",
};

export const mockModulos = [
  { key: "inventario", icon: "Package", label: "Inventario", value: "6", sub: "SKUs críticos", status: "⚠ bajo mín.", statusClass: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400", valueClass: "text-red-600 dark:text-red-400" },
  { key: "operaciones", icon: "Settings2", label: "Operaciones", value: "44", sub: "Sin guía asig.", status: "8.2% incid.", statusClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400", valueClass: "text-amber-600 dark:text-amber-400" },
  { key: "courier", icon: "Truck", label: "Seguimiento", value: "145", sub: "En tránsito", status: "4.1d prom.", statusClass: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400", valueClass: "text-violet-600 dark:text-violet-400" },
  { key: "atencion", icon: "Headphones", label: "Aten. Cliente", value: "4", sub: "Tickets abiertos", status: "⚠ urgentes", statusClass: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400", valueClass: "text-red-600 dark:text-red-400" },
  { key: "callcenter", icon: "Phone", label: "Call Center", value: "64.3%", sub: "Tasa confirmación", status: "5 agentes", statusClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400", valueClass: "text-emerald-600 dark:text-emerald-400" },
  { key: "courier2", icon: "Truck", label: "Courier", value: "80.8%", sub: "Efectividad global", status: "🔴 COD venc.", statusClass: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400", valueClass: "text-amber-600 dark:text-amber-400" },
  { key: "clientes", icon: "Users", label: "Clientes", value: "63", sub: "Nuevos este mes", status: "3% recompra", statusClass: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400", valueClass: "text-foreground" },
];

// ── ANÁLISIS COMERCIAL ──────────────────────────────────
export const mockComercialKpis = [
  { label: "Facturación Neta", value: "S/ 127,050", sub: "847 ped. · S/150 ticket", trend: { label: "+22% vs Abr", direction: "up" as const }, primary: true },
  { label: "Upsell Total", value: "S/ 19,100", sub: "15% del total facturado", trend: { label: "272 upsells", direction: "up" as const }, valueClassName: "text-violet-600 dark:text-violet-400" },
  { label: "Canal Top", value: "WhatsApp", sub: "296 ped. · S/44,400", trend: { label: "74.3% efectividad", direction: "up" as const } },
  { label: "Mejor Efectividad", value: "82.2%", sub: "Web / Shopify", trend: { label: "canal directo", direction: "up" as const }, valueClassName: "text-emerald-600 dark:text-emerald-400" },
  { label: "Prod. Prom./Pedido", value: "1.9", sub: "Promedio global", trend: { label: "IG lidera 2.1", direction: "neutral" as const } },
];

export const mockCanalesTabla = [
  { canal: "WhatsApp", tipo: "Directo", tipoClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400", dot: "bg-emerald-500", pedidos: 296, ticket: "S/ 150", prodPorPedido: "1.8", facturacion: "S/ 44,400", efectividad: "74.3%", efectividadClass: "text-amber-600 dark:text-amber-400", upsell: "S/ 6,200" },
  { canal: "TikTok Live", tipo: "ATC", tipoClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400", dot: "bg-slate-800 dark:bg-slate-300", pedidos: 237, ticket: "S/ 150", prodPorPedido: "1.6", facturacion: "S/ 35,550", efectividad: "70.9%", efectividadClass: "text-amber-600 dark:text-amber-400", upsell: "S/ 5,600" },
  { canal: "Instagram", tipo: "Directo", tipoClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400", dot: "bg-pink-500", pedidos: 152, ticket: "S/ 150", prodPorPedido: "2.1", facturacion: "S/ 22,800", efectividad: "72.4%", efectividadClass: "text-amber-600 dark:text-amber-400", upsell: "S/ 3,400" },
  { canal: "Facebook", tipo: "ATC", tipoClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400", dot: "bg-blue-500", pedidos: 61, ticket: "S/ 150", prodPorPedido: "1.5", facturacion: "S/ 9,150", efectividad: "65.6%", efectividadClass: "text-red-600 dark:text-red-400", upsell: "S/ 1,800" },
  { canal: "Web / Shopify", tipo: "Directo", tipoClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400", dot: "bg-lime-500", pedidos: 101, ticket: "S/ 150", prodPorPedido: "2.3", facturacion: "S/ 15,150", efectividad: "82.2%", efectividadClass: "text-emerald-600 dark:text-emerald-400", upsell: "S/ 2,100" },
];

export const mockCanalesTotal = { pedidos: 847, ticket: "S/ 150", facturacion: "S/ 127,050", upsell: "S/ 19,100" };

export const mockTopProductos = [
  { nombre: "Botines Chunky Camel", unidades: 210, canales: ["WA", "TK"], facturacion: "S/ 31,500", upsell: "S/ 4,200", costo: "S/ 48", margen: "49%", margenClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
  { nombre: "Bolso Aracely", unidades: 165, canales: ["IG", "WA"], facturacion: "S/ 24,750", upsell: "S/ 2,800", costo: "S/ 55", margen: "39%", margenClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" },
  { nombre: "Zapatillas Trend", unidades: 140, canales: ["TK", "Web"], facturacion: "S/ 10,360", upsell: "S/ 1,900", costo: "S/ 38", margen: "49%", margenClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
  { nombre: "Crema Hidratante", unidades: 97, canales: ["IG"], facturacion: "S/ 9,700", upsell: "S/ 3,100", costo: "S/ 18", margen: "63%", margenClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
  { nombre: "Vestido Floral Rosa", unidades: 85, canales: ["IG", "WA"], facturacion: "S/ 9,350", upsell: "S/ 1,200", costo: "S/ 52", margen: "53%", margenClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
];

export const mockTopProductosTotal = { unidades: 697, facturacion: "S/ 85,660", upsell: "S/ 13,200" };

// ── GEOGRAFÍA & CLIENTES ────────────────────────────────
export const mockGeoKpis = [
  { label: "Zona Top", value: "Lima", sub: "52.8% del total", primary: true },
  { label: "Pago Líder", value: "YAPE", sub: "69.6% de acogida", trend: { label: "dominante", direction: "up" as const } },
  { label: "Total Clientes", value: "63", sub: "+63 este mes", trend: { label: "nuevos", direction: "up" as const } },
  { label: "Tasa Recompra", value: "3%", sub: "Meta: >35%", trend: { label: "muy bajo", direction: "down" as const }, valueClassName: "text-amber-600 dark:text-amber-400" },
  { label: "LTV Estimado", value: "S/ 130", sub: "Valor de por vida", trend: { label: "1 compra prom.", direction: "neutral" as const } },
];

export const mockGeoDepartamentos = [
  { name: "Lima", pct: 52.8 },
  { name: "Ica", pct: 8.6 },
  { name: "Piura", pct: 5.8 },
  { name: "San Martín", pct: 4.6 },
  { name: "La Libertad", pct: 3.5 },
  { name: "Callao", pct: 3.4 },
  { name: "Loreto", pct: 2.7 },
];

export const mockGeoPendientes = [
  { label: "Lima/Callao pend.", value: 9, className: "bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  { label: "Provincia pend.", value: 10, className: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400" },
];

export const mockPagosDetalle = [
  { name: "YAPE", pct: "69.6%", color: "bg-violet-500", textColor: "text-violet-600 dark:text-violet-400" },
  { name: "Transferencia", pct: "18.2%", color: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400" },
  { name: "Efectivo", pct: "8.6%", color: "bg-emerald-500", textColor: "text-emerald-600 dark:text-emerald-400" },
  { name: "Otros", pct: "3.6%", color: "bg-amber-500", textColor: "text-amber-600 dark:text-amber-400" },
];

export const mockRetencion = [
  { label: "1 compra", value: "61", className: "bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  { label: "2–3 compras", value: "2", className: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  { label: "recompra", value: "3%", className: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400" },
];

// ── EQUIPO & UPSELL ──────────────────────────────────────
export const mockVendedores = [
  { rank: "🥇", top: true, name: "María Castro", initials: "MC", color: "bg-violet-600", equipo: "Kunca · 8 meses", canal: "WA", asignados: 18, ventas: 14, ventasPct: "77.8%", ordenes: 14, productos: 38, prodOrd: "2.7", ticketProm: "S/ 75", factBase: "S/ 1,050", upsell: "+S/ 312", upsellPct: "+29.7%", badge: "⭐ Top upsell" },
  { rank: "🥈", name: "José Ríos", initials: "JR", color: "bg-blue-500", equipo: "Kunca · 5 meses", canal: "WA", asignados: 16, ventas: 10, ventasPct: "62.5%", ordenes: 10, productos: 22, prodOrd: "2.2", ticketProm: "S/ 74", factBase: "S/ 740", upsell: "+S/ 197", upsellPct: "+26.6%" },
  { rank: "🥉", name: "Lucía Vargas", initials: "LV", color: "bg-pink-500", equipo: "Livii · 2 meses", canal: "IG", asignados: 9, ventas: 5, ventasPct: "55.6%", ordenes: 5, productos: 12, prodOrd: "2.4", ticketProm: "S/ 95", factBase: "S/ 477", upsell: "+S/ 97", upsellPct: "+20.3%" },
  { rank: "4", name: "Carlos Pinto", initials: "CP", color: "bg-amber-500", equipo: "Kunca · 3 semanas", canal: "WA", asignados: 8, ventas: 3, ventasPct: "37.5%", ordenes: 3, productos: 7, prodOrd: "2.3", ticketProm: "S/ 92", factBase: "S/ 277", upsell: "+S/ 0", upsellPct: "sin upsell", badge: "📚 Coaching", coaching: true },
];

export const mockVendedoresTotal = { asignados: 51, ventas: 32, ventasPct: "62.7%", ordenes: 32, productos: 79, prodOrd: "2.5", ticketProm: "S/ 80", factBase: "S/ 2,544", upsell: "+S/ 606" };

export const mockEquipoKpis = [
  { label: "Top Agente", value: "Heidi Medina", sub: "S/ 5,760 upsell · 48% rate", trend: { label: "🥇 55.5% conv.", direction: "up" as const }, primary: true },
  { label: "Agentes ATC", value: "5", sub: "1,220 asignados total", trend: { label: "527 confirmados", direction: "neutral" as const } },
  { label: "Tasa Confirmación CC", value: "64.3%", sub: "527 / 820 gestionados", trend: { label: "sobre meta", direction: "up" as const }, valueClassName: "text-emerald-600 dark:text-emerald-400" },
  { label: "Tasa No Contesta", value: "20.9%", sub: "171 / 820 · meta <15%", trend: { label: "sobre límite", direction: "down" as const }, valueClassName: "text-amber-600 dark:text-amber-400" },
  { label: "Speed to Call", value: "45 min", sub: "Meta: <30 min", trend: { label: "⚠ atención", direction: "down" as const }, valueClassName: "text-amber-600 dark:text-amber-400" },
];

export const mockAgentesCC = [
  { name: "Heidi Medina", initials: "HM", color: "bg-amber-500", top: true, meta: "🥇 Top performer", canales: ["TK", "WA"], asignados: 310, confirmados: "172 ped.", nc: 68, anulados: 26, conv: "55.5%", convClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400", upsellRate: "48%", upsellVal: "S/ 5,760", tmc: "3.2 min", tmcClass: "text-emerald-600 dark:text-emerald-400" },
  { name: "Joel Coila", initials: "JC", color: "bg-violet-600", canales: ["WA", "IG"], asignados: 290, confirmados: "145 ped.", nc: 58, anulados: 22, conv: "50%", convClass: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400", upsellRate: "40%", upsellVal: "S/ 4,800", tmc: "3.8 min" },
  { name: "Ana Quispe", initials: "AQ", color: "bg-emerald-500", canales: ["TK"], asignados: 240, confirmados: "108 ped.", nc: 40, anulados: 24, conv: "45%", convClass: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400", upsellRate: "35%", upsellVal: "S/ 3,500", tmc: "4.1 min" },
  { name: "María López", initials: "ML", color: "bg-pink-500", canales: ["WA", "TK"], asignados: 200, confirmados: "68 ped.", nc: 32, anulados: 18, conv: "34%", convClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400", upsellRate: "22%", upsellVal: "S/ 2,640", tmc: "5.2 min", tmcClass: "text-amber-600 dark:text-amber-400" },
  { name: "Carlos Rojas", initials: "CR", color: "bg-red-500", coaching: true, canales: ["TK", "IG"], asignados: 180, confirmados: "34 ped.", nc: 73, anulados: 55, conv: "18.9%", convClass: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400", upsellRate: "15%", upsellVal: "S/ 1,700", tmc: "4.7 min", tmcClass: "text-red-600 dark:text-red-400" },
];

export const mockAgentesCCTotal = { asignados: 1220, confirmados: "527 ped.", nc: 271, anulados: 145, conv: "57.3%", upsellRate: "32%", upsellVal: "S/ 18,400", tmc: "4.2 min" };

export const mockCallCenterKpis = [
  { label: "Tasa confirmación", value: "64.3%", meta: "(527 / 820)", className: "text-emerald-600 dark:text-emerald-400" },
  { label: "Speed to call", value: "45 min", badge: "⚠ meta <30", className: "text-amber-600 dark:text-amber-400", badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" },
  { label: "TMC promedio", value: "4.2 min" },
  { label: "Tasa No Contesta", value: "20.9%", meta: "(171/820)", className: "text-red-600 dark:text-red-400" },
  { label: "Tasa anulación", value: "11.0%", meta: "(90/820)", className: "text-red-600 dark:text-red-400" },
];

export const mockGestiones = [
  { label: "Confirmados", value: "527 ped.", className: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", valueClass: "text-blue-700 dark:text-blue-400" },
  { label: "No Contesta", value: "171", className: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400", valueClass: "text-red-600 dark:text-red-400" },
  { label: "Anulados", value: "90", className: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400", valueClass: "text-red-600 dark:text-red-400" },
  { label: "En proceso (reagendados)", value: "32", className: "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400", valueClass: "text-slate-600 dark:text-slate-400" },
];

// ── OPERACIONES ──────────────────────────────────────────
export const mockOperacionesKpis = [
  { label: "Sin Courier Asignado", value: "44", accent: "amber", note: "Asignar guías hoy" },
  { label: "Tiempo Ciclo Promedio", value: "3.8d", accent: "emerald", note: "Meta <5d ✓" },
  { label: "Retrasados en Envío +20d", value: "6", accent: "red", note: "Sin confirmar entrega" },
  { label: "Tasa Incidencia", value: "8.2%", accent: "amber", note: "Meta <5% ⚠" },
];

export const mockEstadoPedidos = [
  { label: "Pendiente", value: 44, pct: 5, color: "bg-slate-400", className: "text-slate-500" },
  { label: "Preparado", value: 20, pct: 2, color: "bg-amber-500", className: "text-amber-700 dark:text-amber-400" },
  { label: "Con guía", value: 55, pct: 6, color: "bg-violet-500", className: "text-violet-700 dark:text-violet-400" },
  { label: "En envío", value: 100, pct: 12, color: "bg-orange-500", className: "text-orange-700 dark:text-orange-400" },
  { label: "Entregado ✓", value: 612, pct: 72, color: "bg-emerald-500", className: "text-emerald-700 dark:text-emerald-400", bold: true },
  { label: "Rechazado/Dev.", value: 90, pct: 11, color: "bg-red-500", className: "text-red-700 dark:text-red-400" },
];

export const mockVelocidadEtapas = [
  { label: "Ingreso → Primera llamada", value: "45 min", className: "text-amber-600 dark:text-amber-400", warn: true },
  { label: "Llamada → Confirmado", value: "1.2d", className: "text-emerald-600 dark:text-emerald-400", ok: true },
  { label: "Confirmado → Despachado", value: "0.8d" },
  { label: "Despachado → Entregado", value: "3.8d" },
];

// ── COURIER ───────────────────────────────────────────────
export const mockCourierKpis = [
  { label: "Couriers Activos", value: "3", sub: "Shalom · Olva · Indriver" },
  { label: "Total Despachados", value: "757", sub: "612 entregados · 145 en tránsito", valueClassName: "text-emerald-600 dark:text-emerald-400" },
  { label: "Efectividad Global", value: "80.8%", sub: "612 de 757 despachados", primary: true },
  { label: "Total Costo Flete", value: "S/ 9,461", sub: "S/12.49 prom/guía · 757 guías" },
  { label: "COD Pendiente Liquidar", value: "S/ 18,300", sub: "🔴 Shalom S/12,480 vencido", accentDanger: true },
];

export const mockCouriersTabla = [
  { nombre: "🔵 Indriver", tipo: "Manual", tipoClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", envios: 162, entregados: 152, efectividad: "93.8%", efectividadClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400", devueltos: 10, tiempo: "2.1d", tiempoClass: "text-emerald-600 dark:text-emerald-400", costoProm: "S/ 8.50", costoPromClass: "text-emerald-600 dark:text-emerald-400", costoTotal: "S/ 1,377", codPend: "S/ 0", codPendClass: "text-emerald-600 dark:text-emerald-400", score: "A+", scoreClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400", highlight: "good" },
  { nombre: "🟠 Olva", tipo: "API", tipoClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400", envios: 215, entregados: 174, efectividad: "80.9%", efectividadClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400", devueltos: 41, devueltosClass: "text-amber-600 dark:text-amber-400", tiempo: "4.2d", costoProm: "S/ 12.00", costoTotal: "S/ 2,580", codPend: "S/ 5,820", codPendClass: "text-amber-600 dark:text-amber-400", score: "B+", scoreClass: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400" },
  { nombre: "📦 Shalom", tipo: "API", tipoClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400", envios: 380, entregados: 286, efectividad: "75.3%", efectividadClass: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400", devueltos: 94, devueltosClass: "text-red-600 dark:text-red-400", tiempo: "5.1d", tiempoClass: "text-amber-600 dark:text-amber-400", costoProm: "S/ 15.80", costoPromClass: "text-red-600 dark:text-red-400", costoTotal: "S/ 6,004", costoTotalClass: "text-red-600 dark:text-red-400", codPend: "S/ 12,480 🔴", codPendClass: "text-red-600 dark:text-red-400 font-bold", score: "B", scoreClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300", highlight: "warn" },
];

export const mockCourierTotal = { envios: 757, entregados: 612, efectividad: "80.8%", devueltos: 145, tiempo: "4.1d", costoProm: "S/ 12.49", costoTotal: "S/ 9,961", codPend: "S/ 18,300" };

// ── FINANZAS ──────────────────────────────────────────────
export const mockDistribucionMensual = [
  { mes: "Jun 2026", tag: "(parcial)", monto: "S/ 8,507.20", pct: 29, color: "bg-blue-500", initial: "J" },
  { mes: "May 2026", tag: "▲ Pico", tagClass: "text-emerald-600 dark:text-emerald-400", monto: "S/ 29,038.85", pct: 100, color: "bg-emerald-500", initial: "M" },
  { mes: "Abr 2026", monto: "S/ 21,010.26", pct: 72, color: "bg-amber-500", initial: "A" },
  { mes: "Mar 2026", monto: "S/ 23,290.60", pct: 80, color: "bg-violet-500", initial: "M" },
  { mes: "Feb 2026", monto: "S/ 23,846.10", pct: 82, color: "bg-pink-500", initial: "F" },
];

export const mockIngresosDiarios = [
  { day: "01", amount: 1100 }, { day: "02", amount: 850 }, { day: "03", amount: 820 },
  { day: "04", amount: 880 }, { day: "05", amount: 420 }, { day: "06", amount: 0 },
  { day: "07", amount: 420 }, { day: "08", amount: 420 }, { day: "09", amount: 380 },
  { day: "10", amount: 680 }, { day: "11", amount: 760, isToday: true },
];

export const mockFinanzasCards = [
  { label: "Facturación (Confirmados)", value: "S/ 127,050", sub: "847 ped. · S/150 ticket", accent: "emerald" },
  { label: "Cobrado / Liquidado", value: "S/ 73,440", sub: "612 entregados liquidados", accent: "emerald" },
  { label: "COD por Cobrar (en tránsito)", value: "S/ 18,300", sub: "145 guías en camino", accent: "amber" },
  { label: "Liquidaciones Vencidas", value: "S/ 12,480", sub: "🔴 Shalom +3d sin rendir", accent: "red" },
];

export const mockCostos = [
  { label: "Costo Mercadería", value: "S/ 74,037", sub: "58% del facturado" },
  { label: "Costo Envíos", value: "S/ 9,464", sub: "S/12.50 prom/guía" },
];

export const mockEvolucionMensual = [
  { mes: "Mayo", monto: "S/ 127,050", pct: 100, color: "bg-emerald-500", trend: "+22%", trendClass: "text-emerald-600 dark:text-emerald-400", bold: true },
  { mes: "Abril", monto: "S/ 104k", full: "S/ 104,181", pct: 82, color: "bg-blue-500" },
  { mes: "Marzo", monto: "S/ 112k", full: "S/ 111,804", pct: 88, color: "bg-violet-500" },
  { mes: "Febrero", monto: "S/ 99k", full: "S/ 99,099", pct: 78, color: "bg-amber-500" },
  { mes: "Enero", monto: "S/ 95k", full: "S/ 95,288", pct: 75, color: "bg-pink-500" },
];

export const mockPuntoEquilibrio = [
  { label: "Costos fijos mensuales", value: "S/ 8,400" },
  { label: "Margen por pedido (prom.)", value: "S/ 63" },
  { label: "Pedidos para equilibrio", value: "133 ped.", className: "text-amber-600 dark:text-amber-400" },
  { label: "Estado actual", value: "✓ Superado · 847 ped.", className: "text-emerald-600 dark:text-emerald-400" },
];
