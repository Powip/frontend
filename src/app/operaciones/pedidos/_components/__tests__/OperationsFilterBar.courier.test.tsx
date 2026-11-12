/**
 * Desplegable «Todos los couriers» de /operaciones/pedidos: el campo courier de los pedidos es
 * texto libre, así que un mismo courier llega con varias grafías (Olva Courier, OLVA, OLVA_COURIER…).
 * Debe mostrarse una sola opción por courier y filtrar por ella.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { applyFilters, emptySalesFilters } from "@/components/ventas/SalesTableFilters";
import { OperationsFilterBar } from "../OperationsFilterBar";
import { emptyTabState, type OperationsTabData, type TabQueryState } from "../tabState";
import type { PedidosActions } from "../types";

jest.mock("@/components/ui/calendar", () => ({ Calendar: () => null }));
jest.mock("next/image", () => ({ __esModule: true, default: () => null }));

const OLVA = ["Olva Courier", "OLVA", "OLVA_COURIER", "OLVA COURIER", "Olva ", "Olva"];

function renderBar(opts: { couriers: string[]; apiCouriers?: string[]; state?: TabQueryState }) {
  const onState = jest.fn();
  const actions = { can: () => true, apiCouriers: opts.apiCouriers ?? [], salesChannels: [], isBulkLoading: false } as unknown as PedidosActions;
  const data = { sales: [], total: 0, totalPages: 1, loading: false, fetching: false, metadata: { couriers: opts.couriers, channels: [], products: [] } } as OperationsTabData;
  render(<OperationsFilterBar state={opts.state ?? emptyTabState()} onState={onState} actions={actions} data={data} statusOptions={[]} showCourierDropdown />);
  return { onState, select: screen.getByLabelText("Courier") as HTMLSelectElement };
}

const labels = (select: HTMLSelectElement) => Array.from(select.options).map((o) => o.textContent);

describe("OperationsFilterBar — desplegable de courier", () => {
  it("muestra una sola opción por courier aunque los pedidos lo tengan guardado de varias formas", () => {
    const { select } = renderBar({ couriers: [...OLVA, "SHALOM", "Shalom", "Indriver 1", "Indriver 2"] });
    expect(labels(select)).toEqual(["Todos los couriers", "Indriver 1", "Indriver 2", "Olva", "Shalom"]);
  });

  it("prefiere el nombre del courier configurado en la empresa", () => {
    const { select } = renderBar({ couriers: OLVA, apiCouriers: ["Olva Courier"] });
    expect(labels(select)).toEqual(["Todos los couriers", "Olva Courier"]);
  });

  it("al elegir un courier pide ese nombre al servidor", () => {
    const { select, onState } = renderBar({ couriers: OLVA, apiCouriers: ["Olva Courier"] });
    fireEvent.change(select, { target: { value: "Olva Courier" } });
    expect(onState).toHaveBeenCalledWith({ filters: expect.objectContaining({ courier: "Olva Courier" }) });
  });

  it("mantiene seleccionada la opción equivalente si el valor guardado tiene otra grafía", () => {
    const state = { ...emptyTabState(), filters: { ...emptySalesFilters, courier: "OLVA" } };
    const { select } = renderBar({ couriers: ["Olva Courier", "Shalom"], state });
    expect(select.value).toBe("Olva Courier");
  });
});

describe("applyFilters — courier", () => {
  const sale = (courier: string | null) => ({ courier }) as never;

  it("compara por courier y no por la grafía exacta", () => {
    const filters = { ...emptySalesFilters, courier: "Olva Courier" };
    const kept = ([...OLVA.map(sale), sale("Shalom"), sale(null)] as never[]).filter((item) => applyFilters([item], filters).length > 0);
    expect(kept).toHaveLength(OLVA.length);
  });
});
