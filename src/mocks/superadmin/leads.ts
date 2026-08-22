import { ILead, IGestion, IDemo, ISeguimiento, IOrigenCac, CanalAdquisicion, EstadoLead } from "@/interfaces/superadmin";
import { PERSONAS, SDRS, COURIERS, daysAgoISO, daysFromNowISO, money, nextId } from "./seed";

/* -----------------------------------------------------------------------
   La lista de leads en sí YA ES REAL (ver src/hooks/superadmin/useAdquisicion.ts,
   que pega contra /api/superadmin/leads). Este archivo solo sirve hoy para:
   - alimentar la búsqueda global (GlobalSearchDialog) y el mock de Seguimiento
     con datos de ejemplo con la forma correcta.
   - dar de fallback a lo que sigue 100% simulado: Origen & CAC (inversión no
     existe en ningún lado todavía — ver docs/superadmin/adquisicion-endpoints.md).
----------------------------------------------------------------------- */

const CANALES_ADQ: CanalAdquisicion[] = ["landing", "whatsapp", "instagram", "referido", "google_form", "otro"];
const ESTADOS_LEAD: EstadoLead[] = [
  "nuevo",
  "contactado",
  "respondio",
  "demo_pendiente",
  "demo_agendada",
  "demo_realizada",
  "pendiente_decision",
  "pendiente_pago",
  "cerrado",
  "perdido",
];

const NEGOCIOS_LEAD = [
  "Belleza Andina Store", "Ropa Kids Chorrillos", "Tienda Mascotas Sur", "Deco Hogar VES",
  "Zapatería Comas", "Suplementos Trujillo", "Bisutería San Juan", "Tech Store Piura",
  "Moda Femenina Ica", "Accesorios Cusco Norte", "Bazar Multiusos SJL", "Ropa Deportiva Callao",
];

export const leadsMock: ILead[] = NEGOCIOS_LEAD.map((negocio, i) => {
  const estado = ESTADOS_LEAD[i % ESTADOS_LEAD.length];
  const sdr = SDRS[i % SDRS.length];
  return {
    id: `lead-${String(i + 1).padStart(3, "0")}`,
    nombre: PERSONAS[i % PERSONAS.length],
    negocio,
    whatsapp: `+51 9${(10 + i).toString().padStart(2, "0")} ${(500 + i * 13).toString().padStart(3, "0")} ${(200 + i).toString().padStart(3, "0")}`,
    email: i % 3 === 0 ? undefined : `${negocio.toLowerCase().split(" ")[0]}@gmail.com`,
    canalAdquisicion: CANALES_ADQ[i % CANALES_ADQ.length],
    planInteres: ["Basic", "Pro", "Scale"][i % 3],
    pedidosDia: Math.round(money(i, 3, 40)),
    courier: COURIERS[i % COURIERS.length],
    interesadoEn: ["Módulo SUNAT", "Envíos automatizados", "Call center", "Todo el ERP"][i % 4],
    observaciones: i % 4 === 0 ? "Viene referido por un cliente actual, evaluar código de partner." : undefined,
    sdrNombre: sdr.nombre,
    estado,
    proximaAccion: estado !== "cerrado" && estado !== "perdido" ? "Llamar para dar seguimiento" : undefined,
    proximaFechaAccion: estado !== "cerrado" && estado !== "perdido" ? daysFromNowISO(1 + (i % 5)) : undefined,
    motivoPerdida: estado === "perdido" ? ["Se quedó con Excel", "Precio", "No respondió más"][i % 3] : undefined,
    fechaLead: daysAgoISO(i + 1),
    creadoEn: daysAgoISO(i + 1),
    gestionesCount: estado === "nuevo" ? 0 : 1 + (i % 4),
  };
});

export const gestionesMock: IGestion[] = leadsMock.flatMap((lead) =>
  Array.from({ length: lead.gestionesCount ?? 0 }, (_, j) => ({
    id: nextId("gestion"),
    leadId: lead.id,
    tipo: j === (lead.gestionesCount ?? 0) - 1 ? ("estado" as const) : ("gestion" as const),
    via: (["Llamada", "WhatsApp", "Email", "Demo"] as const)[j % 4],
    resultado: (["Contestó", "Interesado", "No contestó", "Agendó demo"] as const)[j % 4],
    texto: j === 0 ? "Primer contacto, se explicó el producto y precios." : "Seguimiento — cliente pidió tiempo para evaluar con su socio.",
    autorNombre: lead.sdrNombre || "Equipo Ventas",
    creadoEn: daysAgoISO((lead.gestionesCount ?? 1) - j),
  }))
);

export const demosMock: IDemo[] = leadsMock
  .filter((l) => ["demo_pendiente", "demo_agendada", "demo_realizada", "pendiente_decision", "cerrado", "perdido"].includes(l.estado))
  .map((lead, i) => ({
    id: nextId("demo"),
    leadId: lead.id,
    negocio: lead.negocio || lead.nombre,
    fecha: i % 2 === 0 ? daysAgoISO(i + 1) : daysFromNowISO(i % 3),
    hora: ["10:00", "11:30", "15:00", "16:30"][i % 4],
    sdrNombre: lead.sdrNombre,
    tipo: i % 4 === 0 ? "onboarding" : "venta",
    estado:
      lead.estado === "cerrado"
        ? "ganada"
        : lead.estado === "perdido"
        ? "perdida"
        : lead.estado === "demo_realizada" || lead.estado === "pendiente_decision"
        ? "realizada"
        : i % 5 === 0
        ? "no_asistio"
        : "agendada",
    resultado: lead.estado === "cerrado" ? "Cerró plan Pro, activación inmediata" : lead.estado === "perdido" ? "No convencido por precio" : undefined,
    notas: i % 3 === 0 ? "Pidió ver el módulo de couriers en detalle." : undefined,
    creadoEn: daysAgoISO(i + 3),
  }));

export const seguimientosMock: ISeguimiento[] = [
  ...leadsMock
    .filter((l) => l.estado !== "cerrado" && l.estado !== "perdido" && (l.gestionesCount ?? 0) > 0)
    .slice(0, 8)
    .map((lead, i) => ({
      id: nextId("seg"),
      entidadTipo: "lead" as const,
      entidadId: lead.id,
      nombre: lead.negocio || lead.nombre,
      accion: lead.proximaAccion || "Seguimiento",
      via: (["Llamada", "WhatsApp", "Email"] as const)[i % 3],
      responsableId: `sdr-${(i % 4) + 1}`,
      responsableNombre: lead.sdrNombre || "Heidy Medina",
      vence: lead.proximaFechaAccion || daysFromNowISO(1 + (i % 5)),
      estado: "pendiente" as const,
    })),
  {
    id: nextId("seg"),
    entidadTipo: "empresa",
    entidadId: "emp-004",
    nombre: "TecnoHogar Express",
    accion: "Llamar por caída de ventas 40%",
    via: "Llamada",
    responsableId: "sdr-2",
    responsableNombre: "Marcela Guerrero",
    vence: daysAgoISO(2),
    estado: "pendiente",
  },
  {
    id: nextId("seg"),
    entidadTipo: "empresa",
    entidadId: "emp-011",
    nombre: "Casa & Deco Perú",
    accion: "Confirmar activación del módulo SUNAT",
    via: "WhatsApp",
    responsableId: "sdr-3",
    responsableNombre: "Fabrizio León",
    vence: daysFromNowISO(0),
    estado: "pendiente",
  },
];

/** 100% simulado — no hay tracking de inversión por canal en ningún lado (ver doc). */
export const origenCacMock: IOrigenCac[] = [
  { canal: "ADS WhatsApp", leads: 142, cierres: 18, conversionPct: 12.7, inversion: 5200, cpl: 36.6, cpd: 92, cac: 288.9 },
  { canal: "Referido / Partner", leads: 64, cierres: 22, conversionPct: 34.4, inversion: 1360, cpl: 21.3, cpd: 48, cac: 61.8 },
  { canal: "TikTok Live", leads: 98, cierres: 9, conversionPct: 9.2, inversion: 3100, cpl: 31.6, cpd: 110, cac: 344.4 },
  { canal: "Landing", leads: 76, cierres: 11, conversionPct: 14.5, inversion: 1800, cpl: 23.7, cpd: 66, cac: 163.6 },
  { canal: "Google Form", leads: 41, cierres: 5, conversionPct: 12.2, inversion: 640, cpl: 15.6, cpd: 58, cac: 128.0 },
  { canal: "Instagram", leads: 53, cierres: 6, conversionPct: 11.3, inversion: 1450, cpl: 27.4, cpd: 84, cac: 241.7 },
  { canal: "Directo", leads: 22, cierres: 4, conversionPct: 18.2, inversion: 0, cpl: 0, cpd: 0, cac: 0 },
];
