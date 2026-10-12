import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  AdvertisingStoreAssignments,
  advertisingAssignmentSpendPeriod,
} from "../AdvertisingStoreAssignmentsPanel";
import { assignmentsV11 } from "./advertising-v11-fixtures";

beforeAll(() => {
  HTMLElement.prototype.hasPointerCapture = () => false;
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
  HTMLElement.prototype.scrollIntoView = () => {};
});
function callbacks() {
  return {
    onAccountChange: jest.fn(async () => true),
    onAdsetChange: jest.fn(async () => true),
    onSuggestions: jest.fn(async () => true),
  };
}
it("los 30 días usan Lima y no el periodo del resumen", () => {
  expect(advertisingAssignmentSpendPeriod(new Date("2026-10-13T01:00:00Z"))).toEqual({
    from: "2026-09-13",
    to: "2026-10-12",
  });
});
it("no aplica sugerencias sin revisión y conserva la versión revisada", async () => {
  const user = userEvent.setup(),
    cb = callbacks(),
    data = assignmentsV11();
  const view = render(<AdvertisingStoreAssignments workspace={data} busy={false} {...cb} />);
  expect(cb.onSuggestions).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Revisar 1 sugerencia" }));
  const save = screen.getByRole("button", { name: "Confirmar y guardar" });
  expect(save).toBeDisabled();
  await user.type(screen.getByLabelText("Motivo del cambio"), "Destino confirmado");
  expect(save).toBeDisabled();
  await user.click(screen.getByRole("checkbox", { name: "Aplicar Conjunto Centro a Centro" }));
  const newer = assignmentsV11();
  newer.accounts[0].adsets[0].version = 4;
  newer.accounts[0].adsets[0].suggestion = { storeId: "store-b", reason: "name-match" };
  view.rerender(<AdvertisingStoreAssignments workspace={newer} busy={false} {...cb} />);
  await user.click(save);
  expect(cb.onSuggestions).toHaveBeenCalledWith({
    apply: "all_history",
    reason: "Destino confirmado",
    selections: [
      { accountId: "account-a", adsetId: "456", storeId: "store-a", expectedVersion: 3 },
    ],
  });
});
it("respeta capability de consulta y no ofrece aplicar sugerencias", () => {
  const data = assignmentsV11();
  data.capabilities.canConfigure = false;
  render(<AdvertisingStoreAssignments workspace={data} busy={false} {...callbacks()} />);
  expect(screen.queryByRole("button", { name: /Revisar 1 sugerencia/ })).not.toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Tienda de Cuenta Meta" })).toBeDisabled();
  expect(screen.getByRole("combobox", { name: "Tienda de Conjunto Centro" })).toBeDisabled();
});
it("usa desde hoy sólo si se elige explícitamente y explica el histórico", async () => {
  const user = userEvent.setup();
  render(
    <AdvertisingStoreAssignments workspace={assignmentsV11()} busy={false} {...callbacks()} />,
  );
  await user.click(screen.getByRole("button", { name: "Revisar 1 sugerencia" }));
  expect(
    screen.getByText(
      "Reasigna el gasto importado del historial. No cambia la tienda de las ventas.",
    ),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("combobox", { name: "Aplicar el cambio" }));
  await user.click(screen.getByRole("option", { name: "Desde hoy" }));
  expect(screen.getByText(/El gasto anterior conserva su asignación/)).toBeInTheDocument();
});
