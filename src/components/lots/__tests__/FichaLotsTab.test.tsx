/**
 * Tests: ficha del producto › Lotes y vencimiento (FEAT-24 H5-L).
 *
 * 1. Lista cada lote con su vencimiento, almacén, saldo y estado (vigente, por vencer, vencido, bloqueado) y lo «sin lote».
 * 2. Bloquear y desbloquear (Administrador u Operaciones).
 * 3. «Registrar lote» desde la fila «sin lote»: valida las unidades y manda el lote nuevo con su operationId.
 * 4. Editar un lote: manda solo lo que cambió y muestra el 409 del servidor.
 * 5. Roles: Almacén registra pero no edita; Ventas solo ve.
 */

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { assignLot, listLots, updateLot, type LotList } from "@/services/lotsService";
import FichaLotsTab from "../FichaLotsTab";

let role = "ADMINISTRADOR";
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "t", user: { id: "u1", role }, company: { id: "c1" } } }) }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));
jest.mock("@/services/lotsService", () => ({ LOTS_QUERY_KEY: "lots", listLots: jest.fn(), updateLot: jest.fn(), assignLot: jest.fn() }));
jest.mock("@/hooks/useExpiryAlertDays", () => ({ useExpiryAlertDays: () => 30 }));
jest.mock("@/hooks/useMyWarehouses");
jest.mock("@/hooks/useCompanyWarehouses", () => ({
  useCompanyWarehouses: () => ({
    warehouses: [
      { id: "inv-1", name: "Breña", status: true },
      { id: "inv-2", name: "Arequipa", status: true },
    ],
    nameOf: () => "Almacén",
  }),
}));

const lot = (lotId: string, number: string, expiresAt: string, days: number, status: "vigente" | "vencido" | "bloqueado", quantity: number, inventoryId: string | null = "inv-1") => ({
  lotId,
  number,
  kind: "normal",
  variantId: "v1",
  expiresAt,
  daysToExpiry: days,
  status,
  storedStatus: status === "bloqueado" ? "bloqueado" : "vigente",
  comment: lotId === "l1" ? "Compra OC-0029" : null,
  inventoryId,
  inventoryName: inventoryId === "inv-1" ? "Breña" : null,
  quantity,
});

const LIST: LotList = {
  today: "2026-11-18",
  items: [
    lot("l2", "L2402", "2026-11-25", 7, "vigente", 12),
    lot("l1", "L2408", "2027-08-30", 285, "vigente", 30),
    lot("l3", "A117", "2026-10-31", -18, "vencido", 3),
    lot("l4", "B500", "2027-02-01", 75, "bloqueado", 5),
    lot("l5", "Z999", "2027-05-01", 164, "vigente", 0, null),
  ],
  unlotted: [{ variantId: "v1", inventoryId: "inv-1", inventoryName: "Breña", quantity: 4 }],
  truncated: false,
};

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FichaLotsTab variants={[{ id: "v1", label: "50 ml (CRE-50)" }]} showVariant={false} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  role = "ADMINISTRADOR";
  jest.mocked(listLots).mockResolvedValue(LIST);
  jest.mocked(updateLot).mockResolvedValue({} as never);
  jest.mocked(assignLot).mockResolvedValue({ lot: { number: "L2410" } as never, movementId: "m1", duplicate: false });
});

describe("Lotes en la ficha (FEAT-24 H5-L)", () => {
  it("muestra los lotes con su estado y lo «sin lote» de cada almacén", async () => {
    setup();
    const vigente = await screen.findByTestId("lote-l1-inv-1");
    expect(listLots).toHaveBeenCalledWith({ variantId: "v1", includeEmpty: true }, expect.anything());
    expect(vigente).toHaveTextContent("L2408");
    expect(vigente).toHaveTextContent("30/08/2027");
    expect(vigente).toHaveTextContent("Breña");
    expect(vigente).toHaveTextContent("Compra OC-0029");
    expect(vigente).toHaveTextContent("Vigente");
    expect(screen.getByTestId("lote-l2-inv-1")).toHaveTextContent("Por vencer · 7 días");
    expect(screen.getByTestId("lote-l3-inv-1")).toHaveTextContent("Vencido");
    expect(screen.getByTestId("lote-l4-inv-1")).toHaveTextContent("Bloqueado");
    expect(screen.getByTestId("lote-l5-sin-stock")).toHaveTextContent("Sin stock");
    const loose = screen.getByTestId("sin-lote-v1-inv-1");
    expect(loose).toHaveTextContent("Sin lote");
    expect(loose).toHaveTextContent("4");
  });

  it("bloquea un lote vigente y desbloquea uno bloqueado", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(within(await screen.findByTestId("lote-l1-inv-1")).getByRole("button", { name: "Bloquear" }));
    await waitFor(() => expect(updateLot).toHaveBeenCalledWith("l1", { status: "bloqueado" }));
    await user.click(within(screen.getByTestId("lote-l4-inv-1")).getByRole("button", { name: "Desbloquear" }));
    await waitFor(() => expect(updateLot).toHaveBeenCalledWith("l4", { status: "vigente" }));
  });

  it("registra un lote para el stock sin lote, sin pasar lo que hay", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(within(await screen.findByTestId("sin-lote-v1-inv-1")).getByRole("button", { name: "Registrar lote" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Almacén")).toHaveValue("inv-1");
    expect(dialog).toHaveTextContent("Sin lote en este almacén: 4 unidades.");
    await user.type(within(dialog).getByLabelText("Número de lote"), "L2410");
    fireEvent.change(within(dialog).getByLabelText("Fecha de vencimiento"), { target: { value: "2027-10-31" } });
    await user.type(within(dialog).getByLabelText("Unidades"), "5");
    await user.click(within(dialog).getByRole("button", { name: "Guardar lote" }));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Solo hay 4 unidades sin lote en ese almacén.");
    expect(assignLot).not.toHaveBeenCalled();
    await user.clear(within(dialog).getByLabelText("Unidades"));
    await user.type(within(dialog).getByLabelText("Unidades"), "3");
    await user.click(within(dialog).getByRole("button", { name: "Guardar lote" }));
    await waitFor(() => expect(assignLot).toHaveBeenCalledTimes(1));
    expect(jest.mocked(assignLot).mock.calls[0][0]).toEqual({
      inventoryId: "inv-1",
      variantId: "v1",
      quantity: 3,
      lotNumber: "L2410",
      expiresAt: "2027-10-31",
      operationId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it("registrar en un lote que ya existe manda su lotId", async () => {
    const user = userEvent.setup();
    setup();
    await user.click((await screen.findAllByRole("button", { name: "Registrar lote" }))[0]);
    const dialog = await screen.findByRole("dialog");
    await user.selectOptions(within(dialog).getByLabelText("Almacén"), "inv-1");
    await user.click(within(dialog).getByRole("radio", { name: "Lote que ya existe" }));
    await user.selectOptions(within(dialog).getByLabelText("Lote"), "l1");
    await user.type(within(dialog).getByLabelText("Unidades"), "2");
    await user.click(within(dialog).getByRole("button", { name: "Guardar lote" }));
    await waitFor(() => expect(assignLot).toHaveBeenCalledWith(expect.objectContaining({ lotId: "l1", quantity: 2, inventoryId: "inv-1" })));
    expect(jest.mocked(assignLot).mock.calls[0][0]).not.toHaveProperty("lotNumber");
  });

  it("edita un lote: manda solo lo que cambió y muestra el 409", async () => {
    const user = userEvent.setup();
    jest.mocked(updateLot).mockRejectedValueOnce({ response: { status: 409, data: { message: "Ya hay un lote L2402 en esta variante." } } });
    setup();
    await user.click(within(await screen.findByTestId("lote-l1-inv-1")).getByRole("button", { name: "Editar lote L2408" }));
    const dialog = await screen.findByRole("dialog");
    await user.clear(within(dialog).getByLabelText("Número de lote"));
    await user.type(within(dialog).getByLabelText("Número de lote"), "L2402");
    await user.click(within(dialog).getByRole("button", { name: "Guardar lote" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Ya hay un lote L2402 en esta variante.");
    expect(updateLot).toHaveBeenCalledWith("l1", { number: "L2402" });
  });

  it("Almacén registra lotes pero no edita ni bloquea", async () => {
    role = "ALMACEN";
    setup();
    await screen.findByTestId("lote-l1-inv-1");
    expect(screen.getAllByRole("button", { name: "Registrar lote" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Bloquear" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar lote/ })).not.toBeInTheDocument();
  });

  it("Ventas solo ve los lotes", async () => {
    role = "VENTAS";
    setup();
    await screen.findByTestId("lote-l1-inv-1");
    expect(screen.queryByRole("button", { name: "Registrar lote" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Bloquear" })).not.toBeInTheDocument();
  });
});
