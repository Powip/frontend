import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  formatPercent,
  formatSoles,
  formatSolesDecimales,
} from "@/features/panel-control/shared/utils/format";
import type { PublicidadConectada } from "../../_lib/publicidad";
import { calcularResultados, prorratearGastos } from "../../_lib/resultados";
import { type DatosPeriodo, useResultadosPeriodo } from "../../_lib/useResultados";
import { type PedidoAdmin, resumirVentas } from "../../_lib/ventas";
import MargenProductoPage from "../page";

jest.mock("@/contexts/AdminPeriodContext", () => ({
  useAdminPeriod: () => ({ fromDate: "2026-11-01", toDate: "2026-11-26" }),
}));
jest.mock("../../_lib/useResultados", () => ({ useResultadosPeriodo: jest.fn() }));

const DESDE = "2026-11-01";
const HASTA = "2026-11-26";

function datosDe(pedidos: PedidoAdmin[], extra: Partial<DatosPeriodo> = {}): DatosPeriodo {
  const ventas = resumirVentas(pedidos);
  const gastos = prorratearGastos([], DESDE, HASTA);
  const publicidad: PublicidadConectada = {
    estado: "sin_cuentas",
    monto: 0,
    porDia: new Map(),
    cobertura: null,
    diasFaltantes: 0,
    provisional: false,
    otrasMonedas: [],
  };
  return {
    desde: DESDE,
    hasta: HASTA,
    cargando: false,
    error: null,
    pedidos,
    ventas,
    gastos,
    gastosCrudos: [],
    merma: { unidades: 0, costo: 0 },
    envios: 0,
    publicidad,
    resultados: calcularResultados({ ventas, gastos, merma: 0, envios: 0, publicidadConectada: 0, igvPct: 18 }),
    ...extra,
  };
}

type LineaPrueba = NonNullable<PedidoAdmin["items"]>[number] & { attributes?: Record<string, string> };

const PEDIDOS: PedidoAdmin[] = [
  {
    id: "v1",
    status: "ENTREGADO",
    grandTotal: 170,
    created_at: "2026-11-05T15:00:00Z",
    items: [
      { sku: "A1", productName: "Polo", attributes: { talla: "M" }, quantity: 2, subtotal: "100.00", unitCost: "20.00" },
      { sku: "B1", productName: "Short", quantity: 1, subtotal: 50, unitCost: null },
      { lineKind: "SERVICE", sku: "ENV", productName: "Envío", quantity: 1, subtotal: 10, unitCost: null },
    ] as LineaPrueba[],
  },
  {
    id: "v2",
    status: "ENTREGADO",
    grandTotal: 60,
    created_at: "2026-11-06T15:00:00Z",
    items: [{ sku: "A1", productName: "Polo", quantity: 1, subtotal: 60, unitCost: 25 }],
  },
  {
    id: "v3",
    status: "PENDIENTE",
    grandTotal: 500,
    created_at: "2026-11-07T15:00:00Z",
    items: [{ sku: "A1", productName: "Polo", quantity: 5, subtotal: 500, unitCost: 20 }],
  },
];

const fetchOriginal = global.fetch;

beforeEach(() => {
  jest.mocked(useResultadosPeriodo).mockReturnValue(datosDe(PEDIDOS));
  global.fetch = jest.fn();
});

afterAll(() => {
  global.fetch = fetchOriginal;
});

it("calcula precio cobrado (sin ×1,18), costo de la línea y margen por SKU", () => {
  render(<MargenProductoPage />);
  const tabla = screen.getByRole("table", { name: /margen por SKU/ });

  const polo = within(tabla).getByRole("row", { name: /Polo/ });
  // 3 unidades, S/ 160, precio 53,33 (no 62,93), costo (2×20 + 25) ÷ 3, margen 160 − 65 = 95.
  expect(within(polo).getAllByRole("cell").map((c) => c.textContent)).toEqual([
    "PoloM",
    "A1",
    "3",
    formatSoles(160),
    formatSolesDecimales(160 / 3),
    formatSolesDecimales(65 / 3),
    formatSoles(95),
    formatPercent(95 / 160, 1),
  ]);

  const short = within(tabla).getByRole("row", { name: /Short/ });
  const celdasShort = within(short).getAllByRole("cell").map((c) => c.textContent);
  expect(celdasShort[5]).toBe("Sin costo");
  expect(celdasShort[6]).toBe("—");
  expect(celdasShort[7]).toBe("—");

  // La línea de servicio y el pedido no entregado no entran.
  expect(within(tabla).queryByText("ENV")).not.toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Unidades vendidas" })).getByText("4")).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Margen bruto" })).getByText(formatSoles(95))).toBeInTheDocument();

  // Sin pedidos al catálogo por variante.
  expect(global.fetch).not.toHaveBeenCalled();
});

it("avisa las ventas sin costo con su parte de lo vendido", () => {
  render(<MargenProductoPage />);
  expect(
    screen.getByText(`1 venta no tiene costo cargado (${formatPercent(50 / 210)} de lo vendido, ${formatSoles(50)})`),
  ).toBeInTheDocument();
});

it("marca el costo parcial cuando solo algunas unidades lo tienen", () => {
  jest.mocked(useResultadosPeriodo).mockReturnValue(
    datosDe([
      ...PEDIDOS,
      {
        id: "v4",
        status: "ENTREGADO",
        grandTotal: 40,
        created_at: "2026-11-08T15:00:00Z",
        items: [{ sku: "A1", productName: "Polo", quantity: 1, subtotal: 40, unitCost: 0 }],
      },
    ]),
  );
  render(<MargenProductoPage />);
  const polo = within(screen.getByRole("table", { name: /margen por SKU/ })).getByRole("row", { name: /Polo/ });
  expect(within(polo).getAllByRole("cell")[5]).toHaveTextContent("3/4 uds");
});

it("filtra por producto o SKU", () => {
  render(<MargenProductoPage />);
  fireEvent.change(screen.getByLabelText("Buscar producto o SKU"), { target: { value: "b1" } });
  const tabla = screen.getByRole("table", { name: /margen por SKU/ });
  expect(within(tabla).queryByText("Polo")).not.toBeInTheDocument();
  expect(within(tabla).getByText("Short")).toBeInTheDocument();
});

it("no revienta sin datos", () => {
  jest.mocked(useResultadosPeriodo).mockReturnValue(datosDe([]));
  render(<MargenProductoPage />);
  expect(screen.getByText("No hay productos vendidos en este periodo")).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Margen bruto" })).getByText("—")).toBeInTheDocument();
});
