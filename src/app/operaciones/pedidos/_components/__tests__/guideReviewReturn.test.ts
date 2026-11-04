/**
 * Tests: guideReviewReturn — ida y vuelta Preparados ↔ /registrar-venta.
 *
 * - `returnTo` solo lleva IDs; `updated` lo agrega /registrar-venta únicamente tras guardar con éxito.
 * - Al volver, la selección se pide al servidor (la página visible ya no tiene todos los pedidos): los que ya
 *   no están en Preparados se descartan avisando, y el retorno se procesa UNA sola vez aunque haya re-renders
 *   o refetches mientras la URL todavía no se limpió.
 * - Sin `updated` ("Volver" sin guardar) no se anuncia nada.
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import type { Sale } from "../types";

const mockReplace = jest.fn();
let mockParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useSearchParams: () => mockParams,
}));

jest.mock("sonner", () => ({ toast: { info: jest.fn(), error: jest.fn() } }));

import { toast } from "sonner";
import {
  PEDIDOS_PREPARADOS_PATH,
  buildGuideReviewReturnTo,
  parseGuideReviewReturn,
  useGuideReviewReturn,
} from "../guideReviewReturn";

const sale = (id: string) => ({ id }) as Sale;
/** El servidor solo devuelve los pedidos que siguen en Preparados. */
const serverHas = (...present: string[]) => jest.fn(async (ids: string[]) => ids.filter((id) => present.includes(id)).map(sale));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = new URLSearchParams();
});

describe("buildGuideReviewReturnTo / parseGuideReviewReturn", () => {
  it("ida y vuelta con la selección; sin `updated` no hay pedido guardado", () => {
    const url = buildGuideReviewReturnTo(["a", "b"]);
    expect(url).toContain("tab=preparados");
    expect(parseGuideReviewReturn(new URL(url, "http://x").searchParams)).toEqual({ selectedIds: ["a", "b"], updatedId: null });
  });

  it("ya no lleva el día de la antigua pestaña por día", () => {
    expect(buildGuideReviewReturnTo(["a"])).not.toContain("day=");
  });

  it("sin parámetros de retorno devuelve null", () => {
    expect(parseGuideReviewReturn(new URLSearchParams("tab=preparados"))).toBeNull();
  });

  it("agrega el pedido guardado a la selección aunque no viniera en `sel`", () => {
    expect(parseGuideReviewReturn(new URLSearchParams("sel=a&updated=z"))).toEqual({ selectedIds: ["a", "z"], updatedId: "z" });
  });
});

describe("useGuideReviewReturn", () => {
  it("no hace nada hasta que el alcance de tiendas está resuelto", () => {
    mockParams = new URLSearchParams("tab=preparados&sel=a&updated=a");
    const load = serverHas("a");
    const { result } = renderHook(() => useGuideReviewReturn(false, load));
    expect(result.current.pending).toBeNull();
    expect(load).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("tras guardar: pide la selección al servidor, limpia la URL y se procesa una sola vez", async () => {
    mockParams = new URLSearchParams("tab=preparados&sel=a,b,gone&updated=a");
    const load = serverHas("a", "b");
    const { result, rerender } = renderHook(({ fn }) => useGuideReviewReturn(true, fn), { initialProps: { fn: load } });

    await waitFor(() => expect(result.current.pending).not.toBeNull());
    expect(load).toHaveBeenCalledWith(["a", "b", "gone"]);
    expect(result.current.pending?.updatedId).toBe("a");
    expect(result.current.pending?.sales.map((s) => s.id)).toEqual(["a", "b"]);
    expect(mockReplace).toHaveBeenCalledWith(PEDIDOS_PREPARADOS_PATH, { scroll: false });
    expect(toast.info).toHaveBeenCalledWith("1 pedido(s) de la selección ya no figuran en Preparados.");

    // Consumido por la pestaña.
    act(() => result.current.clear());
    expect(result.current.pending).toBeNull();

    // Re-render con otra función de carga y la URL todavía sin limpiar: no se reabre ni se vuelve a pedir.
    rerender({ fn: serverHas("a", "b") });
    rerender({ fn: serverHas("a", "b") });
    expect(result.current.pending).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it("'Volver' sin guardar: restaura la selección sin pedido guardado ni avisos", async () => {
    mockParams = new URLSearchParams("tab=preparados&sel=a,b");
    const { result } = renderHook(() => useGuideReviewReturn(true, serverHas("a", "b")));

    await waitFor(() => expect(result.current.pending).not.toBeNull());
    expect(result.current.pending?.updatedId).toBeNull();
    expect(result.current.pending?.sales.map((s) => s.id)).toEqual(["a", "b"]);
    expect(toast.info).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it("si el pedido guardado ya no está en Preparados, avisa y no lo reabre", async () => {
    mockParams = new URLSearchParams("tab=preparados&sel=a,b&updated=a");
    const { result } = renderHook(() => useGuideReviewReturn(true, serverHas("b")));

    await waitFor(() => expect(result.current.pending).not.toBeNull());
    expect(result.current.pending?.updatedId).toBeNull();
    expect(result.current.pending?.sales.map((s) => s.id)).toEqual(["b"]);
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledWith("El pedido se actualizó, pero ya no figura en Preparados.");
  });

  it("si el servidor falla avisa, no deja la selección a medias y limpia la URL", async () => {
    mockParams = new URLSearchParams("tab=preparados&sel=a,b");
    const { result } = renderHook(() => useGuideReviewReturn(true, jest.fn().mockRejectedValue(new Error("boom"))));

    await waitFor(() => expect(result.current.pending).not.toBeNull());
    expect(toast.error).toHaveBeenCalledWith("No se pudo restaurar la selección de pedidos.");
    expect(result.current.pending?.sales).toEqual([]);
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });
});
