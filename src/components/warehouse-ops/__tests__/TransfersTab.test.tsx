/**
 * Tests: Inventario › Traslados (FEAT-24 H5).
 *
 * 1. Botones por rol: Ventas solo mira; Almacén arma, despacha y recibe pero no anula; Operaciones anula.
 * 2. Almacenes del usuario: despacha si opera el origen, recibe si opera el destino; los filtros solo
 *    ofrecen los almacenes que ve.
 * 3. Despachar con periodo cerrado (423) lo explica; el reintento usa la MISMA Idempotency-Key.
 * 4. Recibir con 403 muestra «No tienes acceso a este almacén.».
 * 5. Recepción parcial: se reciben las líneas marcadas; lo que falta lleva su decisión.
 * 6. Sin rol de costos, el valor de las líneas sale como «••••».
 * 7. FEAT-24 H12: el detalle de un traslado sin recibir ofrece emitir la guía de remisión (motivo 04)
 *    a quien opera el origen.
 * 8. FEAT-24 C-D3: en estricto no se envía más que el disponible; en flexible el disponible solo avisa y, si el
 *    físico del origen queda en negativo, despachar pide la casilla y manda allowNegative. El 409
 *    STOCK_NEGATIVO_CONFIRMAR muestra su mensaje y la casilla; el reintento va con otra clave.
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { cancelTransfer, dispatchTransfer, listTransfers, receiveTransfer, updateTransfer } from "@/services/warehouseOpsService";
import { getInventoryRules, listWarehouses } from "@/services/warehousesService";
import { getStockByVariants } from "@/services/inventoryItems.service";
import TransfersTab from "../transfers/TransfersTab";
import { apiError, transfer, transferLine, WAREHOUSES } from "./fixtures";

const mockUser = { id: "u-1", role: "OPERACIONES", email: "ops@empresa.pe", permissions: [] as string[] };
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "t", company: { id: "c-1" }, user: mockUser } }),
}));
jest.mock("@/hooks/useMyWarehouses");
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/services/warehouseOpsService", () => ({
  listTransfers: jest.fn(),
  dispatchTransfer: jest.fn(),
  receiveTransfer: jest.fn(),
  cancelTransfer: jest.fn(),
  createTransfer: jest.fn(),
  updateTransfer: jest.fn(),
}));
jest.mock("@/services/warehousesService", () => ({ listWarehouses: jest.fn(), getInventoryRules: jest.fn() }));
jest.mock("@/services/variantCodesService", () => ({ lookupVariantsByCodes: jest.fn(), fetchVariantsByIds: jest.fn().mockResolvedValue([]) }));
jest.mock("@/services/purchasesService", () => ({ listPurchasableProducts: jest.fn().mockResolvedValue([]), listProductVariants: jest.fn() }));
jest.mock("@/services/inventoryItems.service", () => ({ getStockByVariants: jest.fn().mockResolvedValue([]) }));
jest.mock("@/components/gre/GreIssueDialog", () => ({
  __esModule: true,
  default: ({ source }: { source: { transfer?: { number: string }; originName?: string } }) => (
    <div data-testid="gre-issue-dialog">
      {source.transfer?.number} desde {source.originName}
    </div>
  ),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __setMyWarehouses } = require("@/hooks/useMyWarehouses") as typeof import("@/hooks/__mocks__/useMyWarehouses");

const draft = transfer();
const onTheWay = transfer({ id: "t-2", number: "TR-0002", status: "en_camino", dispatchedAt: "2026-11-17T15:00:00Z" });
const incoming = transfer({
  id: "t-3",
  number: "TR-0003",
  status: "en_camino",
  originInventoryId: "w-3",
  destinationInventoryId: "w-1",
  dispatchedAt: "2026-11-17T16:00:00Z",
  lines: [transferLine("i-5", "v-5", "Casaca", 2)],
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TransfersTab companyId="c-1" />
    </QueryClientProvider>,
  );
}

const row = (number: string) => screen.findByTestId(`transfer-${number}`);
// FEAT-24 H10: cada operación que mueve stock refresca el badge de Alertas.
const invalidate = jest.spyOn(QueryClient.prototype, "invalidateQueries");
const alertsRefreshed = () => expect(invalidate).toHaveBeenCalledWith({ queryKey: ["inventory-alerts"] });

beforeEach(() => {
  jest.clearAllMocks();
  mockUser.role = "OPERACIONES";
  __setMyWarehouses(null);
  jest.mocked(listWarehouses).mockResolvedValue({ warehouses: WAREHOUSES, links: [] });
  jest.mocked(listTransfers).mockResolvedValue([draft, onTheWay, incoming]);
  jest.mocked(getInventoryRules).mockResolvedValue({ releaseAfterDays: null, pickingRequired: false, igvAffected: true, allowPurchaseToCourier: false, stockControl: "estricto" });
  jest.mocked(getStockByVariants).mockResolvedValue([]);
});

const rulesWith = (stockControl: "flexible" | "estricto") =>
  jest.mocked(getInventoryRules).mockResolvedValue({ releaseAfterDays: null, pickingRequired: false, igvAffected: true, allowPurchaseToCourier: false, stockControl });

const confirm409 = (message: string) =>
  apiError(409, message, { code: "STOCK_NEGATIVO_CONFIRMAR" });

/** TR-0001 sale de Central (w-1): Polo ×2 con 1 de físico (queda en −1) y Gorra ×1 con 5 de físico, todos reservados. */
const ORIGIN_STOCK = [
  { variant_id: "v-1", quantity: 1, reserved_quantity: 0, available: 1, inventories: [{ inventory_id: "w-1", inventory_name: "Central", store_id: null, quantity: 1, reserved_quantity: 0 }] },
  { variant_id: "v-2", quantity: 5, reserved_quantity: 5, available: 0, inventories: [{ inventory_id: "w-1", inventory_name: "Central", store_id: null, quantity: 5, reserved_quantity: 5 }] },
];

async function openEditDraft(user: ReturnType<typeof userEvent.setup>) {
  jest.mocked(getStockByVariants).mockResolvedValue(ORIGIN_STOCK);
  setup();
  await user.click(within(await row("TR-0001")).getByRole("button", { name: "Editar" }));
  const dialog = await screen.findByRole("dialog", { name: "Editar TR-0001" });
  await within(dialog).findByText("El físico queda en −1");
  return dialog;
}

describe("Traslados", () => {
  it("Ventas ve la lista sin botones de acción", async () => {
    mockUser.role = "VENTAS";
    setup();
    const first = await row("TR-0001");
    await waitFor(() => expect(first).toHaveTextContent("Central → Tienda Sur"));
    expect(screen.queryByRole("button", { name: "Nuevo traslado" })).not.toBeInTheDocument();
    for (const name of ["Editar", "Despachar", "Recibir", "Anular"]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  });

  it("Almacén despacha y recibe solo donde opera, no anula, y los filtros muestran solo lo que ve", async () => {
    mockUser.role = "ALMACEN";
    __setMyWarehouses({ all: false, inventoryIds: ["w-1", "w-2"], operableIds: ["w-1"] });
    setup();
    expect(within(await row("TR-0001")).getByRole("button", { name: "Despachar" })).toBeInTheDocument();
    expect(within(await row("TR-0002")).queryByRole("button", { name: "Recibir" })).not.toBeInTheDocument();
    expect(within(await row("TR-0003")).getByRole("button", { name: "Recibir" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anular" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nuevo traslado" })).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByLabelText("Origen")).getAllByRole("option")).toHaveLength(3));
    expect(within(screen.getByLabelText("Origen")).queryByRole("option", { name: "Shalom" })).not.toBeInTheDocument();
  });

  it("los filtros Origen y Destino filtran la lista y «Nuevo traslado» abre con ambos precargados y editables", async () => {
    const user = userEvent.setup();
    setup();
    await row("TR-0003");
    await waitFor(() => expect(within(screen.getByLabelText("Origen")).getAllByRole("option")).toHaveLength(4));
    await user.selectOptions(screen.getByLabelText("Origen"), "w-1");
    await user.selectOptions(screen.getByLabelText("Destino"), "w-2");
    await waitFor(() => expect(screen.queryByTestId("transfer-TR-0003")).not.toBeInTheDocument());
    expect(screen.getByTestId("transfer-TR-0001")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Nuevo traslado" }));
    const dialog = await screen.findByRole("dialog", { name: "Nuevo traslado" });
    await waitFor(() => expect(within(dialog).getByLabelText("Origen")).toHaveValue("w-1"));
    expect(within(dialog).getByLabelText("Destino")).toHaveValue("w-2");
    await user.selectOptions(within(dialog).getByLabelText("Destino"), "w-3");
    expect(within(dialog).getByLabelText("Destino")).toHaveValue("w-3");
  });

  it("con el mismo almacén en Origen y Destino, el destino no se precarga", async () => {
    const user = userEvent.setup();
    setup();
    await row("TR-0001");
    await waitFor(() => expect(within(screen.getByLabelText("Destino")).getAllByRole("option")).toHaveLength(4));
    await user.selectOptions(screen.getByLabelText("Origen"), "w-1");
    await user.selectOptions(screen.getByLabelText("Destino"), "w-1");
    await user.click(screen.getByRole("button", { name: "Nuevo traslado" }));
    const dialog = await screen.findByRole("dialog", { name: "Nuevo traslado" });
    await waitFor(() => expect(within(dialog).getByLabelText("Origen")).toHaveValue("w-1"));
    expect(within(dialog).getByLabelText("Destino")).toHaveValue("");
  });

  it("despachar con el periodo cerrado lo explica y el reintento usa la misma Idempotency-Key", async () => {
    const user = userEvent.setup();
    jest.mocked(dispatchTransfer)
      .mockRejectedValueOnce(apiError(423, "El periodo 2026-10 está cerrado.", { code: "PERIODO_CERRADO", period: "2026-10" }))
      .mockResolvedValueOnce({ duplicate: false, transfer: { ...draft, status: "en_camino" } });
    setup();
    await user.click(within(await row("TR-0001")).getByRole("button", { name: "Despachar" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Despachar" }));
    expect(await within(dialog).findByText(/reabrir el periodo en Inventario › Cierre mensual/)).toHaveTextContent("El periodo 2026-10 está cerrado.");
    await user.click(within(dialog).getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(dispatchTransfer).toHaveBeenCalledTimes(2));
    const [first, second] = jest.mocked(dispatchTransfer).mock.calls;
    expect(first[0]).toBe("t-1");
    expect(second[1].operationId).toBe(first[1].operationId);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("TR-0001 en camino", expect.anything()));
    alertsRefreshed();
  });

  it("despachar: si el servidor pide confirmar el negativo, muestra su mensaje y la casilla; el reintento manda allowNegative con otra clave", async () => {
    const user = userEvent.setup();
    jest.mocked(dispatchTransfer)
      .mockRejectedValueOnce(confirm409("Polo queda en −1 en Central: confirma para seguir."))
      .mockResolvedValueOnce({ duplicate: false, transfer: { ...draft, status: "en_camino" } });
    setup();
    await user.click(within(await row("TR-0001")).getByRole("button", { name: "Despachar" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Despachar" }));
    expect(await within(dialog).findByText("Polo queda en −1 en Central: confirma para seguir.")).toBeInTheDocument();
    const button = within(dialog).getByRole("button", { name: "Despachar" });
    expect(button).toBeDisabled();
    await user.click(within(dialog).getByRole("checkbox", { name: "Confirmo que el físico del origen quedará en negativo" }));
    await user.click(button);
    await waitFor(() => expect(dispatchTransfer).toHaveBeenCalledTimes(2));
    const [first, second] = jest.mocked(dispatchTransfer).mock.calls;
    expect(first[1]).not.toHaveProperty("allowNegative");
    expect(second[1]).toMatchObject({ allowNegative: true });
    expect(second[1].operationId).not.toBe(first[1].operationId);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("TR-0001 en camino", expect.anything()));
  });

  it("estricto: el formulario no deja enviar más que el disponible (como antes)", async () => {
    const user = userEvent.setup();
    const dialog = await openEditDraft(user);
    expect(within(dialog).getAllByText("Supera el disponible")).toHaveLength(2);
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Despachar ahora" }));
    expect(await within(dialog).findByText("Polo: solo hay 1 disponibles en el origen.")).toBeInTheDocument();
    expect(updateTransfer).not.toHaveBeenCalled();
    expect(dispatchTransfer).not.toHaveBeenCalled();
  });

  it("flexible: superar el disponible solo avisa; el físico negativo pide la casilla para despachar y manda allowNegative", async () => {
    const user = userEvent.setup();
    rulesWith("flexible");
    jest.mocked(updateTransfer).mockResolvedValue(draft);
    jest.mocked(dispatchTransfer).mockResolvedValue({ duplicate: false, transfer: { ...draft, status: "en_camino" } });
    const dialog = await openEditDraft(user);
    expect(await within(dialog).findAllByText("Supera el disponible: hay reservas que quedarán sin stock")).toHaveLength(2);
    expect(within(dialog).queryByText("Supera el disponible")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Despachar ahora" }));
    expect(await within(dialog).findByText("Para despachar, confirma que el físico del origen quedará en negativo.")).toBeInTheDocument();
    expect(updateTransfer).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("checkbox", { name: "Confirmo que el físico del origen quedará en negativo" }));
    await user.click(within(dialog).getByRole("button", { name: "Despachar ahora" }));
    await waitFor(() => expect(dispatchTransfer).toHaveBeenCalledTimes(1));
    expect(updateTransfer).toHaveBeenCalledWith("t-1", expect.objectContaining({ originInventoryId: "w-1" }));
    expect(jest.mocked(dispatchTransfer).mock.calls[0][1]).toEqual({ operationId: expect.any(String), allowNegative: true });
  });

  it("flexible: guardar el borrador no pide la casilla (no mueve stock)", async () => {
    const user = userEvent.setup();
    rulesWith("flexible");
    jest.mocked(updateTransfer).mockResolvedValue(draft);
    const dialog = await openEditDraft(user);
    await within(dialog).findByRole("checkbox", { name: "Confirmo que el físico del origen quedará en negativo" });
    await user.click(within(dialog).getByRole("button", { name: "Guardar borrador" }));
    await waitFor(() => expect(updateTransfer).toHaveBeenCalledTimes(1));
    expect(dispatchTransfer).not.toHaveBeenCalled();
  });

  it("el formulario: si el despacho pide confirmar (409), queda el borrador y el reintento manda allowNegative con otra clave", async () => {
    const user = userEvent.setup();
    jest.mocked(updateTransfer).mockResolvedValue(draft);
    jest.mocked(dispatchTransfer)
      .mockRejectedValueOnce(confirm409("Gorra queda en −1: confirma para seguir."))
      .mockResolvedValueOnce({ duplicate: false, transfer: { ...draft, status: "en_camino" } });
    // Sin el stock del origen (no se pudo leer) la pantalla no lo prevé: lo pide el servidor.
    jest.mocked(getStockByVariants).mockRejectedValue(new Error("503"));
    setup();
    await user.click(within(await row("TR-0001")).getByRole("button", { name: "Editar" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar TR-0001" });
    await user.click(within(dialog).getByRole("button", { name: "Despachar ahora" }));
    expect(await within(dialog).findByText("TR-0001 quedó guardado como borrador. Gorra queda en −1: confirma para seguir.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("checkbox", { name: "Confirmo que el físico del origen quedará en negativo" }));
    await user.click(within(dialog).getByRole("button", { name: "Despachar ahora" }));
    await waitFor(() => expect(dispatchTransfer).toHaveBeenCalledTimes(2));
    const [first, second] = jest.mocked(dispatchTransfer).mock.calls;
    expect(first[1]).not.toHaveProperty("allowNegative");
    expect(second[1]).toMatchObject({ allowNegative: true });
    expect(second[1].operationId).not.toBe(first[1].operationId);
  });

  it("recibir sin acceso al almacén muestra el 403 del servidor", async () => {
    const user = userEvent.setup();
    jest.mocked(receiveTransfer).mockRejectedValue(apiError(403, "No tienes acceso a este almacén."));
    setup();
    await user.click(within(await row("TR-0003")).getByRole("button", { name: "Recibir" }));
    await user.click(await screen.findByRole("button", { name: "Confirmar recepción" }));
    expect(await screen.findByText("No tienes acceso a este almacén.")).toBeInTheDocument();
  });

  it("recepción parcial: solo lo marcado, y lo que falta va con su decisión", async () => {
    const user = userEvent.setup();
    jest.mocked(receiveTransfer).mockResolvedValue({ duplicate: false, transfer: { ...onTheWay, status: "en_camino" } });
    setup();
    await user.click(within(await row("TR-0002")).getByRole("button", { name: "Recibir" }));
    const polo = await screen.findByLabelText("Recibido: Polo");
    expect(polo).toHaveValue("2");
    await user.clear(polo);
    await user.type(polo, "1");
    const poloLine = screen.getByTestId("tr-receive-i-1");
    expect(within(poloLine).getByText("Faltan 1")).toBeInTheDocument();
    await user.selectOptions(within(poloLine).getByLabelText("Qué hacer con la diferencia"), "reclamo");
    await user.click(screen.getByRole("checkbox", { name: "Recibir ahora: Gorra" }));
    expect(within(screen.getByTestId("tr-receive-i-2")).getByText("Se recibe después: el traslado sigue en camino.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar recepción" }));
    await waitFor(() => expect(receiveTransfer).toHaveBeenCalledTimes(1));
    const [id, body] = jest.mocked(receiveTransfer).mock.calls[0];
    expect(id).toBe("t-2");
    expect(body.lines).toEqual([{ itemId: "i-1", quantityReceived: 1, decision: "reclamo" }]);
    expect(body.operationId).toMatch(/^[0-9a-f-]{36}$/);
    await waitFor(alertsRefreshed);
  });

  it("Operaciones anula con motivo y su propia clave", async () => {
    const user = userEvent.setup();
    jest.mocked(cancelTransfer).mockResolvedValue({ duplicate: false, transfer: { ...onTheWay, status: "anulado" } });
    setup();
    await user.click(within(await row("TR-0002")).getByRole("button", { name: "Anular" }));
    await user.type(await screen.findByLabelText(/Motivo/), "Se despachó por error");
    await user.click(screen.getByRole("button", { name: "Anular traslado" }));
    await waitFor(() => expect(cancelTransfer).toHaveBeenCalledWith("t-2", { reason: "Se despachó por error", operationId: expect.any(String) }));
  });

  it("sin rol de costos, el valor de las líneas sale oculto", async () => {
    const user = userEvent.setup();
    mockUser.role = "ALMACEN";
    // La API omite `unitCost` y `value` para este rol.
    setup();
    await user.click(within(await row("TR-0001")).getByRole("button", { name: "Ver TR-0001" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByLabelText("Costo oculto").length).toBeGreaterThan(0);
  });

  it("el detalle de un traslado sin recibir ofrece emitir la guía de remisión a quien opera el origen", async () => {
    mockUser.role = "ALMACEN";
    __setMyWarehouses({ all: false, inventoryIds: ["w-1", "w-2", "w-3"], operableIds: ["w-1"] });
    jest.mocked(listTransfers).mockResolvedValue([draft, onTheWay, incoming, transfer({ id: "t-4", number: "TR-0004", status: "recibido" })]);
    const user = userEvent.setup();
    setup();

    expect(within(await row("TR-0002")).queryByRole("button", { name: /Emitir guía de remisión/ })).not.toBeInTheDocument();
    await user.click(within(await row("TR-0002")).getByRole("button", { name: "Ver TR-0002" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: /Emitir guía de remisión/ }));
    expect(await screen.findByTestId("gre-issue-dialog")).toHaveTextContent("TR-0002 desde Central");
  });

  it("no ofrece la guía en traslados recibidos ni en los que salen de un almacén que no opera", async () => {
    mockUser.role = "ALMACEN";
    __setMyWarehouses({ all: false, inventoryIds: ["w-1", "w-2", "w-3"], operableIds: ["w-1"] });
    jest.mocked(listTransfers).mockResolvedValue([draft, onTheWay, incoming, transfer({ id: "t-4", number: "TR-0004", status: "recibido" })]);
    const user = userEvent.setup();
    setup();

    await user.click(within(await row("TR-0004")).getByRole("button", { name: "Ver TR-0004" }));
    expect(within(await screen.findByRole("dialog")).queryByRole("button", { name: /Emitir guía de remisión/ })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(within(await row("TR-0003")).getByRole("button", { name: "Ver TR-0003" }));
    expect(within(await screen.findByRole("dialog")).queryByRole("button", { name: /Emitir guía de remisión/ })).not.toBeInTheDocument();
  });
});
