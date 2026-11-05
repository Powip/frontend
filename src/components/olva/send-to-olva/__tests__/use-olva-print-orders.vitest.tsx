import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useOlvaPrintOrders } from "../hooks/use-olva-print-orders";
import {
  buildGuide,
  buildOrderDetail,
  COMPANY_ID,
  GUIDE_ID,
} from "../test-utils/send-to-olva.fixtures";

const { axiosGet, printShippingGuide, printOrderLabelsBatch, auth } = vi.hoisted(() => ({
  axiosGet: vi.fn(),
  printShippingGuide: vi.fn(),
  printOrderLabelsBatch: vi.fn(),
  auth: {
    current: {
      accessToken: "token",
      user: { id: "user-1" },
      company: { id: "company-1", name: "Mi Empresa" },
    } as Record<string, unknown> | null,
  },
}));

vi.mock("axios", () => ({ default: { get: axiosGet } }));
// saleTrackingService pulls the authenticated client in; this suite never uses it
vi.mock("@/lib/axiosAuth", () => ({ default: {} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: auth.current }) }));
vi.mock("@/utils/printShippingGuide", () => ({ printShippingGuide }));
vi.mock("@/utils/printOrderLabel", () => ({ printOrderLabelsBatch }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

const order = buildOrderDetail();

function renderPrint(overrides: Partial<Parameters<typeof useOlvaPrintOrders>[0]> = {}) {
  return renderHook(() =>
    useOlvaPrintOrders({
      open: true,
      companyId: COMPANY_ID,
      guideId: GUIDE_ID,
      guide: buildGuide(),
      orders: [order],
      ...overrides,
    }),
  );
}

describe("useOlvaPrintOrders", () => {
  beforeEach(() => {
    auth.current = {
      accessToken: "token",
      user: { id: "user-1" },
      company: { id: COMPANY_ID, name: "Mi Empresa" },
    };
    axiosGet.mockResolvedValue({
      data: { orderId: order.id, companyId: COMPANY_ID, status: "CONFIRMED", items: [] },
    });
    printShippingGuide.mockResolvedValue(undefined);
    printOrderLabelsBatch.mockResolvedValue(undefined);
  });

  it("prints the departure guide for the orders that went out", async () => {
    const { result } = renderPrint();

    await act(() => result.current.printGuide([order]));

    expect(printShippingGuide).toHaveBeenCalledWith(
      expect.objectContaining({ id: GUIDE_ID }),
      [order],
      expect.objectContaining({ id: COMPANY_ID }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.isPrinting).toBe(false);
  });

  it("prints the dispatch labels from each order's receipt", async () => {
    const { result } = renderPrint();

    await act(() => result.current.printLabels([order]));

    expect(axiosGet).toHaveBeenCalledWith(
      expect.stringContaining(`/order-header/${order.id}/receipt`),
      expect.objectContaining({ headers: { Authorization: "Bearer token" } }),
    );
    expect(printOrderLabelsBatch).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("1 etiqueta(s) enviadas a imprimir");
  });

  it("does not print a receipt that belongs to another order", async () => {
    axiosGet.mockResolvedValue({
      data: { orderId: "someone-else", status: "CONFIRMED", items: [] },
    });

    const { result } = renderPrint();

    await act(() => result.current.printLabels([order]));

    expect(printOrderLabelsBatch).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "No se pudieron cargar los datos de los pedidos para imprimir",
    );
  });

  it("does not print when the signed-in company is not the one that opened the modal", async () => {
    auth.current = { ...auth.current, company: { id: "another-company" } };

    const { result } = renderPrint();

    await act(() => result.current.printGuide([order]));

    expect(printShippingGuide).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "La sesión o empresa cambió. Vuelve a abrir los pedidos para imprimir.",
    );
  });

  it("needs the guide to print the departure guide", async () => {
    const { result } = renderPrint({ guide: null });

    await act(() => result.current.printGuide([order]));

    expect(printShippingGuide).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "No se pudo cargar la información de la guía para imprimir",
    );
  });

  it("warns when there is nothing to print", async () => {
    const { result } = renderPrint();

    await act(() => result.current.printLabels([]));

    expect(toast.warning).toHaveBeenCalledWith("No hay pedidos exitosos para imprimir");
    expect(axiosGet).not.toHaveBeenCalled();
  });
});
