import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createShrinkage } from "@/api/Admin";
import { formatSolesDecimales } from "@/features/panel-control/shared/utils/format";
import {
  useAdminShrinkageList,
  useAdminShrinkageSummary,
  useInvalidateAdminQueries,
} from "@/hooks/useAdminQueries";
import type { IInventoryShrinkage } from "@/interfaces/IAdmin";
import MermaPage from "../page";

jest.mock("@/contexts/AdminPeriodContext", () => ({
  useAdminPeriod: () => ({ fromDate: "2026-11-01", toDate: "2026-11-26" }),
}));
jest.mock("../../_lib/useResultados", () => ({
  useAdminContexto: () => ({ companyId: "c1", token: "t", storeIds: [], igvPct: 18, hoy: "2026-11-26" }),
}));
jest.mock("@/hooks/useAdminQueries", () => ({
  useAdminShrinkageList: jest.fn(),
  useAdminShrinkageSummary: jest.fn(),
  useInvalidateAdminQueries: jest.fn(),
}));
jest.mock("@/api/Admin", () => ({ createShrinkage: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const merma = (id: string, extra: Partial<IInventoryShrinkage>): IInventoryShrinkage => ({
  id,
  companyId: "c1",
  inventoryItemId: null,
  shrinkageType: "otro",
  quantity: 1,
  unitCost: 0,
  recoveredAmount: 0,
  notes: null,
  referenceId: null,
  createdBy: null,
  createdAt: "2026-11-10T15:00:00Z",
  ...extra,
});

const MERMAS = [
  merma("s1", {
    shrinkageType: "daño_almacen",
    quantity: 2,
    unitCost: "10.00" as unknown as number,
    recoveredAmount: "5.00" as unknown as number,
    notes: "rotos",
  }),
  merma("s2", { quantity: 1, unitCost: 30 }),
];

const invalidar = jest.fn();

function mockConsultas(lista: IInventoryShrinkage[], resumen?: { totalUnidades: number; costoEstimado: number }) {
  jest.mocked(useAdminShrinkageList).mockReturnValue({
    data: lista,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useAdminShrinkageList>);
  jest.mocked(useAdminShrinkageSummary).mockReturnValue({
    data: resumen,
    isLoading: false,
  } as unknown as ReturnType<typeof useAdminShrinkageSummary>);
}

function renderPagina() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <MermaPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useInvalidateAdminQueries).mockReturnValue(invalidar);
  mockConsultas(MERMAS, { totalUnidades: 3, costoEstimado: 45 });
  jest.mocked(createShrinkage).mockResolvedValue(merma("nueva", {}));
});

it("dice que las mermas de Almacén ya llegan solas (desde el 26-11) y muestra los totales del periodo", () => {
  renderPagina();
  expect(
    screen.getByText(
      "Las mermas que se aprueban en Almacén (ajustes de inventario) llegan solas a esta lista desde el 26 de noviembre de 2026; las anteriores no están.",
    ),
  ).toBeInTheDocument();
  expect(screen.queryByText(/Fase 2/)).not.toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Unidades perdidas" })).getByText("3")).toBeInTheDocument();
  // 2 × 10 − 5 + 1 × 30 = 45
  expect(within(screen.getByRole("region", { name: "Costo estimado" })).getByText(formatSolesDecimales(45))).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Costo bruto" })).getByText(formatSolesDecimales(50))).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Recuperado" })).getByText(formatSolesDecimales(5))).toBeInTheDocument();

  const fila = within(screen.getByRole("table", { name: "Registros de merma del periodo" })).getByRole("row", {
    name: /Daño en almacén/,
  });
  expect(within(fila).getAllByRole("cell").map((c) => c.textContent)).toEqual([
    "10 nov 2026",
    "Daño en almacén",
    "2",
    formatSolesDecimales(10),
    formatSolesDecimales(20),
    formatSolesDecimales(5),
    formatSolesDecimales(15),
    "rotos",
  ]);
});

it("sin resumen del servidor, suma las filas de la lista", () => {
  mockConsultas(MERMAS, undefined);
  renderPagina();
  expect(within(screen.getByRole("region", { name: "Costo estimado" })).getByText(formatSolesDecimales(45))).toBeInTheDocument();
});

it("registra una merma y refresca los datos", async () => {
  renderPagina();
  fireEvent.click(screen.getByRole("button", { name: /Registrar merma/ }));
  fireEvent.change(screen.getByLabelText("Unidades"), { target: { value: "2" } });
  fireEvent.change(screen.getByLabelText("Costo unitario (S/)"), { target: { value: "12,5" } });
  expect(screen.getByText(/Pérdida neta:/)).toHaveTextContent(formatSolesDecimales(25));
  fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
  await waitFor(() =>
    expect(createShrinkage).toHaveBeenCalledWith(
      "c1",
      { shrinkageType: "otro", quantity: 2, unitCost: 12.5, recoveredAmount: 0, notes: undefined },
      "t",
    ),
  );
  await waitFor(() => expect(invalidar).toHaveBeenCalledWith("c1", "2026-11-01", "2026-11-26"));
});

it("no deja registrar unidades fuera de rango", () => {
  renderPagina();
  fireEvent.click(screen.getByRole("button", { name: /Registrar merma/ }));
  fireEvent.change(screen.getByLabelText("Unidades"), { target: { value: "1.5" } });
  fireEvent.change(screen.getByLabelText("Costo unitario (S/)"), { target: { value: "10" } });
  expect(screen.getByText("Número entero")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Registrar" })).toBeDisabled();
});

it("no revienta sin datos", () => {
  mockConsultas([], undefined);
  renderPagina();
  expect(screen.getByText("No hay mermas registradas en este periodo")).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Unidades perdidas" })).getByText("0")).toBeInTheDocument();
});
