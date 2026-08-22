/* -----------------------------------------
   3. Roles y permisos (RBAC interno)
----------------------------------------- */
export type RolInterno =
  | "super"
  | "ventas"
  | "soporte"
  | "onboarding"
  | "finanzas"
  | "csm";

export const ROL_LABEL: Record<RolInterno, string> = {
  super: "Super Admin",
  ventas: "Ventas / Comercial",
  soporte: "Soporte",
  onboarding: "Onboarding / Activación",
  finanzas: "Finanzas",
  csm: "CSM / Postventa",
};

export type AccionModulo = "ver" | "crear" | "editar" | "eliminar" | "exportar";

/* -----------------------------------------
   4.3 miembro_powip (equipo interno)
----------------------------------------- */
export interface IMiembroPowip {
  id: string;
  nombre: string;
  email: string;
  rol: RolInterno;
  estado: "activo" | "invitado";
  creadoEn: string;
}

/* -----------------------------------------
   4.10 integracion
----------------------------------------- */
export type EstadoIntegracion = "operativo" | "error" | "desconectado";

export interface IIntegracion {
  id: string;
  nombre: string;
  categoria: string;
  estado: EstadoIntegracion;
  uptimePct: number;
  activa: boolean;
  ultimoEvento?: string;
  icono?: string;
}

/* -----------------------------------------
   4.11 app_marketplace
----------------------------------------- */
export type EstadoApp = "publicada" | "pendiente" | "rechazada";

export interface IAppMarketplace {
  id: string;
  nombre: string;
  categoria: string;
  estado: EstadoApp;
  instalacionesCount: number;
  revenueSharePct: number;
  descripcion: string;
  icono?: string;
}

/* -----------------------------------------
   4.12 agente_ia
----------------------------------------- */
export interface IAgenteIA {
  id: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  usoMes: number;
  costoMes: number;
  cierresAsistidos?: number;
}

/* -----------------------------------------
   4.13 ticket
----------------------------------------- */
export type PrioridadTicket = "Alta" | "Media" | "Baja";
export type EstadoTicket = "Abierto" | "En proceso" | "Resuelto";

export interface IMensajeTicket {
  id: string;
  autor: string;
  esEquipoPowip: boolean;
  texto: string;
  creadoEn: string;
}

export interface ITicket {
  id: string;
  empresaId: string;
  empresaNombre: string;
  asunto: string;
  prioridad: PrioridadTicket;
  estado: EstadoTicket;
  asignadoId?: string;
  asignadoNombre?: string;
  slaVence: string;
  mensajes: IMensajeTicket[];
  creadoEn: string;
}

/* -----------------------------------------
   4.14 log_sistema
----------------------------------------- */
export type NivelLog = "info" | "warn" | "error";

export interface ILogSistema {
  id: string;
  ts: string;
  nivel: NivelLog;
  servicio: string;
  mensaje: string;
  empresaId?: string;
  empresaNombre?: string;
}

/* -----------------------------------------
   4.15 audit_log
----------------------------------------- */
export interface IAuditLog {
  id: string;
  actorId: string;
  actorNombre: string;
  accion: string;
  entidad: string;
  entidadId: string;
  antes?: Record<string, unknown>;
  despues?: Record<string, unknown>;
  ip: string;
  ts: string;
}
