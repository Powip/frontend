import {
  IBusinessOverview,
  ISerieMensual,
  IComposicionClientes,
  IAlertaImportante,
  IActividadEvento,
  IClienteEnRiesgo,
  IEmbudoEtapa,
  IAdopcionModulo,
  ICentroAccionTarea,
  ICanalRed,
  IOportunidadProducto,
} from "@/interfaces/superadmin";
import { nextId, hoursAgoISO, minutesAgoISO } from "./seed";
import { empresasMock } from "./empresas";
import { mrrHistoricoMock } from "./finanzas";
import { leadsMock, demosMock } from "./leads";

export const businessOverviewMock: IBusinessOverview = {
  mrr: 46530,
  mrrDeltaPct: 8.6,
  clientesActivos: empresasMock.filter((e) => e.estado === "activo").length,
  clientesActivosDeltaPct: 5.1,
  nuevosMes: 6,
  churnPct: 2.4,
  churnDeltaPct: -0.6,
  trialsActivos: empresasMock.filter((e) => e.estado === "trial").length,
  conversionTrialPagoPct: 31.5,
  ingresosHoy: 2140,
  demosHoy: demosMock.filter((d) => d.estado === "agendada").length,
};

export const mrrSerieMock: ISerieMensual[] = mrrHistoricoMock.map((m) => ({ mes: m.mes, valor: m.mrr }));

export const clientesActivosSerieMock: ISerieMensual[] = [
  { mes: "Mar", valor: 14 },
  { mes: "Abr", valor: 15 },
  { mes: "May", valor: 16 },
  { mes: "Jun", valor: 17 },
  { mes: "Jul", valor: 18 },
  { mes: "Ago", valor: empresasMock.filter((e) => e.estado === "activo").length },
];

export const composicionClientesMock: IComposicionClientes[] = [
  { segmento: "Recurrente (>1 mes activo)", count: 12, pct: 50, color: "#027778" },
  { segmento: "Nuevo (alta este mes)", count: 6, pct: 25, color: "#3B82F6" },
  { segmento: "Pago pendiente / en mora", count: empresasMock.filter((e) => e.estado === "riesgo").length, pct: 12, color: "#F5A623" },
  { segmento: "Cancelado este mes", count: empresasMock.filter((e) => e.estado === "inactivo").length, pct: 13, color: "#EF4655" },
];

export const alertasImportantesMock: IAlertaImportante[] = [
  { id: nextId("alerta"), texto: "TecnoHogar Express bajó sus ventas 40% este mes", severidad: "critical", ts: hoursAgoISO(2) },
  { id: nextId("alerta"), texto: "Certificado SUNAT de Casa & Deco Perú vence en 10 días", severidad: "warning", ts: hoursAgoISO(5) },
  { id: nextId("alerta"), texto: "3 leads sin abordar hace más de 24h", severidad: "warning", ts: hoursAgoISO(6) },
  { id: nextId("alerta"), texto: "Factura de Zapatillas Norte vencida hace 8 días", severidad: "critical", ts: hoursAgoISO(24) },
];

export const actividadRecienteMock: IActividadEvento[] = [
  { id: nextId("act"), actorNombre: "Heidy Medina", actorColor: "bg-blue-500", accion: "convirtió el lead", referencia: "Belleza Andina Store", ts: minutesAgoISO(12) },
  { id: nextId("act"), actorNombre: "Marcela Guerrero", actorColor: "bg-emerald-500", accion: "agendó una demo con", referencia: "Ropa Kids Chorrillos", ts: minutesAgoISO(40) },
  { id: nextId("act"), actorNombre: "Diego Salazar", actorColor: "bg-amber-500", accion: "resolvió el ticket", referencia: "TCK-1004", ts: hoursAgoISO(1) },
  { id: nextId("act"), actorNombre: "Sistema", actorColor: "bg-slate-500", accion: "cobró la suscripción de", referencia: "Bella Piel Cosmética", ts: hoursAgoISO(2) },
  { id: nextId("act"), actorNombre: "Rosario Campos", actorColor: "bg-violet-500", accion: "registró gestión con", referencia: "Casa & Deco Perú", ts: hoursAgoISO(3) },
];

export const clientesEnRiesgoMock: IClienteEnRiesgo[] = empresasMock
  .filter((e) => e.estado === "riesgo")
  .map((e) => ({ empresaId: e.id, empresaNombre: e.nombre, motivo: "Uso bajó y tiene pagos pendientes" }));

export const embudoComercialMock: IEmbudoEtapa[] = (() => {
  const etapas: { etapa: string; estado: string; color: string }[] = [
    { etapa: "Nuevo", estado: "nuevo", color: "#3B82F6" },
    { etapa: "Contactado", estado: "contactado", color: "#8B5CF6" },
    { etapa: "Demo", estado: "demo", color: "#F5A623" },
    { etapa: "Decisión", estado: "decision", color: "#F5A623" },
    { etapa: "Ganado", estado: "ganado", color: "#12B886" },
  ];
  const total = leadsMock.length || 1;
  return etapas.map((e) => {
    const count = leadsMock.filter((l) => l.estado === e.estado).length;
    return { etapa: e.etapa, count, pct: Math.round((count / total) * 100), color: e.color };
  });
})();

export const adopcionModulosMock: IAdopcionModulo[] = [
  { modulo: "Ventas", pct: 92 },
  { modulo: "Inventario", pct: 78 },
  { modulo: "SUNAT", pct: 41 },
  { modulo: "Couriers", pct: 65 },
  { modulo: "Call Center", pct: 33 },
];

export const centroAccionMock: ICentroAccionTarea[] = [
  { id: nextId("tarea"), texto: "Contactar a TecnoHogar Express (riesgo alto)", prioridad: "Alta", hecho: false },
  { id: nextId("tarea"), texto: "Aprobar liquidación de Agencia Digital Norte", prioridad: "Alta", hecho: false },
  { id: nextId("tarea"), texto: "Revisar 3 leads sin abordar", prioridad: "Media", hecho: false },
  { id: nextId("tarea"), texto: "Confirmar renovación de certificado SUNAT", prioridad: "Media", hecho: true },
  { id: nextId("tarea"), texto: "Publicar anuncio de reportes programados", prioridad: "Baja", hecho: true },
];

export const canalesRedMock: ICanalRed[] = [
  { canal: "WhatsApp", count: 18, pct: 75 },
  { canal: "Web", count: 9, pct: 38 },
  { canal: "Instagram", count: 7, pct: 29 },
  { canal: "TikTok", count: 5, pct: 21 },
  { canal: "Mercado Libre", count: 4, pct: 17 },
  { canal: "Shopify", count: 3, pct: 13 },
];

export const oportunidadProductoMock: IOportunidadProducto = {
  titulo: "Priorizar integración nativa con TikTok Shop",
  motivo: "El 21% de los negocios ya vende por TikTok/TikTok Live sin integración directa, sincronizando manualmente.",
};
