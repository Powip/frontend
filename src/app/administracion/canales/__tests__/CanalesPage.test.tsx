import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  createMarketplaceConfig,
  deleteMarketplaceConfig,
  getMarketplaceConfigs,
} from "@/api/Admin";
import { formatSoles } from "@/features/panel-control/shared/utils/format";
import { useAdminOrders } from "@/hooks/useAdminQueries";
import type { IMarketplaceConfig } from "@/interfaces/IAdmin";
import type { PublicidadConectada } from "../../_lib/publicidad";
import { calcularResultados, prorratearGastos } from "../../_lib/resultados";
import { type DatosPeriodo, useResultadosPeriodo } from "../../_lib/useResultados";
import { type PedidoAdmin, resumirVentas } from "../../_lib/ventas";
import CanalesPage from "../page";

jest.mock("@/contexts/AdminPeriodContext", () => ({
  useAdminPeriod: () => ({ fromDate: "2026-11-01", toDate: "2026-11-26" }),
}));
jest.mock("../../_lib/useResultados", () => ({
  useResultadosPeriodo: jest.fn(),
  useAdminContexto: () => ({ companyId: "c1", token: "t", storeIds: [], igvPct: 18, hoy: "2026-11-26" }),
}));
jest.mock("@/hooks/useAdminQueries", () => ({ useAdminOrders: jest.fn() }));
jest.mock("@/api/Admin", () => ({
  getMarketplaceConfigs: jest.fn(),
  createMarketplaceConfig: jest.fn(),
  updateMarketplaceConfig: jest.fn(),
  deleteMarketplaceConfig: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const DESDE = "2026-11-01";
const HASTA = "2026-11-26";

function datosDe(pedidos: PedidoAdmin[]): DatosPeriodo {
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
  };
}

const pedido = (id: string, salesChannel: string, grandTotal: number, items: PedidoAdmin["items"], extra = {}) => ({
  id,
  status: "ENTREGADO",
  salesChannel,
  grandTotal,
  channelFee: 0,
  created_at: "2026-11-10T15:00:00Z",
  items,
  ...extra,
});

const PEDIDOS_PERIODO: PedidoAdmin[] = [
  pedido("p1", "WHATSAPP", 200, [{ quantity: 2 }, { quantity: 1 }]),
  pedido("p2", "FALABELLA", 300, [{ quantity: 4 }], { channelFee: 36 }),
  pedido("p3", "Falabella", 100, [{ quantity: 1 }, { lineKind: "SERVICE", quantity: 1 }], { channelFee: 12 }),
  pedido("p4", "WHATSAPP", 999, [{ quantity: 9 }], { status: "PENDIENTE" }),
  pedido("p5", "MERCADOLIBRE", 100, [{ quantity: 1 }]),
];

/** Últimos 90 días: «Falabella» es la grafía más usada; los de Shopify dicen «WEB». */
const PEDIDOS_90_DIAS: PedidoAdmin[] = [
  ...PEDIDOS_PERIODO,
  pedido("p6", "Falabella", 80, [{ quantity: 1 }]),
  pedido("p7", "WEB", 120, [{ quantity: 1 }]),
];

const config = (id: string, channel: string, commissionPct: string): IMarketplaceConfig => ({
  id,
  companyId: "c1",
  channel,
  commissionPct: commissionPct as unknown as number,
  fixedCharge: "0.00" as unknown as number,
  shippingFee: "0.00" as unknown as number,
  isActive: true,
  createdAt: "",
  updatedAt: "",
});

function renderPagina() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <CanalesPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useResultadosPeriodo).mockReturnValue(datosDe(PEDIDOS_PERIODO));
  jest
    .mocked(useAdminOrders)
    .mockReturnValue({ data: PEDIDOS_90_DIAS, isLoading: false, isError: false } as unknown as ReturnType<
      typeof useAdminOrders
    >);
  jest
    .mocked(getMarketplaceConfigs)
    .mockResolvedValue([config("m1", "MERCADO LIBRE", "10.00"), config("s1", "SHOPIFY", "5.00")]);
  jest.mocked(createMarketplaceConfig).mockResolvedValue(config("n1", "x", "0"));
  jest.mocked(deleteMarketplaceConfig).mockResolvedValue(undefined);
});

it("agrupa las ventas por canal real con unidades reales y la comisión de cada pedido", () => {
  renderPagina();
  expect(within(screen.getByRole("region", { name: "Ventas" })).getByText(formatSoles(700))).toBeInTheDocument();

  const tabla = screen.getByRole("table", { name: /Ventas, unidades, comisión y neto por canal/ });
  const falabella = within(tabla).getByRole("row", { name: /Falabella/ });
  const celdas = within(falabella).getAllByRole("cell").map((c) => c.textContent);
  // Falabella: 2 pedidos (dos grafías juntas), 5 unidades (sin la línea de servicio), S/ 400, comisión S/ 48.
  expect(celdas).toEqual([
    "Falabella",
    "Marketplace",
    "2",
    "5",
    formatSoles(400),
    `${formatSoles(48)}12.0%`,
    formatSoles(352),
    "57.1%",
  ]);
  const whatsapp = within(tabla).getByRole("row", { name: /WhatsApp/ });
  // El pedido PENDIENTE no es venta: 1 pedido, 3 unidades.
  expect(within(whatsapp).getAllByRole("cell").map((c) => c.textContent).slice(2, 5)).toEqual([
    "1",
    "3",
    formatSoles(200),
  ]);
});

it("marca las comisiones que no coinciden con ningún pedido y sugiere la grafía", async () => {
  renderPagina();
  const lista = await screen.findByRole("list", { name: "Comisiones configuradas" });
  const items = within(lista).getAllByRole("listitem");
  expect(items[0]).toHaveTextContent("No coincide con ningún pedido");
  expect(items[0]).toHaveTextContent("Grafía sugerida: «MERCADOLIBRE»");
  expect(items[1]).toHaveTextContent("Grafía sugerida: «WEB»");
});

it("guarda una comisión nueva con la grafía cruda más usada del canal", async () => {
  renderPagina();
  await screen.findByRole("list", { name: "Comisiones configuradas" });
  fireEvent.click(screen.getByRole("button", { name: /Agregar comisión/ }));

  const selector = screen.getByLabelText("Canal") as HTMLSelectElement;
  const mercadoLibre = within(selector).getByRole("option", { name: /Mercado Libre/ }) as HTMLOptionElement;
  expect(mercadoLibre.disabled).toBe(true);
  fireEvent.change(selector, { target: { value: "FALABELLA" } });
  fireEvent.change(screen.getByLabelText("Comisión (%)"), { target: { value: "12,5" } });
  expect(screen.getByText(/Se guarda como «Falabella»/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Guardar comisión" }));

  await waitFor(() =>
    expect(createMarketplaceConfig).toHaveBeenCalledWith(
      "c1",
      { channel: "Falabella", commissionPct: 12.5, fixedCharge: 0, shippingFee: 0, isActive: true },
      "t",
    ),
  );
});

it("corrige la grafía creando la comisión nueva y borrando la vieja, con confirmación", async () => {
  renderPagina();
  await screen.findByRole("list", { name: "Comisiones configuradas" });
  fireEvent.click(screen.getByRole("button", { name: "Guardar como «MERCADOLIBRE»" }));
  expect(createMarketplaceConfig).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole("button", { name: "Guardar" }));

  await waitFor(() => expect(deleteMarketplaceConfig).toHaveBeenCalledWith("c1", "m1", "t"));
  expect(createMarketplaceConfig).toHaveBeenCalledWith(
    "c1",
    { channel: "MERCADOLIBRE", commissionPct: 10, fixedCharge: 0, shippingFee: 0, isActive: true },
    "t",
  );
});

it("muestra el error si no cargan las comisiones, no «sin datos»", async () => {
  jest.mocked(getMarketplaceConfigs).mockRejectedValue(new Error("falló"));
  renderPagina();
  expect(await screen.findByText("No se pudieron cargar los datos")).toBeInTheDocument();
  expect(screen.queryByText(/Todavía no hay comisiones configuradas/)).not.toBeInTheDocument();
});

it("no revienta sin datos", async () => {
  jest.mocked(useResultadosPeriodo).mockReturnValue(datosDe([]));
  jest
    .mocked(useAdminOrders)
    .mockReturnValue({ data: undefined, isLoading: false, isError: false } as unknown as ReturnType<
      typeof useAdminOrders
    >);
  jest.mocked(getMarketplaceConfigs).mockResolvedValue([]);
  renderPagina();
  expect(screen.getByText("No hay ventas entregadas en este periodo")).toBeInTheDocument();
  expect(await screen.findByText(/Todavía no hay comisiones configuradas/)).toBeInTheDocument();
});
