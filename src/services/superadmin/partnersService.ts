import {
  IPartner,
  IReferido,
  IComision,
  ILiquidacion,
  IConfigPrograma,
  EstadoPartner,
  EstadoReferido,
} from "@/interfaces/superadmin";
import {
  partnersMock,
  referidosMock,
  comisionesMock,
  liquidacionesMock,
  configProgramaMock,
} from "@/mocks/superadmin";
import { mockDelay, matchesQuery, paginate, PageParams, PagedResponse } from "./shared";

/* -----------------------------------------------------------------------
   Precio de lista por plan — mismo mapa usado en empresasService para el
   alta de empresas, reutilizado acá para poder calcular el desglose de
   comisión (8.6) sin depender de un dato de facturación real.
------------------------------------------------------------------------ */
const PRECIO_LISTA_PLAN: Record<string, number> = {
  Trial: 0,
  Basic: 89,
  Pro: 179,
  Scale: 349,
  Enterprise: 799,
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* -----------------------------------------------------------------------
   Listado & ficha de partners
------------------------------------------------------------------------ */
export interface PartnersFilters extends PageParams {
  q?: string;
  estado?: EstadoPartner | "todos";
  nivel?: IPartner["nivel"] | "todos";
}

export async function getPartners(filters: PartnersFilters = {}): Promise<PagedResponse<IPartner>> {
  let items = [...partnersMock];
  if (filters.estado && filters.estado !== "todos") items = items.filter((p) => p.estado === filters.estado);
  if (filters.nivel && filters.nivel !== "todos") items = items.filter((p) => p.nivel === filters.nivel);
  if (filters.q) items = items.filter((p) => matchesQuery([p.nombre, p.handle, p.codigo, p.slugLink], filters.q!));
  return mockDelay(paginate(items, filters));
}

export async function getPartnerById(id: string): Promise<IPartner | null> {
  return mockDelay(partnersMock.find((p) => p.id === id) ?? null);
}

export async function getReferidosDelPartner(partnerId: string): Promise<IReferido[]> {
  return mockDelay(
    referidosMock
      .filter((r) => r.partnerId === partnerId)
      .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime())
  );
}

export async function getComisionesDelPartner(partnerId: string): Promise<IComision[]> {
  return mockDelay(comisionesMock.filter((c) => c.partnerId === partnerId));
}

/* -----------------------------------------------------------------------
   Cola de referidos
------------------------------------------------------------------------ */
export async function getColaReferidos(estado?: EstadoReferido | "todos"): Promise<IReferido[]> {
  let items = [...referidosMock];
  if (estado && estado !== "todos") items = items.filter((r) => r.estado === estado);
  return mockDelay(items.sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime()));
}

export async function aprobarReferido(id: string): Promise<IReferido | null> {
  const referido = referidosMock.find((r) => r.id === id);
  if (!referido) return mockDelay(null);
  referido.estado = "aprobado";
  return mockDelay(referido, 300);
}

export async function rechazarReferido(id: string): Promise<IReferido | null> {
  const referido = referidosMock.find((r) => r.id === id);
  if (!referido) return mockDelay(null);
  referido.estado = "rechazado";
  return mockDelay(referido, 300);
}

/* -----------------------------------------------------------------------
   Liquidaciones
------------------------------------------------------------------------ */
export async function getLiquidaciones(): Promise<ILiquidacion[]> {
  return mockDelay([...liquidacionesMock]);
}

export async function confirmarPagoLiquidacion(id: string): Promise<ILiquidacion | null> {
  const liquidacion = liquidacionesMock.find((l) => l.id === id);
  if (!liquidacion) return mockDelay(null);
  liquidacion.estado = "pagada";
  return mockDelay(liquidacion, 350);
}

/* -----------------------------------------------------------------------
   Reglas & Comisiones (Sección 8.6.5)
------------------------------------------------------------------------ */
export async function getConfigPrograma(): Promise<IConfigPrograma> {
  return mockDelay({ ...configProgramaMock, opciones: configProgramaMock.opciones.map((o) => ({ ...o })) });
}

export async function actualizarConfigPrograma(input: Partial<IConfigPrograma>): Promise<IConfigPrograma> {
  if (input.opciones) {
    input.opciones.forEach((nueva) => {
      const actual = configProgramaMock.opciones.find((o) => o.id === nueva.id);
      if (actual) {
        actual.firstPct = nueva.firstPct;
        actual.recPct = nueva.recPct;
      }
    });
  }
  const { opciones: _opciones, ...resto } = input;
  Object.assign(configProgramaMock, resto);
  return mockDelay({ ...configProgramaMock, opciones: configProgramaMock.opciones.map((o) => ({ ...o })) }, 300);
}

/* -----------------------------------------------------------------------
   Acciones sobre el partner
------------------------------------------------------------------------ */
export async function aprobarPartner(id: string): Promise<IPartner | null> {
  const partner = partnersMock.find((p) => p.id === id);
  if (!partner) return mockDelay(null);
  partner.estado = "activo";
  return mockDelay(partner, 300);
}

export async function suspenderPartner(id: string): Promise<IPartner | null> {
  const partner = partnersMock.find((p) => p.id === id);
  if (!partner) return mockDelay(null);
  partner.estado = partner.estado === "suspendido" ? "activo" : "suspendido";
  return mockDelay(partner, 300);
}

/* -----------------------------------------------------------------------
   Fórmulas de comisión — función pura (el front recibe el número y el
   desglose, spec 8.6): comision_primer_mes = precio_neto * (first% / 100);
   comision_recurrente = precio_lista * ((rec% + residual_nivel) / 100).
   El descuento del partner reduce SU comisión: se aplica sobre precio_neto,
   que es el que alimenta el primer mes — nunca toca el ingreso de POWIP
   (precio_lista, base de la comisión recurrente, queda intacto).
------------------------------------------------------------------------ */
export interface DetalleComision {
  precioLista: number;
  precioNeto: number;
  firstPct: number;
  recPct: number;
  residualNivel: number;
  descuentoPartnerPct: number;
  comisionPrimerMes: number;
  comisionRecurrente: number;
}

export function calcularDetalleComision(partner: IPartner, referido: IReferido): DetalleComision {
  const opcion = configProgramaMock.opciones.find((o) => o.id === partner.opcionComision);
  const firstPct = partner.overridePct ?? opcion?.firstPct ?? 0;
  const recPct = opcion?.recPct ?? 0;
  const residualNivel = partner.acuerdo.residualNivel;
  const descuentoPartnerPct = referido.descuentoPct;

  const precioLista = PRECIO_LISTA_PLAN[referido.plan] ?? 0;
  const precioNeto = round2(precioLista * (1 - descuentoPartnerPct / 100));

  return {
    precioLista,
    precioNeto,
    firstPct,
    recPct,
    residualNivel,
    descuentoPartnerPct,
    comisionPrimerMes: round2(precioNeto * (firstPct / 100)),
    comisionRecurrente: round2(precioLista * ((recPct + residualNivel) / 100)),
  };
}

/* -----------------------------------------------------------------------
   KPIs — Dashboard del canal (8.6.1): MRR referido, comisiones del mes,
   ROI del canal, CAC, conversión, top partners.
------------------------------------------------------------------------ */
export async function getKpisPartners() {
  const partnersActivos = partnersMock.filter((p) => p.estado === "activo");
  const mrrReferido = round2(partnersActivos.reduce((acc, p) => acc + p.mrrActivo, 0));

  const periodoActual = "2026-07";
  const comisionesDelMes = comisionesMock.filter((c) => c.periodo === periodoActual);
  const comisionesPositivas = comisionesDelMes.filter((c) => c.tipo !== "reverso").reduce((a, c) => a + c.monto, 0);
  const reversos = comisionesDelMes.filter((c) => c.tipo === "reverso").reduce((a, c) => a + c.monto, 0);
  const comisionesMes = round2(comisionesPositivas - reversos);

  const referidosActivos = referidosMock.filter((r) => r.estado === "activo").length;
  const referidosTotal = referidosMock.length;
  const conversionPct = referidosTotal ? round2((referidosActivos / referidosTotal) * 100) : 0;

  // CAC del canal: comisión pagada / referidos convertidos a activos, vs ~S/140 de ads (spec).
  const cacPartners = referidosActivos ? round2(comisionesMes / referidosActivos) : 0;
  const cacAds = 140;
  const roiPct = comisionesMes > 0 ? round2(((mrrReferido - comisionesMes) / comisionesMes) * 100) : 0;

  const topPartners = [...partnersMock].sort((a, b) => b.mrrActivo - a.mrrActivo).slice(0, 5);

  return mockDelay({
    partnersActivos: partnersActivos.length,
    partnersTotal: partnersMock.length,
    mrrReferido,
    comisionesMes,
    referidosActivos,
    referidosTotal,
    conversionPct,
    cacPartners,
    cacAds,
    roiPct,
    topPartners,
  });
}
