import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { isDispatchStatus, usePendingAdvanceGuard } from "../PendingAdvanceDialog";
import type { AdvanceRow } from "@/utils/guideOrderBalance";

const makeRows = (count: number): AdvanceRow[] =>
  Array.from({ length: count }, (_, i) => ({ id: `o${i + 1}`, orderNumber: `ORD-${i + 1}`, awaitingApproval: 20, pending: 179 }));

function Harness({ rows, run, onSettled, dismissRef }: {
  rows: AdvanceRow[];
  run: () => void | Promise<void>;
  onSettled?: () => void;
  dismissRef?: { current: (() => void) | null };
}) {
  const { guard, dialog, dismiss } = usePendingAdvanceGuard();
  if (dismissRef) dismissRef.current = dismiss;
  return (
    <>
      <button onClick={() => { void guard({ rows, action: "Si envías ahora", confirmLabel: "Enviar igual" }, run).then(onSettled); }}>
        iniciar
      </button>
      {dialog}
    </>
  );
}

describe("usePendingAdvanceGuard", () => {
  it("sin adelantos pendientes ejecuta la acción de inmediato y no muestra ningún diálogo", async () => {
    const run = jest.fn();
    const user = userEvent.setup();
    render(<Harness rows={[]} run={run} />);

    await user.click(screen.getByRole("button", { name: "iniciar" }));

    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("con adelantos pendientes avisa qué pedidos son y NO ejecuta la acción hasta que se confirme", async () => {
    const run = jest.fn();
    const user = userEvent.setup();
    render(<Harness rows={makeRows(2)} run={run} />);

    await user.click(screen.getByRole("button", { name: "iniciar" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Hay adelantos sin aprobar");
    expect(dialog).toHaveTextContent("2 pedidos tienen un adelanto sin aprobar");
    expect(dialog).toHaveTextContent("(S/ 40.00)");
    expect(dialog).toHaveTextContent("Si envías ahora, el courier cobrará el total de cada pedido, no el saldo");
    expect(dialog).toHaveTextContent("ORD-1");
    expect(dialog).toHaveTextContent("adelanto S/ 20.00");
    expect(dialog).toHaveTextContent("cobrará S/ 179.00");
    expect(run).not.toHaveBeenCalled();
  });

  it("usa singular y 'del pedido' cuando es un solo pedido", async () => {
    const user = userEvent.setup();
    render(<Harness rows={makeRows(1)} run={jest.fn()} />);

    await user.click(screen.getByRole("button", { name: "iniciar" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("1 pedido tiene un adelanto sin aprobar");
    expect(dialog).toHaveTextContent("el total del pedido, no el saldo");
  });

  it("muestra hasta 8 pedidos y resume el resto", async () => {
    const user = userEvent.setup();
    render(<Harness rows={makeRows(10)} run={jest.fn()} />);

    await user.click(screen.getByRole("button", { name: "iniciar" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("ORD-8");
    expect(dialog).not.toHaveTextContent("ORD-9");
    expect(dialog).toHaveTextContent("y 2 más");
  });

  it("confirmar ejecuta la acción una sola vez y cierra el diálogo", async () => {
    const run = jest.fn();
    const user = userEvent.setup();
    render(<Harness rows={makeRows(1)} run={run} />);
    await user.click(screen.getByRole("button", { name: "iniciar" }));

    await user.click(await screen.findByRole("button", { name: "Enviar igual" }));

    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("cancelar no ejecuta la acción y cierra el diálogo", async () => {
    const run = jest.fn();
    const user = userEvent.setup();
    render(<Harness rows={makeRows(1)} run={run} />);
    await user.click(screen.getByRole("button", { name: "iniciar" }));

    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(run).not.toHaveBeenCalled();
  });

  it("la promesa de guard se resuelve recién cuando termina la acción confirmada (quien hace await espera)", async () => {
    let finishRun!: () => void;
    const run = jest.fn(() => new Promise<void>((resolve) => { finishRun = resolve; }));
    const settled = jest.fn();
    const user = userEvent.setup();
    render(<Harness rows={makeRows(1)} run={run} onSettled={settled} />);
    await user.click(screen.getByRole("button", { name: "iniciar" }));

    await user.click(await screen.findByRole("button", { name: "Enviar igual" }));
    await waitFor(() => expect(run).toHaveBeenCalled());
    await act(async () => { await Promise.resolve(); });
    expect(settled).not.toHaveBeenCalled();

    await act(async () => { finishRun(); });
    await waitFor(() => expect(settled).toHaveBeenCalledTimes(1));
  });

  it("la promesa también se resuelve al cancelar, sin ejecutar la acción", async () => {
    const run = jest.fn();
    const settled = jest.fn();
    const user = userEvent.setup();
    render(<Harness rows={makeRows(1)} run={run} onSettled={settled} />);
    await user.click(screen.getByRole("button", { name: "iniciar" }));

    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(settled).toHaveBeenCalledTimes(1));
    expect(run).not.toHaveBeenCalled();
  });

  it("dismiss() cierra el aviso abierto sin ejecutar la acción y libera a quien espera", async () => {
    const run = jest.fn();
    const settled = jest.fn();
    const dismissRef = { current: null as (() => void) | null };
    const user = userEvent.setup();
    render(<Harness rows={makeRows(1)} run={run} onSettled={settled} dismissRef={dismissRef} />);
    await user.click(screen.getByRole("button", { name: "iniciar" }));
    await screen.findByRole("alertdialog");

    act(() => dismissRef.current?.());

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(settled).toHaveBeenCalledTimes(1);
    expect(run).not.toHaveBeenCalled();
  });
});

describe("isDispatchStatus", () => {
  it.each(["ASIGNADO_A_GUIA", "EN_ENVIO"])("%s entrega el pedido al courier: lleva aviso", (status) => {
    expect(isDispatchStatus(status)).toBe(true);
  });

  it.each(["PENDIENTE", "PREPARADO", "LLAMADO", "DESPACHADO", "ENTREGADO", "ANULADO"])("%s no lleva aviso", (status) => {
    expect(isDispatchStatus(status)).toBe(false);
  });
});
