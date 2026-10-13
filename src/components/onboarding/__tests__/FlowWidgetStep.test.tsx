import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { toast } from "sonner";
import FlowWidgetStep from "../FlowWidgetStep";

jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));
const originalRuntime = process.env.NEXT_PUBLIC_RUNTIME_ENV;
const scriptSelector = 'script[src*="/app/elements/flow-1.1.0.min.js"]';
function deferred() {
  let resolve!: () => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function sdk(promise = new Promise<void>(() => {})) {
  const mount = jest.fn((selector: string) => {
    document.querySelector(selector)?.appendChild(document.createElement("iframe"));
  });
  const subscribe = { mount };
  const handle = jest.fn().mockReturnValue(promise);
  const create = jest.fn().mockReturnValue(subscribe);
  const flow = jest.fn(() => ({ elements: () => ({ create }), handleCardSubscribed: handle }));
  return { flow, mount, create, handle };
}
function callbacks() {
  return { onSuccess: jest.fn().mockResolvedValue(undefined), onError: jest.fn() };
}
function script() {
  const element = document.querySelector<HTMLScriptElement>(scriptSelector);
  if (!element) throw new Error("Debe existir el script de Flow.");
  return element;
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  delete window.Flow;
  delete process.env.NEXT_PUBLIC_RUNTIME_ENV;
  document.querySelectorAll(scriptSelector).forEach((element) => {
    element.remove();
  });
});
afterEach(() => {
  cleanup();
  delete window.Flow;
  document.querySelectorAll(scriptSelector).forEach((element) => {
    element.remove();
  });
  if (originalRuntime === undefined) delete process.env.NEXT_PUBLIC_RUNTIME_ENV;
  else process.env.NEXT_PUBLIC_RUNTIME_ENV = originalRuntime;
  jest.useRealTimers();
});

it("recupera un script fallido con retry y muestra el error local sin desmontar el paso", () => {
  const handlers = callbacks();
  render(<FlowWidgetStep token="fixture-token" {...handlers} />);
  const failed = script();
  fireEvent.error(failed);
  expect(screen.getByRole("alert")).toHaveTextContent(/no se pudo cargar/i);
  expect(screen.queryByText("Cargando widget de pago...")).not.toBeInTheDocument();
  expect(handlers.onError).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Intentar nuevamente" }));
  const retry = script();
  expect(retry).not.toBe(failed);
  expect(failed).not.toBeInTheDocument();
  const provider = sdk();
  window.Flow = provider.flow;
  fireEvent.load(retry);
  fireEvent.load(retry);
  expect(provider.mount).toHaveBeenCalledTimes(1);
  expect(provider.mount).toHaveBeenCalledWith(
    expect.stringMatching(/^#flow-subscribe-/),
    "fixture-token",
  );
  expect(screen.getByText("Pago procesado de forma segura con Flow")).toBeInTheDocument();
  expect(toast.error).toHaveBeenCalledTimes(1);
});

it("actualiza callbacks sin volver a montar el SDK y llama solo al callback vigente", async () => {
  const card = deferred();
  const provider = sdk(card.promise);
  window.Flow = provider.flow;
  const previous = callbacks();
  const latest = callbacks();
  const { rerender } = render(<FlowWidgetStep token="fixture-token" {...previous} />);
  rerender(<FlowWidgetStep token="fixture-token" {...latest} />);
  expect(provider.mount).toHaveBeenCalledTimes(1);
  await act(async () => {
    card.resolve();
    await card.promise;
  });
  expect(previous.onSuccess).not.toHaveBeenCalled();
  expect(latest.onSuccess).toHaveBeenCalledTimes(1);
});

it("ignora la promesa vieja al cambiar token y limpia solo el iframe anterior", async () => {
  const oldCard = deferred();
  const newCard = deferred();
  const provider = sdk();
  provider.handle.mockReturnValueOnce(oldCard.promise).mockReturnValueOnce(newCard.promise);
  window.Flow = provider.flow;
  const handlers = callbacks();
  const { rerender } = render(<FlowWidgetStep token="old-fixture-token" {...handlers} />);
  const oldFrame = document.querySelector("iframe");
  rerender(<FlowWidgetStep token="new-fixture-token" {...handlers} />);
  expect(oldFrame).not.toBeInTheDocument();
  expect(document.querySelectorAll("iframe")).toHaveLength(1);
  await act(async () => {
    oldCard.resolve();
    await oldCard.promise;
  });
  expect(handlers.onSuccess).not.toHaveBeenCalled();
  await act(async () => {
    newCard.resolve();
    await newCard.promise;
  });
  expect(handlers.onSuccess).toHaveBeenCalledTimes(1);
  expect(provider.mount).toHaveBeenLastCalledWith(expect.any(String), "new-fixture-token");
});

it("un error de confirmar la suscripción no se presenta como rechazo de tarjeta", async () => {
  const card = deferred();
  const provider = sdk(card.promise);
  window.Flow = provider.flow;
  const handlers = callbacks();
  handlers.onSuccess.mockRejectedValueOnce(new Error("fixture confirmation network error"));
  render(<FlowWidgetStep token="fixture-token" {...handlers} />);
  await act(async () => {
    card.resolve();
    await card.promise;
  });
  expect(handlers.onSuccess).toHaveBeenCalledTimes(1);
  expect(handlers.onError).toHaveBeenCalledTimes(1);
  expect(handlers.onError).toHaveBeenCalledWith(expect.stringMatching(/confirmar/i));
  expect(handlers.onError).not.toHaveBeenCalledWith(
    expect.stringMatching(/rechaz|datos.*tarjeta/i),
  );
});

it("termina la espera a los 20 segundos y permite un nuevo intento de carga", async () => {
  const handlers = callbacks();
  render(<FlowWidgetStep token="fixture-token" {...handlers} />);
  const stalled = script();
  await act(() => jest.advanceTimersByTimeAsync(20_000));
  expect(screen.getByRole("alert")).toHaveTextContent(/tardó|conexión/i);
  expect(handlers.onError).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Intentar nuevamente" }));
  expect(script()).not.toBe(stalled);
});

it("eventos de script y timeout después del unmount no llaman callbacks ni muestran toast", async () => {
  const handlers = callbacks();
  const { unmount } = render(<FlowWidgetStep token="fixture-token" {...handlers} />);
  const late = script();
  unmount();
  fireEvent.error(late);
  fireEvent.load(late);
  await act(() => jest.advanceTimersByTimeAsync(20_000));
  expect(handlers.onError).not.toHaveBeenCalled();
  expect(handlers.onSuccess).not.toHaveBeenCalled();
  expect(toast.error).not.toHaveBeenCalled();
});

it("un rechazo del proveedor llega al aviso local una sola vez", async () => {
  const card = deferred();
  window.Flow = sdk(card.promise).flow;
  const handlers = callbacks();
  render(<FlowWidgetStep token="fixture-token" {...handlers} />);
  await act(async () => {
    card.reject(new Error("fixture provider failure"));
    await card.promise.catch(() => {});
  });
  expect(screen.getByRole("alert")).toHaveTextContent(/tarjeta/i);
  expect(toast.error).toHaveBeenCalledTimes(1);
  expect(handlers.onSuccess).not.toHaveBeenCalled();
  expect(handlers.onError).not.toHaveBeenCalled();
});

it.each([
  ["production", "https://www.flow.cl"],
  ["development", "https://sandbox.flow.cl"],
])("conserva el host del proveedor en %s", (runtime, host) => {
  process.env.NEXT_PUBLIC_RUNTIME_ENV = runtime;
  render(<FlowWidgetStep token="fixture-token" {...callbacks()} />);
  expect(script().src).toBe(`${host}/app/elements/flow-1.1.0.min.js?20241202`);
});

it("comparte el script en carga y desmontar una instancia no limpia el iframe de otra", () => {
  const handlers = callbacks();
  const { rerender } = render(
    <div>
      <FlowWidgetStep key="a" token="fixture-a" {...handlers} />
      <FlowWidgetStep key="b" token="fixture-b" {...handlers} />
    </div>,
  );
  expect(document.querySelectorAll(scriptSelector)).toHaveLength(1);
  const provider = sdk();
  window.Flow = provider.flow;
  fireEvent.load(script());
  expect(provider.mount).toHaveBeenCalledTimes(2);
  const secondSelector = provider.mount.mock.calls[1][0];
  const secondFrame = document.querySelector(`${secondSelector} iframe`);
  expect(document.querySelectorAll("iframe")).toHaveLength(2);
  rerender(
    <div>
      <FlowWidgetStep key="b" token="fixture-b" {...handlers} />
    </div>,
  );
  expect(provider.mount).toHaveBeenCalledTimes(2);
  expect(secondFrame).toBeInTheDocument();
  expect(document.querySelectorAll("iframe")).toHaveLength(1);
});

it("reemplaza un tag legacy inerte en vez de esperar un load que ya ocurrió", () => {
  const oldScript = document.createElement("script");
  oldScript.src = "https://sandbox.flow.cl/app/elements/flow-1.1.0.min.js?20241202";
  document.head.appendChild(oldScript);
  render(<FlowWidgetStep token="fixture-token" {...callbacks()} />);
  expect(script()).not.toBe(oldScript);
  expect(oldScript).not.toBeInTheDocument();
  const provider = sdk();
  window.Flow = provider.flow;
  fireEvent.load(script());
  expect(provider.mount).toHaveBeenCalledTimes(1);
});
