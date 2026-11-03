/**
 * Tests: GestionAlmacenes (FEAT-24 H1-A, Task 20 — almacenes de la empresa)
 *
 * Comportamiento verificado:
 * 1. Lista TODOS los almacenes de la empresa (`listWarehouses`) con tipo,
 *    insignia "Principal" en uno solo y la tienda de origen.
 * 2. Los activos van primero; el inactivo se marca y no se puede editar.
 * 3. Cambiar el tipo llama a `setWarehouseType` y vuelve a pedir la lista.
 * 4. "Hacer principal" llama a `setMainWarehouse`, refresca y la insignia se
 *    mueve; el principal actual no ofrece la acción.
 * 5. Cada tienda tiene su selector "Almacén por defecto" (valor actual desde los
 *    vínculos) y elegir otro pide confirmación antes de llamar a
 *    `setStoreDefaultWarehouse`.
 * 6. Un error 403/503 muestra el mensaje del backend en un toast (cambio y
 *    carga de la lista); tras un cambio fallido el valor vuelve al anterior.
 * 7. Cada almacén ofrece "Eliminar" (deshabilitado en el principal; el
 *    flujo con el nombre está en GestionAlmacenes.delete.test.tsx) y el
 *    componente no usa `axios` suelto.
 * 8. "Nuevo Almacén" crea con `createWarehouse` y refresca lista e inventarios.
 * 9. (Revisión final) Los cambios invalidan también las cachés que dependen de
 *    los almacenes; mientras guarda, los selectores usan `aria-disabled`; el
 *    inactivo no muestra "Principal"; los botones llevan el nombre del almacén.
 *
 * Mocks: AuthContext, sonner, `@/services/warehousesService` (sin red) y
 * `axios` (para comprobar que el componente no lo usa).
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  createWarehouse,
  listWarehouses,
  setMainWarehouse,
  setStoreDefaultWarehouse,
  setWarehouseType,
  type CompanyWarehouse,
  type CompanyWarehouses,
} from "@/services/warehousesService";
import GestionAlmacenes from "../GestionAlmacenes";

jest.mock("axios");
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));
jest.mock("@/services/warehousesService", () => ({
  listWarehouses: jest.fn(),
  createWarehouse: jest.fn(),
  setWarehouseType: jest.fn(),
  setMainWarehouse: jest.fn(),
  setStoreDefaultWarehouse: jest.fn(),
  deleteWarehouse: jest.fn(),
}));

const mockList = jest.mocked(listWarehouses);
const mockCreate = jest.mocked(createWarehouse);
const mockSetType = jest.mocked(setWarehouseType);
const mockSetMain = jest.mocked(setMainWarehouse);
const mockSetDefault = jest.mocked(setStoreDefaultWarehouse);
const refreshInventories = jest.fn();

const COMPANY = "company-a";
const STORE_A = "store-a";
const STORE_B = "store-b";

const warehouse = (over: Partial<CompanyWarehouse> & Pick<CompanyWarehouse, "id" | "name">): CompanyWarehouse => ({
  status: true,
  store_id: STORE_A,
  company_id: COMPANY,
  type: "PROPIO",
  is_main: false,
  ...over,
});

const CENTRAL = warehouse({ id: "w-central", name: "Almacén Central", is_main: true });
const SUR = warehouse({ id: "w-sur", name: "Almacén Sur", store_id: STORE_B, type: "TIENDA" });
const SHALOM = warehouse({ id: "w-shalom", name: "Shalom", type: "COURIER" });

const payload = (over: Partial<CompanyWarehouses> = {}): CompanyWarehouses => ({
  warehouses: [CENTRAL, SUR, SHALOM],
  links: [
    { store_id: STORE_A, inventory_id: CENTRAL.id, is_default: true },
    { store_id: STORE_B, inventory_id: SUR.id, is_default: true },
  ],
  ...over,
});

// Los nombres también salen como opciones de los selectores: se busca el título de la tarjeta.
const waitForList = () => screen.findAllByTestId(/^warehouse-/);

const card = (name: string) => {
  const found = screen
    .getAllByTestId(/^warehouse-/)
    .find((el) => within(el).queryByRole("heading", { name }));
  if (!found) throw new Error(`No hay tarjeta para ${name}`);
  return found;
};

const renderScreen = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = jest.spyOn(client, "invalidateQueries");
  const view = render(
    <QueryClientProvider client={client}>
      <GestionAlmacenes />
    </QueryClientProvider>,
  );
  return { ...view, invalidate };
};

// Elegir otro almacén por defecto pide confirmación: este helper la acepta.
const confirmDefaultChange = async (user: ReturnType<typeof userEvent.setup>) => {
  const dialog = await screen.findByRole("alertdialog");
  await user.click(within(dialog).getByRole("button", { name: "Cambiar almacén" }));
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    auth: {
      accessToken: "test-token",
      user: { id: "user-a" },
      company: {
        id: COMPANY,
        name: "Corporación",
        stores: [
          { id: STORE_A, name: "LIVII" },
          { id: STORE_B, name: "Aranni" },
        ],
      },
    },
    selectedStoreId: STORE_A,
    refreshInventories,
  } as unknown as ReturnType<typeof useAuth>);
  mockList.mockResolvedValue(payload());
  mockCreate.mockResolvedValue(warehouse({ id: "w-new", name: "Almacén Nuevo" }));
  mockSetType.mockResolvedValue(undefined);
  mockSetMain.mockResolvedValue(undefined);
  mockSetDefault.mockResolvedValue(undefined);
});

describe("Almacenes de la empresa", () => {
  it("lista todos los almacenes con tipo, insignia Principal y tienda de origen", async () => {
    renderScreen();
    await waitForList();

    expect(mockList).toHaveBeenCalledTimes(1);
    expect(screen.getAllByTestId(/^warehouse-/)).toHaveLength(3);

    const central = within(card("Almacén Central"));
    expect(central.getByText("Principal")).toBeInTheDocument();
    expect(central.getByText("Tienda de origen: LIVII")).toBeInTheDocument();
    expect(central.getByLabelText("Tipo de Almacén Central")).toHaveValue("PROPIO");
    expect(central.getByLabelText("Tipo de Almacén Central")).toHaveDisplayValue("Propio");

    const sur = within(card("Almacén Sur"));
    expect(sur.getByText("Tienda de origen: Aranni")).toBeInTheDocument();
    expect(sur.getByLabelText("Tipo de Almacén Sur")).toHaveDisplayValue("Tienda");
    expect(sur.queryByText("Principal")).not.toBeInTheDocument();

    expect(within(card("Shalom")).getByLabelText("Tipo de Shalom")).toHaveDisplayValue("Courier");
    // La insignia aparece en un solo almacén.
    expect(screen.getAllByText("Principal")).toHaveLength(1);
    // Las tres opciones de tipo, con etiquetas para el usuario.
    const options = within(central.getByLabelText("Tipo de Almacén Central")).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Propio", "Tienda", "Courier"]);
    expect(options.map((o) => (o as HTMLOptionElement).value)).toEqual(["PROPIO", "TIENDA", "COURIER"]);
  });

  it("muestra los activos primero y deja el inactivo sin acciones", async () => {
    const inactive = warehouse({ id: "w-viejo", name: "Almacén Viejo", status: false });
    mockList.mockResolvedValue(
      payload({ warehouses: [inactive, SHALOM, CENTRAL, SUR] }),
    );
    renderScreen();
    await waitForList();

    const order = screen.getAllByTestId(/^warehouse-/).map((el) => el.getAttribute("data-testid"));
    expect(order).toEqual(["warehouse-w-shalom", "warehouse-w-central", "warehouse-w-sur", "warehouse-w-viejo"]);

    const viejo = within(card("Almacén Viejo"));
    expect(viejo.getByText("Inactivo")).toBeInTheDocument();
    expect(viejo.getByLabelText("Tipo de Almacén Viejo")).toBeDisabled();
    expect(viejo.queryByRole("button", { name: /^Hacer principal/ })).not.toBeInTheDocument();
  });

  it("cambiar el tipo llama a setWarehouseType y vuelve a pedir la lista", async () => {
    const user = userEvent.setup();
    mockList
      .mockResolvedValueOnce(payload())
      .mockResolvedValueOnce(payload({ warehouses: [CENTRAL, { ...SUR, type: "COURIER" }, SHALOM] }));
    renderScreen();
    await waitForList();

    await user.selectOptions(within(card("Almacén Sur")).getByLabelText("Tipo de Almacén Sur"), "COURIER");

    expect(mockSetType).toHaveBeenCalledTimes(1);
    expect(mockSetType).toHaveBeenCalledWith("w-sur", "COURIER");
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(within(card("Almacén Sur")).getByLabelText("Tipo de Almacén Sur")).toHaveDisplayValue("Courier"),
    );
    expect(toast.success).toHaveBeenCalledWith("Tipo actualizado");
  });

  it("Hacer principal llama a setMainWarehouse, refresca y mueve la insignia", async () => {
    const user = userEvent.setup();
    mockList.mockResolvedValueOnce(payload()).mockResolvedValueOnce(
      payload({ warehouses: [{ ...CENTRAL, is_main: false }, { ...SUR, is_main: true }, SHALOM] }),
    );
    renderScreen();
    await waitForList();

    // El principal actual no ofrece la acción; los demás sí.
    expect(within(card("Almacén Central")).queryByRole("button", { name: /^Hacer principal/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Hacer principal/ })).toHaveLength(2);

    await user.click(within(card("Almacén Sur")).getByRole("button", { name: "Hacer principal: Almacén Sur" }));

    expect(mockSetMain).toHaveBeenCalledTimes(1);
    expect(mockSetMain).toHaveBeenCalledWith("w-sur");
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(within(card("Almacén Sur")).getByText("Principal")).toBeInTheDocument());
    expect(within(card("Almacén Central")).queryByText("Principal")).not.toBeInTheDocument();
    expect(within(card("Almacén Central")).getByRole("button", { name: "Hacer principal: Almacén Central" })).toBeInTheDocument();
    expect(screen.getAllByText("Principal")).toHaveLength(1);
    expect(toast.success).toHaveBeenCalledWith("Almacén principal actualizado");
  });

  it("cada tienda tiene su selector Almacén por defecto y elegir otro llama a setStoreDefaultWarehouse", async () => {
    const user = userEvent.setup();
    mockList.mockResolvedValueOnce(payload()).mockResolvedValueOnce(
      payload({
        links: [
          { store_id: STORE_A, inventory_id: CENTRAL.id, is_default: true },
          { store_id: STORE_B, inventory_id: SHALOM.id, is_default: true },
        ],
      }),
    );
    renderScreen();
    await waitForList();

    const storeA = screen.getByLabelText("Almacén por defecto de LIVII");
    const storeB = screen.getByLabelText("Almacén por defecto de Aranni");
    expect(storeA).toHaveDisplayValue("Almacén Central");
    expect(storeB).toHaveDisplayValue("Almacén Sur");
    // Las opciones son los almacenes activos de TODA la empresa (compartibles).
    expect(within(storeB).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Almacén Central",
      "Almacén Sur",
      "Shalom",
    ]);

    await user.selectOptions(storeB, "w-shalom");
    await confirmDefaultChange(user);

    expect(mockSetDefault).toHaveBeenCalledTimes(1);
    expect(mockSetDefault).toHaveBeenCalledWith(STORE_B, "w-shalom");
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByLabelText("Almacén por defecto de Aranni")).toHaveDisplayValue("Shalom"));
    expect(toast.success).toHaveBeenCalledWith("Almacén por defecto actualizado");
  });

  it("una tienda sin vínculo por defecto lo dice y no inventa uno", async () => {
    mockList.mockResolvedValue(payload({ links: [{ store_id: STORE_A, inventory_id: CENTRAL.id, is_default: true }] }));
    renderScreen();
    await waitForList();

    const storeB = screen.getByLabelText("Almacén por defecto de Aranni");
    expect(storeB).toHaveDisplayValue("Sin almacén por defecto");
    expect(storeB).toHaveValue("");
    expect(mockSetDefault).not.toHaveBeenCalled();
  });

  it.each([
    [403, "No puedes modificar almacenes de otra empresa"],
    [503, "El servicio de inventario no responde. Inténtalo en unos minutos"],
  ])("un error %i al cambiar el tipo muestra el mensaje del backend y deja el valor anterior", async (status, message) => {
    const user = userEvent.setup();
    mockSetType.mockRejectedValue({ response: { status, data: { message } } });
    renderScreen();
    await waitForList();

    await user.selectOptions(within(card("Almacén Sur")).getByLabelText("Tipo de Almacén Sur"), "COURIER");

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(toast.success).not.toHaveBeenCalled();
    expect(within(card("Almacén Sur")).getByLabelText("Tipo de Almacén Sur")).toHaveDisplayValue("Tienda");
  });

  it("un error al hacer principal o al elegir el por defecto muestra el mensaje del backend", async () => {
    const user = userEvent.setup();
    mockSetMain.mockRejectedValue({ response: { status: 403, data: { message: "Solo se puede marcar un almacén activo" } } });
    mockSetDefault.mockRejectedValue({ response: { status: 503, data: { message: ["Servicio no disponible", "Inténtalo de nuevo"] } } });
    renderScreen();
    await waitForList();

    await user.click(within(card("Almacén Sur")).getByRole("button", { name: "Hacer principal: Almacén Sur" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Solo se puede marcar un almacén activo"));

    await user.selectOptions(screen.getByLabelText("Almacén por defecto de Aranni"), "w-shalom");
    await confirmDefaultChange(user);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Servicio no disponible. Inténtalo de nuevo"));
    expect(screen.getByLabelText("Almacén por defecto de Aranni")).toHaveDisplayValue("Almacén Sur");
  });

  it("si la lista falla con 503 muestra el mensaje del backend en un toast y permite reintentar", async () => {
    const user = userEvent.setup();
    const message = "ms-logistics no responde";
    mockList.mockRejectedValueOnce({ response: { status: 503, data: { message } } });
    renderScreen();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(message));
    expect(await screen.findByText("No se pudieron cargar los almacenes")).toBeInTheDocument();
    expect(screen.queryByText("No tienes almacenes creados aún")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitForList();
    expect(mockList).toHaveBeenCalledTimes(2);
  });

  it("ofrece Eliminar en cada almacén salvo el principal y no usa axios suelto", async () => {
    renderScreen();
    await waitForList();

    expect(screen.getByRole("button", { name: "Eliminar almacén Almacén Sur" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Eliminar almacén Shalom" })).toBeEnabled();
    const main = screen.getByRole("button", { name: "Eliminar almacén Almacén Central" });
    expect(main).toBeDisabled();
    expect(main).toHaveAttribute("title", expect.stringContaining("principal no se puede eliminar"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalled();
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.put).not.toHaveBeenCalled();
    expect(axios.delete).not.toHaveBeenCalled();
  });

  it("Nuevo Almacén crea con createWarehouse en la tienda seleccionada y refresca la lista y los inventarios", async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForList();

    await user.click(screen.getByRole("button", { name: /Nuevo Almacén/ }));
    await user.type(await screen.findByLabelText("Nombre del almacén"), "Almacén Nuevo");
    await user.click(screen.getByRole("button", { name: "Crear Almacén" }));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith({ name: "Almacén Nuevo", storeId: STORE_A, type: "PROPIO" }));
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
    expect(refreshInventories).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByLabelText("Nombre del almacén")).not.toBeInTheDocument());
  });
});

describe("Revisión final de la pantalla de almacenes (FEAT-24 H1-A)", () => {
  const RELATED_PREFIXES = [["business-inventories"], ["sale-context"], ["inventory-metrics"]];

  it("tras cambiar el tipo se invalidan también las cachés que dependen de los almacenes", async () => {
    const user = userEvent.setup();
    const { invalidate } = renderScreen();
    await waitForList();

    await user.selectOptions(within(card("Almacén Sur")).getByLabelText("Tipo de Almacén Sur"), "COURIER");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Tipo actualizado"));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["company-warehouses", COMPANY] });
    for (const queryKey of RELATED_PREFIXES) expect(invalidate).toHaveBeenCalledWith({ queryKey });
  });

  it("tras cambiar el por defecto de una tienda se invalidan esas cachés", async () => {
    const user = userEvent.setup();
    const { invalidate } = renderScreen();
    await waitForList();

    await user.selectOptions(screen.getByLabelText("Almacén por defecto de Aranni"), "w-shalom");
    await confirmDefaultChange(user);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Almacén por defecto actualizado"));

    for (const queryKey of RELATED_PREFIXES) expect(invalidate).toHaveBeenCalledWith({ queryKey });
  });

  it("tras crear un almacén se invalidan esas cachés", async () => {
    const user = userEvent.setup();
    const { invalidate } = renderScreen();
    await waitForList();

    await user.click(screen.getByRole("button", { name: /Nuevo Almacén/ }));
    await user.type(await screen.findByLabelText("Nombre del almacén"), "Almacén Nuevo");
    await user.click(screen.getByRole("button", { name: "Crear Almacén" }));
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));

    for (const queryKey of RELATED_PREFIXES) expect(invalidate).toHaveBeenCalledWith({ queryKey });
  });

  it("elegir otro almacén por defecto pide confirmación y no guarda hasta aceptar", async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForList();

    const storeB = screen.getByLabelText("Almacén por defecto de Aranni");
    await user.selectOptions(storeB, "w-shalom");

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Aranni/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Shalom/)).toBeInTheDocument();
    expect(mockSetDefault).not.toHaveBeenCalled();
    // El selector controlado no cambia de valor mientras no se confirme.
    expect(storeB).toHaveDisplayValue("Almacén Sur");

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(mockSetDefault).not.toHaveBeenCalled();
    expect(storeB).toHaveDisplayValue("Almacén Sur");

    await user.selectOptions(storeB, "w-shalom");
    await confirmDefaultChange(user);
    await waitFor(() => expect(mockSetDefault).toHaveBeenCalledTimes(1));
    expect(mockSetDefault).toHaveBeenCalledWith(STORE_B, "w-shalom");
  });

  it("mientras guarda, los selectores usan aria-disabled (no disabled) y no aceptan otro cambio", async () => {
    const user = userEvent.setup();
    let resolveType: () => void = () => {};
    mockSetType.mockReturnValue(new Promise<void>((resolve) => (resolveType = resolve)));
    renderScreen();
    await waitForList();

    const sur = within(card("Almacén Sur")).getByLabelText("Tipo de Almacén Sur");
    await user.selectOptions(sur, "COURIER");

    await waitFor(() => expect(sur).toHaveAttribute("aria-disabled", "true"));
    expect(sur).not.toBeDisabled();
    const storeB = screen.getByLabelText("Almacén por defecto de Aranni");
    expect(storeB).toHaveAttribute("aria-disabled", "true");
    expect(storeB).not.toBeDisabled();

    // Otro cambio durante el guardado se ignora en el handler.
    await user.selectOptions(within(card("Shalom")).getByLabelText("Tipo de Shalom"), "TIENDA");
    await user.selectOptions(storeB, "w-shalom");
    expect(mockSetType).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(mockSetDefault).not.toHaveBeenCalled();

    resolveType();
    await waitFor(() => expect(sur).not.toHaveAttribute("aria-disabled"));
  });

  it('"Hacer principal" nombra el almacén para los lectores de pantalla', async () => {
    renderScreen();
    await waitForList();

    expect(screen.getByRole("button", { name: "Hacer principal: Almacén Sur" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hacer principal: Shalom" })).toBeInTheDocument();
  });

  it("un almacén inactivo con is_main heredado no muestra la insignia Principal", async () => {
    const heredado = warehouse({ id: "w-viejo", name: "Almacén Viejo", status: false, is_main: true });
    mockList.mockResolvedValue(payload({ warehouses: [CENTRAL, SUR, heredado] }));
    renderScreen();
    await waitForList();

    expect(within(card("Almacén Viejo")).queryByText("Principal")).not.toBeInTheDocument();
    expect(within(card("Almacén Viejo")).getByText("Inactivo")).toBeInTheDocument();
    expect(screen.getAllByText("Principal")).toHaveLength(1);
  });

  it("un almacén inactivo no se ofrece como por defecto, salvo el actual, que se rotula (inactivo)", async () => {
    const viejo = warehouse({ id: "w-viejo", name: "Almacén Viejo", status: false });
    mockList.mockResolvedValue(
      payload({
        warehouses: [CENTRAL, SUR, viejo],
        links: [
          { store_id: STORE_A, inventory_id: CENTRAL.id, is_default: true },
          { store_id: STORE_B, inventory_id: viejo.id, is_default: true },
        ],
      }),
    );
    renderScreen();
    await waitForList();

    const optionsA = within(screen.getByLabelText("Almacén por defecto de LIVII")).getAllByRole("option");
    expect(optionsA.map((o) => o.textContent)).toEqual(["Almacén Central", "Almacén Sur"]);
    const storeB = screen.getByLabelText("Almacén por defecto de Aranni");
    expect(storeB).toHaveDisplayValue("Almacén Viejo (inactivo)");
    expect(within(storeB).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Almacén Central",
      "Almacén Sur",
      "Almacén Viejo (inactivo)",
    ]);
  });

  it("el texto del por defecto no promete ventas manuales, solo pedidos sin almacén", async () => {
    renderScreen();
    await waitForList();

    expect(
      screen.getByText("Los pedidos que llegan sin almacén (canales e integraciones) salen de este almacén."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Las ventas de la tienda salen de este almacén/)).not.toBeInTheDocument();
  });
});
