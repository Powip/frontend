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
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { cancelTransfer, dispatchTransfer, listTransfers, receiveTransfer } from "@/services/warehouseOpsService";
import { listWarehouses } from "@/services/warehousesService";
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
jest.mock("@/services/warehousesService", () => ({ listWarehouses: jest.fn() }));
jest.mock("@/services/variantCodesService", () => ({ lookupVariantsByCodes: jest.fn() }));
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
});

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
