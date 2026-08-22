import { CanalVenta } from "./IEmpresa";

/* -----------------------------------------------------------------------
   4.4 lead (adquisición) — alineado al modelo REAL de la tabla `leads`
   (Supabase, ver src/services/leadService.ts + docs/superadmin/adquisicion-endpoints.md).
   Nombres de campo en español (vista del front); el hook
   src/hooks/superadmin/useAdquisicion.ts mapea desde/hacia los nombres
   reales (contact_name, phone_whatsapp, pipeline_stage, source, ...).
----------------------------------------------------------------------- */

/** = `source` real en Supabase. "Otro" cubre además fuentes legacy sin mapear. */
export type CanalAdquisicion = "instagram" | "referido" | "landing" | "whatsapp" | "google_form" | "calendly" | "otro";

/**
 * = `pipeline_stage` real (12 valores confirmados en pipeline/summary route.ts).
 * OJO: no es 1:1 con las 7 etapas que pedía la spec original — el backend
 * separa demo en 3 sub-etapas y agrega pendiente_pago/pago_recibido/cancelado.
 */
export type EstadoLead =
  | "nuevo"
  | "contactado"
  | "respondio"
  | "demo_pendiente"
  | "demo_agendada"
  | "demo_realizada"
  | "pendiente_decision"
  | "pendiente_pago"
  | "pago_recibido"
  | "cerrado"
  | "perdido"
  | "cancelado";

export interface ILead {
  id: string;
  nombre: string;
  negocio?: string;
  whatsapp: string;
  email?: string;
  canalAdquisicion: CanalAdquisicion;
  planInteres?: string;
  pedidosDia?: number;
  courier?: string;
  interesadoEn?: string;
  observaciones?: string;
  ciudad?: string;
  /** Único campo real de responsable — texto libre, no hay tabla de SDRs ni id separado. */
  sdrNombre?: string;
  estado: EstadoLead;
  /** Real, columnas sueltas en `leads` — es lo que alimenta Seguimiento sin tabla nueva. */
  proximaAccion?: string;
  proximaFechaAccion?: string;
  fechaLead: string;
  creadoEn: string;
  actualizadoEn?: string;
  /** true si el registro vive en `landing_leads` y todavía no se migró a `leads`. */
  esLandingSinMigrar?: boolean;

  /* --- Sin respaldo real hoy (ver docs/superadmin/adquisicion-endpoints.md) --- */
  rubro?: string;
  canalesVenta?: CanalVenta[];
  tipoProductos?: string;
  motivoPerdida?: string;
  gestionesCount?: number;
}

/* -----------------------------------------------------------------------
   4.5 gestion — vista del front sobre `lead_activities` (real), que es
   más plana (activity_type + description en texto libre). El hook arma
   `texto` combinando via/resultado al registrar, y lo vuelve a separar
   al leer solo en la medida en que el texto siga el formato "[via] resultado — texto".
----------------------------------------------------------------------- */
export type TipoGestion = "gestion" | "nota" | "estado" | "sistema";
export type ViaGestion = "Llamada" | "WhatsApp" | "Email" | "Demo" | "Visita";
export type ResultadoGestion =
  | "Contestó"
  | "No contestó"
  | "Interesado"
  | "Objeción"
  | "Agendó demo"
  | "No interesado";

export interface IGestion {
  id: string;
  leadId: string;
  tipo: TipoGestion;
  /** Solo se puede reconstruir si el texto sigue el formato "[via] resultado — texto"; si no, queda undefined. */
  via?: ViaGestion;
  resultado?: ResultadoGestion;
  texto: string;
  autorNombre: string;
  creadoEn: string;
}

/* -----------------------------------------------------------------------
   4.6 seguimiento — se deriva de `leads.next_action`/`next_action_date`
   (reales), no hace falta tabla propia para esto.
----------------------------------------------------------------------- */
export interface ISeguimiento {
  id: string;
  entidadTipo: "lead" | "empresa";
  entidadId: string;
  nombre: string;
  accion: string;
  via: ViaGestion;
  responsableId: string;
  responsableNombre: string;
  vence: string;
  estado: "pendiente" | "hecho";
}

/* -----------------------------------------------------------------------
   4.6.b demo — sin tabla real propia. Hoy es pipeline_stage
   (demo_pendiente/demo_agendada/demo_realizada) + next_action_date como
   fecha aproximada. Ver docs/superadmin/adquisicion-endpoints.md.
----------------------------------------------------------------------- */
export type EstadoDemo = "agendada" | "realizada" | "no_asistio" | "ganada" | "perdida";

export interface IDemo {
  id: string;
  leadId: string;
  negocio: string;
  /** Aproximado: viene de next_action_date (o demo_scheduled_at si la agendó Calendly) — no hay columna dedicada. */
  fecha?: string;
  hora?: string;
  sdrNombre?: string;
  tipo?: "venta" | "onboarding";
  estado: EstadoDemo;
  resultado?: string;
  notas?: string;
  creadoEn: string;
}

/* -----------------------------------------------------------------------
   8.2.1 Origen & CAC — leads/cierres son reales (agrupables desde
   pipeline/summary + un source_breakdown a agregar); inversión y CPL/CPD/CAC
   no existen todavía (ver doc).
----------------------------------------------------------------------- */
export interface IOrigenCac {
  canal: string;
  leads: number;
  cierres: number;
  conversionPct: number;
  inversion?: number;
  cpl?: number;
  cpd?: number;
  cac?: number;
}

/* -----------------------------------------------------------------------
   Rendimiento por SDR — real vía pipeline/summary.salesperson_breakdown,
   salvo demos/cpl (sin fuente).
----------------------------------------------------------------------- */
export interface IRendimientoSdr {
  sdrNombre: string;
  leads: number;
  cierres: number;
  efectividadPct: number;
  demos?: number;
  cpl?: number;
}
