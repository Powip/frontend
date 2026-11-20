import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WarehouseQueueProvider, useWarehouseQueue } from "../WarehouseQueueContext";
import { registerWarehouseServiceWorker, WAREHOUSE_SCOPE, WAREHOUSE_SW_URL } from "../WarehouseShell";
import { WAREHOUSE_ACTION } from "@/lib/warehouseMode";
import { completePicking } from "@/services/orderStockService";

// FEAT-24 H6-D (H6-D4) — la cola en las pantallas: sin señal guarda (en jsdom
// no hay IndexedDB: usa la copia en memoria), al volver la señal envía sola y
// «Para revisar» junta los rechazos. Además, el service worker solo se
// registra en producción y solo para /almacen.

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { user: { id: "u-1", companyId: "c-1" }, company: { id: "c-1" } } }),
}));
jest.mock("@/services/orderStockService", () => ({
  getPicking: jest.fn(),
  scanPicking: jest.fn(),
  confirmPickingLine: jest.fn(),
  completePicking: jest.fn(),
}));
jest.mock("@/services/warehousesService", () => ({ listReturnReceptions: jest.fn(), receiveReturnReception: jest.fn() }));

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => value });
}

function Probe() {
  const { ready, outbox, review, enqueue, persistent } = useWarehouseQueue();
  return (
    <div>
      <p>{ready ? "listo" : "preparando"}</p>
      <p>por enviar: {outbox.length}</p>
      <p>para revisar: {review.length}</p>
      <p>{persistent ? "persistente" : "en memoria"}</p>
      <button type="button" onClick={() => void enqueue(WAREHOUSE_ACTION.pickingComplete, { orderId: "o-1", orderNumber: "ORD-1" })}>
        completar
      </button>
    </div>
  );
}

afterEach(() => setOnline(true));

describe("WarehouseQueueProvider (FEAT-24 H6-D)", () => {
  it("sin señal guarda la acción y la envía sola al volver la conexión", async () => {
    setOnline(false);
    jest.mocked(completePicking).mockResolvedValue({} as never);
    render(
      <WarehouseQueueProvider>
        <Probe />
      </WarehouseQueueProvider>,
    );
    expect(await screen.findByText("listo")).toBeInTheDocument();
    expect(screen.getByText("en memoria")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "completar" }));
    expect(await screen.findByText("por enviar: 1")).toBeInTheDocument();
    expect(completePicking).not.toHaveBeenCalled();

    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(completePicking).toHaveBeenCalledWith("o-1", expect.objectContaining({ timeoutMs: 15_000 })));
    expect(await screen.findByText("por enviar: 0")).toBeInTheDocument();
  });

  it("un rechazo al sincronizar queda en «Para revisar»", async () => {
    setOnline(false);
    jest.mocked(completePicking).mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { message: "Ya despachado." } } });
    render(
      <WarehouseQueueProvider>
        <Probe />
      </WarehouseQueueProvider>,
    );
    await screen.findByText("listo");
    await userEvent.click(screen.getByRole("button", { name: "completar" }));
    await screen.findByText("por enviar: 1");
    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(await screen.findByText("para revisar: 1")).toBeInTheDocument();
    expect(screen.getByText("por enviar: 0")).toBeInTheDocument();
  });
});

describe("registerWarehouseServiceWorker", () => {
  const env = process.env as Record<string, string | undefined>;
  const original = env.NODE_ENV;
  afterEach(() => {
    env.NODE_ENV = original;
  });

  it("en producción registra /almacen-sw.js solo para /almacen", () => {
    env.NODE_ENV = "production";
    const register = jest.fn().mockResolvedValue(undefined);
    registerWarehouseServiceWorker({ serviceWorker: { register } } as unknown as Navigator);
    expect(register).toHaveBeenCalledWith(WAREHOUSE_SW_URL, { scope: WAREHOUSE_SCOPE });
    expect(WAREHOUSE_SW_URL).toBe("/almacen-sw.js");
    expect(WAREHOUSE_SCOPE).toBe("/almacen");
  });

  it("en desarrollo o sin soporte no registra nada", () => {
    env.NODE_ENV = "development";
    const register = jest.fn();
    registerWarehouseServiceWorker({ serviceWorker: { register } } as unknown as Navigator);
    expect(register).not.toHaveBeenCalled();
    env.NODE_ENV = "production";
    expect(() => registerWarehouseServiceWorker({} as Navigator)).not.toThrow();
  });
});
