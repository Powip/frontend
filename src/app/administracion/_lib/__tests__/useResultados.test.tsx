import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { getGastos, getShrinkageList } from "@/api/Admin";
import { getEnTransitoAdministracion, getResultadosAdministracion } from "@/api/Administracion";
import type { Agregado, ResultadosAdministracion } from "@/interfaces/IAdministracion";
import { agregadoVacio, resultadosVacios } from "../servidor";
import {
  usePedidosEnTransito,
  useResultadosAnuales,
  useResultadosPeriodo,
} from "../useResultados";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { company: { id: "c1", iva: 18, stores: [{ id: "s1" }] }, accessToken: "t" } }),
}));
jest.mock("@/api/Administracion", () => ({
  getResultadosAdministracion: jest.fn(),
  getEnTransitoAdministracion: jest.fn(),
}));
jest.mock("@/api/Admin", () => ({ getGastos: jest.fn(), getShrinkageList: jest.fn() }));
jest.mock("@/hooks/useAdminQueries", () => ({
  useAdminGastos: () => ({ data: [], isLoading: false, error: null }),
  useAdminShrinkageSummary: () => ({ data: undefined, isLoading: false, error: null }),
}));
jest.mock("../publicidad", () => ({
  ...jest.requireActual("../publicidad"),
  usePublicidadConectada: () => ({
    estado: "sin_cuentas",
    monto: 0,
    porDia: new Map(),
    cobertura: null,
    diasFaltantes: 0,
    provisional: false,
    otrasMonedas: [],
  }),
}));

const agregado = (extra: Partial<Agregado>): Agregado => ({ ...agregadoVacio(), ...extra });

function envoltorio() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Envoltorio({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getGastos).mockResolvedValue([]);
  jest.mocked(getShrinkageList).mockResolvedValue([]);
});

describe("useResultadosPeriodo", () => {
  it("lee las ventas del servidor y usa el flete por pedido como envíos", async () => {
    const servidor: ResultadosAdministracion = {
      ...resultadosVacios("2026-11-01", "2026-11-30"),
      totales: agregado({
        pedidos: 10,
        monto: 2000,
        unidades: 14,
        costo: 800,
        comisiones: 50,
        flete: { monto: 30, pedidos: 2 },
        sinCosto: { pedidos: 1, monto: 200 },
      }),
    };
    jest.mocked(getResultadosAdministracion).mockResolvedValue(servidor);

    const { result } = renderHook(() => useResultadosPeriodo("2026-11-01", "2026-11-30"), {
      wrapper: envoltorio(),
    });
    await waitFor(() => expect(result.current.servidor).toBe(servidor));

    expect(getResultadosAdministracion).toHaveBeenCalledTimes(1);
    expect(jest.mocked(getResultadosAdministracion).mock.calls[0].slice(0, 2)).toEqual(["2026-11-01", "2026-11-30"]);
    expect(result.current.ventas).toMatchObject({ pedidos: 10, monto: 2000, coberturaCosto: 0.9, ticketPromedio: 200 });
    expect(result.current.envios).toBe(30);
    expect(result.current.flete).toEqual({ monto: 30, conFlete: 2, entregas: 10, cobertura: 0.2 });
    // 2000 − 800 − 50 − 30 = 1120.
    expect(result.current.resultados.envios).toBe(30);
    expect(result.current.resultados.utilidadOperativa).toBe(1120);
  });

  it("no pide un rango de más de 400 días y lo explica", () => {
    const { result } = renderHook(() => useResultadosPeriodo("2025-01-01", "2026-11-30"), {
      wrapper: envoltorio(),
    });
    expect(getResultadosAdministracion).not.toHaveBeenCalled();
    expect((result.current.error as Error).message).toBe("El periodo es muy largo: elige uno de hasta 400 días.");
    expect(result.current.ventas.pedidos).toBe(0);
  });
});

describe("useResultadosAnuales", () => {
  it("hace una sola consulta por el año y arma los meses con los días de entrega", async () => {
    jest.mocked(getResultadosAdministracion).mockResolvedValue({
      ...resultadosVacios("2026-01-01", "2026-03-15"),
      totales: agregado({ pedidos: 4, monto: 1000, flete: { monto: 25, pedidos: 2 } }),
      porDia: [
        { dia: "2026-01-10", ...agregado({ pedidos: 1, monto: 300, flete: { monto: 10, pedidos: 1 } }) },
        { dia: "2026-01-20", ...agregado({ pedidos: 1, monto: 200 }) },
        { dia: "2026-03-02", ...agregado({ pedidos: 2, monto: 500, flete: { monto: 15, pedidos: 1 } }) },
      ],
    });

    const { result } = renderHook(() => useResultadosAnuales(2026, { hastaDia: "2026-03-15" }), {
      wrapper: envoltorio(),
    });
    await waitFor(() => expect(result.current.total.ventas).toBe(1000));

    expect(getResultadosAdministracion).toHaveBeenCalledTimes(1);
    expect(jest.mocked(getResultadosAdministracion).mock.calls[0].slice(0, 2)).toEqual(["2026-01-01", "2026-03-15"]);
    const [enero, febrero, marzo, abril] = result.current.meses;
    expect(enero.resultados).toMatchObject({ ventas: 500, pedidos: 2, envios: 10 });
    expect(enero.tieneDatos).toBe(true);
    expect(febrero.resultados.ventas).toBe(0);
    expect(febrero.tieneDatos).toBe(false);
    expect(marzo).toMatchObject({ rango: { desde: "2026-03-01", hasta: "2026-03-15" } });
    expect(marzo.resultados).toMatchObject({ ventas: 500, envios: 15 });
    expect(abril.rango).toBeNull();
    expect(result.current.total.envios).toBe(25);
    expect(result.current.flete).toEqual({ monto: 25, conFlete: 2, entregas: 4, cobertura: 0.5 });
  });

  it("un año que todavía no empieza no consulta nada", () => {
    renderHook(() => useResultadosAnuales(2030, { hastaDia: "2026-11-26" }), { wrapper: envoltorio() });
    expect(getResultadosAdministracion).not.toHaveBeenCalled();
  });
});

describe("usePedidosEnTransito", () => {
  it("devuelve la foto de hoy del servidor y vacíos mientras carga", async () => {
    jest.mocked(getEnTransitoAdministracion).mockResolvedValue({
      hoy: "2026-11-26",
      desde: "2026-08-29",
      pedidos: 3,
      saldo: 500,
      porEstado: {
        ASIGNADO_A_GUIA: { pedidos: 1, saldo: 100 },
        EN_ENVIO: { pedidos: 1, saldo: 200 },
        DESPACHADO: { pedidos: 1, saldo: 200 },
      },
      porCourier: [{ courier: "Shalom", pedidos: 3, saldo: 500, conSaldo: 3 }],
      antiguos: { dias: 30, pedidos: 1, saldo: 200 },
    });
    const { result } = renderHook(() => usePedidosEnTransito(), { wrapper: envoltorio() });
    expect(result.current.pedidos).toBe(0);
    expect(result.current.porEstado.EN_ENVIO).toEqual({ pedidos: 0, saldo: 0 });

    await waitFor(() => expect(result.current.pedidos).toBe(3));
    expect(result.current).toMatchObject({
      desde: "2026-08-29",
      hasta: "2026-11-26",
      saldo: 500,
      antiguos: { dias: 30, pedidos: 1, saldo: 200 },
    });
    expect(result.current.porCourier).toHaveLength(1);
  });
});
