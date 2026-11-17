/**
 * Tests: «Reglas de reserva por región» en Tiendas y almacenes (FEAT-24 H2-F).
 *
 * 1. Carga las reglas en el orden en que se evalúan y explica la cascada.
 * 2. Un admin agrega, edita, desactiva, reordena y borra, y guarda la lista
 *    completa con la prioridad que da el orden.
 * 3. Un 400 del servidor se muestra con el nombre del almacén.
 * 4. Quien no es admin solo lee.
 * 5. Si la carga falla, avisa y deja reintentar.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  getReservationRules,
  listWarehouses,
  saveReservationRules,
  type CompanyWarehouse,
  type ReservationRule,
} from "@/services/warehousesService";
import ReservationRulesSection from "../ReservationRulesSection";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/services/warehousesService", () => ({
  getReservationRules: jest.fn(),
  saveReservationRules: jest.fn(),
  listWarehouses: jest.fn(),
}));

const mockGet = jest.mocked(getReservationRules);
const mockSave = jest.mocked(saveReservationRules);
const mockWarehouses = jest.mocked(listWarehouses);

const CENTRAL = "11111111-1111-4111-8111-111111111111";
const SUR = "22222222-2222-4222-8222-222222222222";
const VIEJO = "33333333-3333-4333-8333-333333333333";
const STORE_A = "44444444-4444-4444-8444-444444444444";
const STORE_B = "55555555-5555-4555-8555-555555555555";

const warehouse = (id: string, name: string, over: Partial<CompanyWarehouse> = {}): CompanyWarehouse => ({
  id,
  name,
  status: true,
  store_id: STORE_A,
  company_id: "c-1",
  type: "PROPIO",
  is_main: false,
  ...over,
});

const rules: ReservationRule[] = [
  { id: "r-sur", priority: 20, department: "Arequipa", province: null, storeId: null, inventoryId: SUR, active: true },
  { id: "r-lima", priority: 10, department: "Lima", province: "Lima", storeId: STORE_B, inventoryId: CENTRAL, active: true },
];

function loginAs(role: string) {
  jest.mocked(useAuth).mockReturnValue({
    auth: {
      accessToken: "t",
      user: { id: "u-1", role, permissions: [] },
      company: { id: "c-1", stores: [{ id: STORE_A, name: "LIVII" }, { id: STORE_B, name: "KUNCA" }] },
    },
  } as unknown as ReturnType<typeof useAuth>);
}

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReservationRulesSection />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGet.mockResolvedValue(rules);
  mockWarehouses.mockResolvedValue({
    warehouses: [
      warehouse(CENTRAL, "Central", { is_main: true }),
      warehouse(SUR, "Almacén Sur"),
      warehouse(VIEJO, "Viejo", { status: false }),
    ],
    links: [],
  });
});

describe("Reglas de reserva por región (FEAT-24 H2-F)", () => {
  it("muestra las reglas por prioridad y explica la cascada", async () => {
    loginAs("ADMIN");
    renderSection();
    expect(await screen.findByLabelText("Departamento de la regla 1")).toHaveValue("Lima");
    expect(screen.getByLabelText("Provincia de la regla 1")).toHaveValue("Lima");
    expect(screen.getByLabelText("Tienda de la regla 1")).toHaveValue(STORE_B);
    expect(screen.getByLabelText("Almacén de la regla 1")).toHaveValue(CENTRAL);
    expect(screen.getByLabelText("Departamento de la regla 2")).toHaveValue("Arequipa");
    expect(screen.getByLabelText("Provincia de la regla 2")).toHaveValue("");
    expect(screen.getByText(/el almacén por defecto de la tienda del pedido/)).toBeInTheDocument();
    expect(screen.getByText(/el almacén principal/)).toBeInTheDocument();
    // Un almacén inactivo no se ofrece.
    expect(within(screen.getByLabelText("Almacén de la regla 1")).queryByText(/Viejo/)).not.toBeInTheDocument();
    // Sin cambios no hay nada que guardar.
    expect(screen.getByRole("button", { name: "Guardar reglas" })).toBeDisabled();
  });

  it("un admin agrega, edita, desactiva, reordena y borra, y guarda la lista completa", async () => {
    loginAs("OWNER");
    const user = userEvent.setup();
    mockSave.mockImplementation(async (input) => input.map((rule, i) => ({ ...rule, id: `n-${i}` })));
    renderSection();
    await screen.findByLabelText("Departamento de la regla 1");

    await user.click(screen.getByRole("button", { name: "Agregar regla" }));
    // La nueva sale con el almacén principal.
    expect(screen.getByLabelText("Almacén de la regla 3")).toHaveValue(CENTRAL);
    await user.selectOptions(screen.getByLabelText("Departamento de la regla 3"), "Cusco");
    await user.selectOptions(screen.getByLabelText("Provincia de la regla 3"), "Urubamba");
    await user.selectOptions(screen.getByLabelText("Tienda de la regla 3"), STORE_A);
    await user.selectOptions(screen.getByLabelText("Almacén de la regla 3"), SUR);

    // La sube al primer lugar.
    await user.click(screen.getByRole("button", { name: "Subir regla 3" }));
    await user.click(screen.getByRole("button", { name: "Subir regla 2" }));
    expect(screen.getByLabelText("Departamento de la regla 1")).toHaveValue("Cusco");

    // Desactiva la de Lima (ahora 2) y borra la de Arequipa (3).
    await user.click(screen.getByRole("switch", { name: "Regla 2 activa" }));
    await user.click(screen.getByRole("button", { name: "Borrar regla 3" }));

    await user.click(screen.getByRole("button", { name: "Guardar reglas" }));
    await waitFor(() => expect(mockSave).toHaveBeenCalledTimes(1));
    expect(mockSave).toHaveBeenCalledWith([
      { priority: 10, department: "Cusco", province: "Urubamba", storeId: STORE_A, inventoryId: SUR, active: true },
      { priority: 20, department: "Lima", province: "Lima", storeId: STORE_B, inventoryId: CENTRAL, active: false },
    ]);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Reglas de reserva guardadas"));
    expect(screen.getByRole("button", { name: "Guardar reglas" })).toBeDisabled();
  });

  it("cambiar el departamento limpia la provincia y descartar vuelve a lo guardado", async () => {
    loginAs("ADMIN");
    const user = userEvent.setup();
    renderSection();
    await screen.findByLabelText("Departamento de la regla 1");
    await user.selectOptions(screen.getByLabelText("Departamento de la regla 1"), "Ica");
    expect(screen.getByLabelText("Provincia de la regla 1")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Descartar cambios" }));
    expect(screen.getByLabelText("Departamento de la regla 1")).toHaveValue("Lima");
    expect(screen.getByLabelText("Provincia de la regla 1")).toHaveValue("Lima");
  });

  it("avisa de una regla tapada por otra más general de arriba", async () => {
    loginAs("ADMIN");
    mockGet.mockResolvedValue([
      { id: "a", priority: 1, department: null, province: null, storeId: null, inventoryId: CENTRAL, active: true },
      { id: "b", priority: 2, department: "Lima", province: null, storeId: null, inventoryId: SUR, active: true },
    ]);
    renderSection();
    expect(await screen.findByText(/Esta regla nunca se usa/)).toBeInTheDocument();
  });

  it("muestra el 400 del servidor con el nombre del almacén", async () => {
    loginAs("ADMIN");
    const user = userEvent.setup();
    mockSave.mockRejectedValue({
      response: { status: 400, data: { message: `El almacén ${SUR} no está activo o no es de la empresa.` } },
    });
    renderSection();
    await screen.findByLabelText("Departamento de la regla 1");
    await user.click(screen.getByRole("switch", { name: "Regla 1 activa" }));
    await user.click(screen.getByRole("button", { name: "Guardar reglas" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("El almacén «Almacén Sur» no está activo o no es de la empresa.");
    expect(toast.error).toHaveBeenCalledWith("El almacén «Almacén Sur» no está activo o no es de la empresa.");
    // Lo editado sigue en pantalla para corregirlo.
    expect(screen.getByRole("switch", { name: "Regla 1 activa" })).not.toBeChecked();
  });

  it("quien no es admin solo lee las reglas", async () => {
    loginAs("VENTAS");
    renderSection();
    expect(await screen.findByText("Lima › Lima · KUNCA → Central")).toBeInTheDocument();
    expect(screen.getByText("Arequipa › cualquier provincia · cualquier tienda → Almacén Sur")).toBeInTheDocument();
    expect(screen.getByText("Solo un administrador puede cambiar las reglas.")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar reglas" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agregar regla" })).not.toBeInTheDocument();
  });

  it("sin reglas explica qué pasa y, si la carga falla, deja reintentar", async () => {
    loginAs("ADMIN");
    mockGet.mockResolvedValueOnce([]);
    const { unmount } = renderSection();
    expect(await screen.findByText(/No hay reglas/)).toBeInTheDocument();
    unmount();

    const user = userEvent.setup();
    mockGet.mockRejectedValueOnce({ response: { status: 503, data: { message: "Servicio no disponible" } } });
    renderSection();
    expect(await screen.findByRole("alert")).toHaveTextContent("Servicio no disponible");
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByLabelText("Departamento de la regla 1")).toHaveValue("Lima");
  });
});
