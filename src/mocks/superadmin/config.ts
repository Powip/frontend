import {
  ICupon,
  IAlertaConfig,
  IAnuncio,
  ICampana,
  IReporteDisponible,
  IReporteProgramado,
  IPlanConfig,
  IParametroGeneral,
} from "@/interfaces/superadmin";
import { daysAgoISO, daysFromNowISO, nextId } from "./seed";

export const cuponesMock: ICupon[] = [
  { id: "cup-1", codigo: "BIENVENIDA20", beneficio: "20% dcto. primer mes", aplicaA: "Todos los planes", estado: "activo", activo: true, usosCount: 84, vigenteHasta: daysFromNowISO(30) },
  { id: "cup-2", codigo: "BLACKFRIDAY26", beneficio: "1 mes gratis", aplicaA: "Plan Pro y Scale", estado: "activo", activo: true, usosCount: 12, vigenteHasta: daysFromNowISO(5) },
  { id: "cup-3", codigo: "REACTIVA15", beneficio: "15% dcto. 3 meses", aplicaA: "Cuentas canceladas", estado: "expirado", activo: false, usosCount: 31 },
];

export const alertasConfigMock: IAlertaConfig[] = [
  { id: "al-1", nombre: "Churn mensual > 3%", descripcion: "Notifica al equipo de Finanzas cuando el churn supera el umbral.", activo: true, severidad: "critical" },
  { id: "al-2", nombre: "Negocio baja ventas 40%", descripcion: "Alerta a CSM cuando el GMV de una cuenta cae fuerte mes a mes.", activo: true, severidad: "warning" },
  { id: "al-3", nombre: "Certificado SUNAT por vencer", descripcion: "Avisa 15 días antes de que venza un certificado P12.", activo: true, severidad: "warning" },
  { id: "al-4", nombre: "Lead sin abordar > 24h", descripcion: "Notifica al SDR responsable y a su líder de ventas.", activo: true, severidad: "warning" },
  { id: "al-5", nombre: "COD en tránsito > S/50k", descripcion: "Alerta a Operaciones sobre exposición de caja alta.", activo: false, severidad: "critical" },
];

export const anunciosMock: IAnuncio[] = [
  { id: "an-1", titulo: "Nuevo módulo: Reportes programados", cuerpo: "Ahora puedes programar el envío automático de tus reportes favoritos.", fecha: daysAgoISO(4), estado: "publicado" },
  { id: "an-2", titulo: "Mejoras en el módulo de Couriers", cuerpo: "Agregamos seguimiento en tiempo real para Shalom y Olva.", fecha: daysAgoISO(20), estado: "publicado" },
  { id: "an-3", titulo: "Próximamente: Agentes IA para ventas", cuerpo: "Un asistente que sugiere respuestas a tus SDRs en vivo.", fecha: daysFromNowISO(7), estado: "borrador" },
];

export const campanasMock: ICampana[] = [
  { id: "camp-1", nombre: "Reactivación trials vencidos", segmento: "Trial vencido, 30-60 días", canal: "WhatsApp", estado: "activa", enviados: 214, aperturaPct: 68, conversionPct: 9.3, mensaje: "Hola {{nombre}}, tu prueba de POWIP venció. ¿Seguimos?", creadoEn: daysAgoISO(6) },
  { id: "camp-2", nombre: "Upsell módulo SUNAT", segmento: "Plan Basic/Pro sin SUNAT", canal: "WhatsApp", estado: "activa", enviados: 96, aperturaPct: 74, conversionPct: 14.6, mensaje: "Activa la facturación electrónica sin salir de POWIP.", creadoEn: daysAgoISO(2) },
  { id: "camp-3", nombre: "Cobranza recordatorio 7 días", segmento: "Facturas vencidas 7d", canal: "Email", estado: "activa", enviados: 41, aperturaPct: 52, conversionPct: 22, mensaje: "Tu factura POWIP está vencida hace 7 días.", creadoEn: daysAgoISO(1) },
  { id: "camp-4", nombre: "Bienvenida nuevos negocios", segmento: "Activados últimos 7 días", canal: "WhatsApp", estado: "borrador", enviados: 0, aperturaPct: 0, conversionPct: 0, mensaje: "¡Bienvenido a POWIP! Aquí tus primeros pasos.", creadoEn: daysAgoISO(0) },
];

export const reportesDisponiblesMock: IReporteDisponible[] = [
  { id: "rep-ventas", nombre: "Ventas", descripcion: "Ventas y GMV consolidado de toda la red.", formatos: ["xlsx", "pdf"] },
  { id: "rep-mrr", nombre: "MRR", descripcion: "Detalle de MRR por empresa y por plan.", formatos: ["xlsx", "pdf"] },
  { id: "rep-leads-cac", nombre: "Leads & CAC", descripcion: "Pipeline de adquisición y costo por canal.", formatos: ["xlsx"] },
  { id: "rep-comisiones", nombre: "Comisiones de partners", descripcion: "Detalle de comisiones y liquidaciones.", formatos: ["xlsx", "pdf"] },
  { id: "rep-facturacion", nombre: "Facturación", descripcion: "Facturas emitidas, cobradas y vencidas.", formatos: ["xlsx", "pdf"] },
  { id: "rep-bbdd-leads", nombre: "BBDD leads", descripcion: "Exportación completa de la base de leads.", formatos: ["xlsx"] },
];

export const reportesProgramadosMock: IReporteProgramado[] = [
  { id: nextId("repp"), reporte: "MRR", frecuencia: "Mensual", destinatario: "joel@powip.pe", proximoEnvio: daysFromNowISO(5), activo: true },
  { id: nextId("repp"), reporte: "Ventas", frecuencia: "Semanal", destinatario: "equipo-ventas@powip.pe", proximoEnvio: daysFromNowISO(2), activo: true },
  { id: nextId("repp"), reporte: "Facturación", frecuencia: "Diario", destinatario: "finanzas@powip.pe", proximoEnvio: daysFromNowISO(1), activo: false },
];

export const planesConfigMock: IPlanConfig[] = [
  { nombre: "Basic", precioMensual: 89, precioAnual: 890, activo: true, limiteUsuarios: 2 },
  { nombre: "Pro", precioMensual: 179, precioAnual: 1790, activo: true, limiteUsuarios: 5 },
  { nombre: "Scale", precioMensual: 349, precioAnual: 3490, activo: true, limiteUsuarios: 12 },
  { nombre: "Enterprise", precioMensual: 799, precioAnual: 7990, activo: true, limiteUsuarios: 999 },
];

export const parametrosGeneralesMock: IParametroGeneral[] = [
  { clave: "trial_dias", label: "Duración del trial", descripcion: "14 días de prueba gratuita por defecto.", activo: true },
  { clave: "2fa_dinero", label: "2FA para roles con acceso a dinero", descripcion: "Exige doble factor a Finanzas y Super Admin.", activo: true },
  { clave: "auto_suspension_dunning", label: "Suspensión automática por dunning", descripcion: "Suspende tras 3 intentos de cobro fallidos.", activo: true },
  { clave: "ip_whitelist", label: "Restricción de IPs para Super Admin", descripcion: "Bloquea accesos fuera de la whitelist configurada.", activo: false },
];
