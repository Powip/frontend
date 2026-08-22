import { IAlertaConfig, IAnuncio, ICupon, IParametroGeneral, IPlanConfig } from "@/interfaces/superadmin";
import {
  alertasConfigMock,
  anunciosMock,
  cuponesMock,
  parametrosGeneralesMock,
  planesConfigMock,
} from "@/mocks/superadmin";
import { nextId } from "@/mocks/superadmin/seed";
import { mockDelay } from "./shared";

/* -------------------- Planes y precios -------------------- */

export async function getPlanes(): Promise<IPlanConfig[]> {
  return mockDelay([...planesConfigMock]);
}

export async function togglePlan(nombre: string): Promise<IPlanConfig | null> {
  const plan = planesConfigMock.find((p) => p.nombre === nombre);
  if (!plan) return mockDelay(null);
  plan.activo = !plan.activo;
  return mockDelay(plan, 300);
}

/* -------------------- Parámetros generales -------------------- */

export async function getParametros(): Promise<IParametroGeneral[]> {
  return mockDelay([...parametrosGeneralesMock]);
}

export async function toggleParametro(clave: string): Promise<IParametroGeneral | null> {
  const parametro = parametrosGeneralesMock.find((p) => p.clave === clave);
  if (!parametro) return mockDelay(null);
  parametro.activo = !parametro.activo;
  return mockDelay(parametro, 300);
}

/* -------------------- Cupones -------------------- */

export async function getCupones(): Promise<ICupon[]> {
  return mockDelay([...cuponesMock]);
}

export interface NuevoCuponInput {
  codigo: string;
  beneficio: string;
  aplicaA: string;
}

export async function crearCupon(input: NuevoCuponInput): Promise<ICupon> {
  const nuevo: ICupon = {
    id: nextId("cup"),
    codigo: input.codigo,
    beneficio: input.beneficio,
    aplicaA: input.aplicaA,
    estado: "activo",
    activo: true,
    usosCount: 0,
  };
  cuponesMock.unshift(nuevo);
  return mockDelay(nuevo, 400);
}

export async function toggleCupon(id: string): Promise<ICupon | null> {
  const cupon = cuponesMock.find((c) => c.id === id);
  if (!cupon) return mockDelay(null);
  cupon.activo = !cupon.activo;
  return mockDelay(cupon, 300);
}

/* -------------------- Alertas configurables -------------------- */

export async function getAlertas(): Promise<IAlertaConfig[]> {
  return mockDelay([...alertasConfigMock]);
}

export async function toggleAlerta(id: string): Promise<IAlertaConfig | null> {
  const alerta = alertasConfigMock.find((a) => a.id === id);
  if (!alerta) return mockDelay(null);
  alerta.activo = !alerta.activo;
  return mockDelay(alerta, 300);
}

/* -------------------- Anuncios & changelog -------------------- */

export async function getAnuncios(): Promise<IAnuncio[]> {
  return mockDelay([...anunciosMock]);
}

export interface NuevoAnuncioInput {
  titulo: string;
  cuerpo: string;
}

export async function crearAnuncio(input: NuevoAnuncioInput): Promise<IAnuncio> {
  const nuevo: IAnuncio = {
    id: nextId("an"),
    titulo: input.titulo,
    cuerpo: input.cuerpo,
    fecha: new Date().toISOString(),
    estado: "borrador",
  };
  anunciosMock.unshift(nuevo);
  return mockDelay(nuevo, 400);
}
