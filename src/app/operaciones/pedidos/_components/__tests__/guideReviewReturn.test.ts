/**
 * Tests: guideReviewReturn — ida y vuelta Por Despachar ↔ /registrar-venta.
 *
 * - `returnTo` solo lleva IDs y día; `updated` lo agrega /registrar-venta
 *   únicamente tras guardar con éxito.
 * - Al volver, la selección se resuelve contra los pedidos recargados (los
 *   que ya no están se descartan avisando), y el retorno se procesa UNA sola
 *   vez aunque haya re-renders o refetches mientras la URL todavía no se
 *   limpió.
 * - Sin `updated` ("Volver" sin guardar) no se anuncia nada.
 */

import { renderHook, act } from "@testing-library/react";
import type { Sale } from "../types";

const mockReplace = jest.fn();
let mockParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
  useSearchParams: () => mockParams,
}));

jest.mock("sonner", () => ({ toast: { info: jest.fn() } }));

import { toast } from "sonner";
import {
  PEDIDOS_DESPACHAR_PATH,
  buildGuideReviewReturnTo,
  parseGuideReviewReturn,
  useGuideReviewReturn,
} from "../guideReviewReturn";

const sale = (id: string) => ({ id }) as Sale;

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = new URLSearchParams();
});

describe("buildGuideReviewReturnTo / parseGuideReviewReturn", () => {
  it("ida y vuelta con selección y día; sin `updated` no hay pedido guardado", () => {
    const url = buildGuideReviewReturnTo(["a", "b"], "2026-10-05");
    const parsed = parseGuideReviewReturn(new URL(url, "http://x").searchParams);
    expect(parsed).toEqual({
      selectedIds: ["a", "b"],
      updatedId: null,
      dayKey: "2026-10-05",
    });
  });

  it("sin parámetros de retorno devuelve null", () => {
    expect(parseGuideReviewReturn(new URLSearchParams("tab=despachar"))).toBeNull();
  });

  it("descarta un `day` mal formado", () => {
    expect(
      parseGuideReviewReturn(new URLSearchParams("sel=a&day=<script>"))?.dayKey,
    ).toBeNull();
  });
});

describe("useGuideReviewReturn", () => {
  it("no hace nada hasta que los pedidos están cargados", () => {
    mockParams = new URLSearchParams("tab=despachar&sel=a&updated=a");
    const { result } = renderHook(() => useGuideReviewReturn(false, []));
    expect(result.current.pending).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("tras guardar: resuelve la selección contra los datos recargados, limpia la URL y se procesa una sola vez", () => {
    mockParams = new URLSearchParams("tab=despachar&sel=a,b,gone&updated=a&day=2026-10-05");
    const { result, rerender } = renderHook(
      ({ sales }: { sales: Sale[] }) => useGuideReviewReturn(true, sales),
      { initialProps: { sales: [sale("a"), sale("b")] } },
    );

    expect(result.current.pending).toEqual({
      selectedIds: ["a", "b"],
      updatedId: "a",
      dayKey: "2026-10-05",
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(PEDIDOS_DESPACHAR_PATH, { scroll: false });
    expect(toast.info).toHaveBeenCalledWith(
      "1 pedido(s) de la selección ya no figuran en Por Despachar.",
    );

    // Consumido por la pestaña.
    act(() => result.current.clear());
    expect(result.current.pending).toBeNull();

    // Refetch / re-render con la URL todavía sin limpiar: no se reabre.
    rerender({ sales: [sale("a"), sale("b")] });
    rerender({ sales: [sale("a"), sale("b"), sale("c")] });
    expect(result.current.pending).toBeNull();
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it("'Volver' sin guardar: restaura la selección sin pedido guardado ni avisos", () => {
    mockParams = new URLSearchParams("tab=despachar&sel=a,b");
    const { result } = renderHook(() =>
      useGuideReviewReturn(true, [sale("a"), sale("b")]),
    );
    expect(result.current.pending).toEqual({
      selectedIds: ["a", "b"],
      updatedId: null,
      dayKey: null,
    });
    expect(toast.info).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it("si el pedido guardado ya no está en Por Despachar, avisa y no lo reabre", () => {
    mockParams = new URLSearchParams("tab=despachar&sel=a,b&updated=a");
    const { result } = renderHook(() => useGuideReviewReturn(true, [sale("b")]));
    expect(result.current.pending).toEqual({
      selectedIds: ["b"],
      updatedId: null,
      dayKey: null,
    });
    expect(toast.info).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledWith(
      "El pedido se actualizó, pero ya no figura en Por Despachar.",
    );
  });
});
