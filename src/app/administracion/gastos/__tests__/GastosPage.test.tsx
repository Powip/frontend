import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { createGasto, deleteGasto } from "@/api/Admin";
import { useAdminPeriod } from "@/contexts/AdminPeriodContext";
import { formatSoles } from "@/features/panel-control/shared/utils/format";
import { useAdminGastos } from "@/hooks/useAdminQueries";
import type { IGastoOperativo } from "@/interfaces/IAdmin";
import { datosPeriodoDe } from "../../_lib/__tests__/servidor-fixtures";
import { type DatosPeriodo, useResultadosPeriodo } from "../../_lib/useResultados";
import type { PedidoAdmin } from "../../_lib/ventas";
import { type ApiFalsa, comprasVacias } from "../../_lib/__tests__/servidor-falso";
import GastosPage from "../page";

jest.mock("@/contexts/AdminPeriodContext", () => ({ useAdminPeriod: jest.fn() }));
jest.mock("../../_lib/useResultados", () => ({
  useResultadosPeriodo: jest.fn(),
  useAdminContexto: () => ({ companyId: "c1", token: "t", storeIds: [], igvPct: 18, hoy: "2026-11-26" }),
}));
jest.mock("@/hooks/useAdminQueries", () => ({ useAdminGastos: jest.fn() }));
jest.mock("@/api/Admin", () => ({ createGasto: jest.fn(), updateGasto: jest.fn(), deleteGasto: jest.fn() }));
jest.mock("@/api/Productos", () => ({ getProducts: jest.fn().mockResolvedValue([]) }));
jest.mock("@/components/advertising/AdvertisingCompanySpend", () => ({
  AdvertisingCompanySpend: () => {
    throw new Error("Gastos ya no muestra la publicidad conectada");
  },
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { company: { id: "c1" }, accessToken: "t" } }) }));
jest.mock("@/api/Administracion", () => jest.requireActual("../../_lib/__tests__/servidor-falso").crearApiFalsa());
const servidor = jest.requireMock<ApiFalsa>("@/api/Administracion");

const gasto = (id: string, categoria: IGastoOperativo["categoria"], monto: number, mes = 11): IGastoOperativo => ({
  id,
  company_id: "c1",
  categoria,
  descripcion: `${categoria} de prueba`,
  monto: String(monto) as unknown as number,
  mes,
  anio: 2026,
  created_at: "",
  updated_at: "",
});

const GASTOS = [
  gasto("g1", "PLANILLA", 3000),
  gasto("g2", "HERRAMIENTAS", 300),
  gasto("g3", "PUBLICIDAD", 600),
  gasto("g4", "INVERSION", 1000),
  gasto("g5", "OTRO", 310, 10),
];

const PEDIDOS: PedidoAdmin[] = [
  {
    id: "v1",
    status: "ENTREGADO",
    grandTotal: 1000,
    created_at: "2026-11-05T15:00:00Z",
    items: [{ quantity: 5, unitCost: 40, subtotal: 1000 }],
  },
  { id: "v2", status: "ENTREGADO", grandTotal: 500, created_at: "2026-11-06T15:00:00Z", items: [{ quantity: 1 }] },
];

function datosDe(desde: string, hasta: string, pedidos: PedidoAdmin[], gastosCrudos: IGastoOperativo[]): DatosPeriodo {
  return datosPeriodoDe(desde, hasta, pedidos, { gastos: gastosCrudos });
}

function usarPeriodo(desde: string, hasta: string, pedidos = PEDIDOS, gastos = GASTOS) {
  jest.mocked(useAdminPeriod).mockReturnValue({ fromDate: desde, toDate: hasta, setPeriod: jest.fn() });
  jest.mocked(useResultadosPeriodo).mockReturnValue(datosDe(desde, hasta, pedidos, gastos));
}

function renderPagina() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const envolver = (ui: ReactElement) => <QueryClientProvider client={cliente}>{ui}</QueryClientProvider>;
  const resultado = render(envolver(<GastosPage />));
  return { ...resultado, rerenderPagina: () => resultado.rerender(envolver(<GastosPage />)) };
}

let gastosVista = GASTOS;

beforeEach(() => {
  jest.clearAllMocks();
  gastosVista = GASTOS;
  usarPeriodo("2026-11-01", "2026-11-26");
  jest.mocked(useAdminGastos).mockImplementation(
    (_companyId: string, desde: string) =>
      ({
        data: gastosVista.filter((g) => `${g.anio}-${String(g.mes).padStart(2, "0")}` === desde.slice(0, 7)),
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      }) as unknown as ReturnType<typeof useAdminGastos>,
  );
  jest.mocked(createGasto).mockResolvedValue(gasto("nuevo", "OTRO", 150.5));
  jest.mocked(deleteGasto).mockResolvedValue(undefined);
  servidor.__reiniciar();
});

it("muestra lo que le toca al periodo y el costo de lo vendido, con el aviso de ventas sin costo", () => {
  renderPagina();
  const fijos = screen.getByRole("region", { name: "Gastos fijos del periodo" });
  // (3000 + 300) × 26 / 30 = 2860: no el mes entero.
  expect(within(fijos).getByText(formatSoles(2860))).toBeInTheDocument();
  expect(fijos).toHaveTextContent("26 de 30 días de noviembre");
  expect(within(screen.getByRole("region", { name: "Costo de lo vendido" })).getByText(formatSoles(200))).toBeInTheDocument();
  expect(screen.getByText(/1 venta no tiene costo cargado/)).toBeInTheDocument();

  const resumen = screen.getByRole("table", { name: "Gastos de noviembre 2026 por categoría" });
  const planilla = within(resumen).getByRole("row", { name: /Planilla/ });
  expect(within(planilla).getAllByRole("cell").map((c) => c.textContent)).toEqual([formatSoles(3000), formatSoles(2600)]);
  const mercaderia = within(resumen).getByRole("row", { name: /Compra de mercadería cargada/ });
  expect(within(mercaderia).getAllByRole("cell").map((c) => c.textContent)).toEqual([formatSoles(1000), "No entra"]);
  expect(screen.getByText(/Al periodo le tocan 26 de 30 días de noviembre/)).toBeInTheDocument();
});

it("muestra las compras de inventario pagadas en el mes (módulo Compras) junto a la compra cargada a mano", async () => {
  servidor.__ponerCompras({
    ...comprasVacias("2026-11-01", "2026-11-30"),
    pagadas: { compras: 3, monto: 17603, porMes: [{ mes: "2026-11", compras: 3, monto: 17603 }] },
  });
  renderPagina();
  const resumen = screen.getByRole("table", { name: "Gastos de noviembre 2026 por categoría" });
  const inventario = await within(resumen).findByRole("row", { name: /Compras de inventario/ });
  await waitFor(() =>
    expect(within(inventario).getAllByRole("cell").map((c) => c.textContent)).toEqual([formatSoles(17603), "No entra"]),
  );
  expect(servidor.getComprasAdministracion).toHaveBeenCalledWith("2026-11-01", "2026-11-30", expect.anything());
});

it("el formulario arranca en el mes del periodo y sigue al periodo cuando cambia", () => {
  const { rerenderPagina } = renderPagina();
  fireEvent.click(screen.getByRole("button", { name: /Registrar gasto/ }));
  expect((screen.getByLabelText("Mes del gasto") as HTMLSelectElement).value).toBe("11");
  expect((screen.getByLabelText("Año del gasto") as HTMLSelectElement).value).toBe("2026");

  usarPeriodo("2026-10-01", "2026-10-31");
  rerenderPagina();
  expect(screen.getByRole("heading", { name: "Gastos de octubre 2026" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Registrar gasto/ }));
  expect((screen.getByLabelText("Mes del gasto") as HTMLSelectElement).value).toBe("10");
});

it("registra un gasto en el mes y año elegidos", async () => {
  renderPagina();
  fireEvent.click(screen.getByRole("button", { name: /Registrar gasto/ }));
  fireEvent.change(screen.getByLabelText("Monto del mes (S/)"), { target: { value: "150,5" } });
  fireEvent.change(screen.getByLabelText("Mes del gasto"), { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
  await waitFor(() =>
    expect(createGasto).toHaveBeenCalledWith(
      "c1",
      { categoria: "OTRO", descripcion: "", monto: 150.5, mes: 12, anio: 2026 },
      "t",
    ),
  );
});

it("pide confirmación antes de borrar", async () => {
  renderPagina();
  fireEvent.click(screen.getByRole("button", { name: /Eliminar gasto Planilla/ }));
  expect(deleteGasto).not.toHaveBeenCalled();
  expect(await screen.findByText("¿Eliminar este gasto?")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));
  await waitFor(() => expect(deleteGasto).toHaveBeenCalledWith("c1", "g1", "t"));
});

it("no revienta sin datos", () => {
  gastosVista = [];
  usarPeriodo("2026-11-01", "2026-11-26", [], []);
  renderPagina();
  expect(screen.getByText("No hay gastos cargados en noviembre 2026")).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Costo de lo vendido" })).getByText("Sin ventas en el periodo")).toBeInTheDocument();
});
