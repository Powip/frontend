/**
 * Servidor falso de `@/api/Administracion` para tests de páginas (FEAT-34 Fase 3): guarda en memoria capital, cuentas,
 * metas y objetivos, así la página ida y vuelta pasa por React Query como en producción.
 *
 * Uso en un test:
 *   jest.mock("@/api/Administracion", () => jest.requireActual("<ruta>/servidor-falso").crearApiFalsa());
 *   const servidor = jest.requireMock<ApiFalsa>("@/api/Administracion");
 *   beforeEach(() => servidor.__reiniciar());
 *   renderConServidor(<Pagina />);
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import type {
  CapitalNuevo,
  CapitalServidor,
  ComprasAdministracion,
  CuentaNueva,
  CuentaServidor,
  MetasAdministracion,
} from "@/interfaces/IAdministracion";

export function comprasVacias(desde = "2026-11-01", hasta = "2026-11-26"): ComprasAdministracion {
  return {
    desde,
    hasta,
    zonaHoraria: "America/Lima",
    pagadas: { compras: 0, monto: 0, porMes: [] },
    porPagar: { compras: 0, monto: 0, lista: [] },
  };
}

export function crearApiFalsa() {
  let seq = 0;
  let capital: CapitalServidor[] = [];
  let cuentas: CuentaServidor[] = [];
  let metas: Record<number, MetasAdministracion> = {};
  let objetivos: Record<string, number> = {};
  let compras: ComprasAdministracion = comprasVacias();

  const capitalDe = (n: CapitalNuevo, id: string, creadoEn: string): CapitalServidor => ({
    id,
    creadoEn,
    tipo: n.tipo,
    descripcion: n.descripcion ?? "",
    monto: n.monto,
    tienda: n.tienda ?? null,
    teaPct: n.teaPct ?? null,
    plazoCuotas: n.plazoCuotas ?? null,
    cuotaMensual: n.cuotaMensual ?? null,
    fechaInicio: n.fechaInicio ?? null,
    cuotasPagadas: n.cuotasPagadas ?? 0,
  });
  const cuentaDe = (n: CuentaNueva, id: string, creadoEn: string): CuentaServidor => ({
    id,
    creadoEn,
    lado: n.lado,
    concepto: n.concepto,
    descripcion: n.descripcion ?? "",
    monto: n.monto,
    vence: n.vence ?? null,
    saldadaEn: n.saldadaEn ?? null,
  });
  const noEncontrado = () => Object.assign(new Error("404"), { response: { status: 404, data: { message: "No encontrado." } } });

  return {
    __reiniciar() {
      seq = 0;
      capital = [];
      cuentas = [];
      metas = {};
      objetivos = {};
      compras = comprasVacias();
    },
    __capital: () => capital,
    __cuentas: () => cuentas,
    __ponerCompras(valor: ComprasAdministracion) {
      compras = valor;
    },
    __ponerCuentas(valor: CuentaServidor[]) {
      cuentas = valor;
    },
    __ponerCapital(valor: CapitalServidor[]) {
      capital = valor;
    },

    getResultadosAdministracion: jest.fn(),
    getEnTransitoAdministracion: jest.fn(),
    getMetasAdministracion: jest.fn(async (anio: number) =>
      metas[anio] ?? { anio, ventasAnual: null, profitAnual: null, margenObjetivoPct: null },
    ),
    guardarMetasAdministracion: jest.fn(async (m: MetasAdministracion) => {
      metas[m.anio] = m;
      return m;
    }),
    getObjetivosAdministracion: jest.fn(async () => ({ objetivos: { ...objetivos } })),
    guardarObjetivoAdministracion: jest.fn(async (canal: string, ventasDia: number | null) => {
      if (ventasDia === null) delete objetivos[canal];
      else objetivos[canal] = ventasDia;
      return { objetivos: { ...objetivos } };
    }),
    getCapitalAdministracion: jest.fn(async () => ({ entradas: capital.map((c) => ({ ...c })) })),
    crearCapital: jest.fn(async (n: CapitalNuevo) => {
      const fila = capitalDe(n, `cap-${++seq}`, `2026-11-26T12:00:0${seq % 10}`);
      capital = [...capital, fila];
      return fila;
    }),
    actualizarCapital: jest.fn(async (id: string, cambios: Partial<CapitalNuevo>) => {
      const actual = capital.find((c) => c.id === id);
      if (!actual) throw noEncontrado();
      const fila = { ...actual, ...cambios } as CapitalServidor;
      capital = capital.map((c) => (c.id === id ? fila : c));
      return fila;
    }),
    borrarCapital: jest.fn(async (id: string) => {
      capital = capital.filter((c) => c.id !== id);
      return { id };
    }),
    getCuentasAdministracion: jest.fn(async () => ({ cuentas: cuentas.map((c) => ({ ...c })) })),
    crearCuenta: jest.fn(async (n: CuentaNueva) => {
      const fila = cuentaDe(n, `cta-${++seq}`, `2026-11-26T12:00:0${seq % 10}`);
      cuentas = [...cuentas, fila];
      return fila;
    }),
    actualizarCuenta: jest.fn(async (id: string, cambios: Partial<CuentaNueva>) => {
      const actual = cuentas.find((c) => c.id === id);
      if (!actual) throw noEncontrado();
      const fila = { ...actual, ...cambios } as CuentaServidor;
      cuentas = cuentas.map((c) => (c.id === id ? fila : c));
      return fila;
    }),
    borrarCuenta: jest.fn(async (id: string) => {
      cuentas = cuentas.filter((c) => c.id !== id);
      return { id };
    }),
    importarDatosLocales: jest.fn(async () => ({
      importado: { metas: 0, objetivos: 0, capital: 0, cuentas: 0 },
      omitido: [],
    })),
    getComprasAdministracion: jest.fn(async () => compras),
  };
}

export type ApiFalsa = ReturnType<typeof crearApiFalsa>;

/** Render con un QueryClient propio (sin reintentos). */
export function renderConServidor(ui: ReactElement) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  function Envoltorio({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  }
  return render(ui, { wrapper: Envoltorio });
}
