/* -----------------------------------------
   8.24 Cupones & promociones
----------------------------------------- */
export interface ICupon {
  id: string;
  codigo: string;
  beneficio: string;
  aplicaA: string;
  estado: "activo" | "expirado";
  activo: boolean;
  usosCount: number;
  vigenteHasta?: string;
}

/* -----------------------------------------
   8.24 Alertas configurables
----------------------------------------- */
export interface IAlertaConfig {
  id: string;
  nombre: string;
  descripcion: string;
  activo: boolean;
  severidad: "info" | "warning" | "critical";
}

/* -----------------------------------------
   8.24 Anuncios & changelog
----------------------------------------- */
export interface IAnuncio {
  id: string;
  titulo: string;
  cuerpo: string;
  fecha: string;
  estado: "publicado" | "borrador";
}

/* -----------------------------------------
   8.20 Campañas (broadcast)
----------------------------------------- */
export type CanalCampana = "WhatsApp" | "Email";
export type EstadoCampana = "activa" | "pausada" | "borrador" | "finalizada";

export interface ICampana {
  id: string;
  nombre: string;
  segmento: string;
  canal: CanalCampana;
  estado: EstadoCampana;
  enviados: number;
  aperturaPct: number;
  conversionPct: number;
  mensaje: string;
  creadoEn: string;
}

/* -----------------------------------------
   8.21 Reportes
----------------------------------------- */
export interface IReporteDisponible {
  id: string;
  nombre: string;
  descripcion: string;
  formatos: ("xlsx" | "pdf")[];
}

export interface IReporteProgramado {
  id: string;
  reporte: string;
  frecuencia: "Diario" | "Semanal" | "Mensual";
  destinatario: string;
  proximoEnvio: string;
  activo: boolean;
}

/* -----------------------------------------
   8.17 Configuración — planes y parámetros
----------------------------------------- */
export interface IPlanConfig {
  nombre: string;
  precioMensual: number;
  precioAnual: number;
  activo: boolean;
  limiteUsuarios: number;
}

export interface IParametroGeneral {
  clave: string;
  label: string;
  descripcion: string;
  activo: boolean;
}
