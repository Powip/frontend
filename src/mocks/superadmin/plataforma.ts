import {
  IMiembroPowip,
  IIntegracion,
  IAppMarketplace,
  IAgenteIA,
  ITicket,
  ILogSistema,
  IAuditLog,
  RolInterno,
} from "@/interfaces/superadmin";
import { daysAgoISO, money, nextId } from "./seed";
import { empresasMock } from "./empresas";

export const equipoPowipMock: IMiembroPowip[] = [
  { id: "team-1", nombre: "Joel Coila", email: "joel@powip.pe", rol: "super", estado: "activo", creadoEn: daysAgoISO(400) },
  { id: "team-2", nombre: "Mauricio Tognoli", email: "mau@powip.pe", rol: "super", estado: "activo", creadoEn: daysAgoISO(390) },
  { id: "team-3", nombre: "Marco Bejarano", email: "marco@powip.pe", rol: "super", estado: "activo", creadoEn: daysAgoISO(390) },
  { id: "team-4", nombre: "Heidy Medina", email: "heidy@powip.pe", rol: "ventas", estado: "activo", creadoEn: daysAgoISO(220) },
  { id: "team-5", nombre: "Marcela Guerrero", email: "marcela@powip.pe", rol: "ventas", estado: "activo", creadoEn: daysAgoISO(180) },
  { id: "team-6", nombre: "Fabrizio León", email: "fabrizio@powip.pe", rol: "onboarding", estado: "activo", creadoEn: daysAgoISO(150) },
  { id: "team-7", nombre: "Rosario Campos", email: "rosario@powip.pe", rol: "csm", estado: "activo", creadoEn: daysAgoISO(120) },
  { id: "team-8", nombre: "Diego Salazar", email: "diego@powip.pe", rol: "soporte", estado: "activo", creadoEn: daysAgoISO(95) },
  { id: "team-9", nombre: "Andrea Vásquez", email: "andrea@powip.pe", rol: "finanzas", estado: "activo", creadoEn: daysAgoISO(60) },
  { id: "team-10", nombre: "Renato Chávez", email: "renato@powip.pe", rol: "ventas", estado: "invitado", creadoEn: daysAgoISO(3) },
];

export const ROL_MODULOS: Record<RolInterno, string[]> = {
  super: ["*"],
  ventas: ["dashboard", "adquisicion", "seguimiento", "partners"],
  soporte: ["dashboard", "soporte", "empresas"],
  onboarding: ["dashboard", "empresas", "seguimiento", "integraciones"],
  finanzas: ["dashboard", "finanzas", "facturacion", "suscripciones"],
  csm: ["dashboard", "seguimiento", "empresas", "oportunidades"],
};

export const integracionesMock: IIntegracion[] = [
  { id: "int-1", nombre: "Shopify", categoria: "Ecommerce", estado: "operativo", uptimePct: 99.8, activa: true, ultimoEvento: daysAgoISO(0), icono: "🛍️" },
  { id: "int-2", nombre: "Meta (Catálogo)", categoria: "Marketing", estado: "operativo", uptimePct: 99.4, activa: true, ultimoEvento: daysAgoISO(0), icono: "📣" },
  { id: "int-3", nombre: "Mercado Pago", categoria: "Pagos", estado: "operativo", uptimePct: 99.9, activa: true, ultimoEvento: daysAgoISO(0), icono: "💳" },
  { id: "int-4", nombre: "SUNAT / OSE", categoria: "Facturación", estado: "error", uptimePct: 96.1, activa: true, ultimoEvento: daysAgoISO(0), icono: "🧾" },
  { id: "int-5", nombre: "Shalom Courier", categoria: "Envíos", estado: "operativo", uptimePct: 98.7, activa: true, ultimoEvento: daysAgoISO(1), icono: "📦" },
  { id: "int-6", nombre: "Olva Courier", categoria: "Envíos", estado: "desconectado", uptimePct: 0, activa: false, icono: "📮" },
  { id: "int-7", nombre: "WhatsApp Business API", categoria: "Comunicación", estado: "operativo", uptimePct: 99.6, activa: true, ultimoEvento: daysAgoISO(0), icono: "💬" },
];

export const appsMarketplaceMock: IAppMarketplace[] = [
  { id: "app-1", nombre: "Facturador SUNAT Pro", categoria: "Facturación", estado: "publicada", instalacionesCount: 312, revenueSharePct: 15, descripcion: "Emisión automática de boletas y facturas electrónicas.", icono: "🧾" },
  { id: "app-2", nombre: "Chatbot WhatsApp IA", categoria: "Atención al cliente", estado: "publicada", instalacionesCount: 189, revenueSharePct: 20, descripcion: "Responde consultas frecuentes 24/7 vía WhatsApp.", icono: "🤖" },
  { id: "app-3", nombre: "Sync TikTok Shop", categoria: "Ecommerce", estado: "pendiente", instalacionesCount: 0, revenueSharePct: 15, descripcion: "Sincroniza inventario y pedidos con TikTok Shop.", icono: "🎵" },
  { id: "app-4", nombre: "Reportes Avanzados BI", categoria: "Analítica", estado: "publicada", instalacionesCount: 94, revenueSharePct: 25, descripcion: "Dashboards personalizados conectados a tu data.", icono: "📊" },
  { id: "app-5", nombre: "Cobranza Automática", categoria: "Finanzas", estado: "rechazada", instalacionesCount: 0, revenueSharePct: 15, descripcion: "Recordatorios automáticos de cobranza COD.", icono: "💰" },
  { id: "app-6", nombre: "Impresión de Guías Masiva", categoria: "Logística", estado: "publicada", instalacionesCount: 245, revenueSharePct: 10, descripcion: "Imprime cientos de guías de courier en un clic.", icono: "🖨️" },
];

export const agentesIaMock: IAgenteIA[] = [
  { id: "agt-1", nombre: "Chat IA WhatsApp", descripcion: "Atiende consultas de clientes finales por WhatsApp.", activo: true, usoMes: 18400, costoMes: 312, cierresAsistidos: 89 },
  { id: "agt-2", nombre: "Asistente de Ventas", descripcion: "Sugiere respuestas a SDRs durante la negociación.", activo: true, usoMes: 4200, costoMes: 96, cierresAsistidos: 21 },
  { id: "agt-3", nombre: "Clasificador de Tickets", descripcion: "Prioriza y etiqueta tickets de soporte entrantes.", activo: true, usoMes: 2100, costoMes: 48 },
  { id: "agt-4", nombre: "Detector de Riesgo de Churn", descripcion: "Analiza señales de uso para alertar cuentas en riesgo.", activo: false, usoMes: 0, costoMes: 0 },
];

export const ticketsMock: ITicket[] = empresasMock.slice(0, 14).map((emp, i) => ({
  id: `TCK-${1000 + i}`,
  empresaId: emp.id,
  empresaNombre: emp.nombre,
  asunto: [
    "No puedo emitir boletas SUNAT",
    "Duda sobre liquidación de courier",
    "Error al sincronizar Shopify",
    "Cómo agregar un nuevo vendedor",
    "Cobro duplicado en la suscripción",
    "Pedido no aparece en el tablero",
  ][i % 6],
  prioridad: i % 5 === 0 ? "Alta" : i % 3 === 0 ? "Media" : "Baja",
  estado: i % 4 === 0 ? "Resuelto" : i % 3 === 0 ? "En proceso" : "Abierto",
  asignadoId: i % 2 === 0 ? "team-8" : undefined,
  asignadoNombre: i % 2 === 0 ? "Diego Salazar" : undefined,
  slaVence: daysAgoISO(-(1 + (i % 3))),
  mensajes: [
    { id: nextId("msg"), autor: emp.nombre, esEquipoPowip: false, texto: "Tengo un problema con esto, ¿me ayudan?", creadoEn: daysAgoISO(2) },
    ...(i % 2 === 0
      ? [{ id: nextId("msg"), autor: "Diego Salazar", esEquipoPowip: true, texto: "Ya estamos revisando, te confirmamos en breve.", creadoEn: daysAgoISO(1) }]
      : []),
  ],
  creadoEn: daysAgoISO(2),
}));

const SERVICIOS = ["ms-ventas", "ms-company", "ms-products", "ms-subscription", "ms-courier", "ms-auth", "ms-integrations"];

export const logsSistemaMock: ILogSistema[] = Array.from({ length: 40 }, (_, i) => {
  const nivel = i % 11 === 0 ? "error" : i % 4 === 0 ? "warn" : "info";
  const empresa = empresasMock[i % empresasMock.length];
  return {
    id: nextId("log"),
    ts: daysAgoISO(0).replace(/T.*/, `T${String(23 - (i % 24)).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}:00Z`),
    nivel,
    servicio: SERVICIOS[i % SERVICIOS.length],
    mensaje:
      nivel === "error"
        ? "Timeout al conectar con proveedor de pagos (5000ms)"
        : nivel === "warn"
        ? "Reintentando webhook de courier (intento 2/3)"
        : "Sincronización de inventario completada",
    empresaId: i % 3 === 0 ? empresa.id : undefined,
    empresaNombre: i % 3 === 0 ? empresa.nombre : undefined,
  };
});

export const auditLogMock: IAuditLog[] = Array.from({ length: 25 }, (_, i) => {
  const emp = empresasMock[i % empresasMock.length];
  const acciones = [
    { accion: "plan_cambiado", entidad: "empresa" },
    { accion: "impersonacion", entidad: "empresa" },
    { accion: "comision_reversada", entidad: "comision" },
    { accion: "usuario_creado", entidad: "usuario_empresa" },
    { accion: "regla_programa_cambiada", entidad: "config_programa" },
  ][i % 5];
  return {
    id: nextId("audit"),
    actorId: "team-2",
    actorNombre: "Mauricio Tognoli",
    accion: acciones.accion,
    entidad: acciones.entidad,
    entidadId: emp.id,
    antes: acciones.accion === "plan_cambiado" ? { plan: "Basic" } : undefined,
    despues: acciones.accion === "plan_cambiado" ? { plan: "Pro" } : undefined,
    ip: `190.${(i * 7) % 255}.${(i * 13) % 255}.${(i * 3) % 255}`,
    ts: daysAgoISO(i),
  };
});
