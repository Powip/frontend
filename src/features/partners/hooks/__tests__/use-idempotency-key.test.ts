import { renderHook } from "@testing-library/react";
import { createIdempotencyKey } from "../../utils/create-idempotency-key";
import { useIdempotencyKey } from "../use-idempotency-key";

jest.mock("../../utils/create-idempotency-key", () => ({
  createIdempotencyKey: jest.fn(),
}));

const mockCreateIdempotencyKey = jest.mocked(createIdempotencyKey);

describe("useIdempotencyKey", () => {
  beforeEach(() => {
    let counter = 0;
    mockCreateIdempotencyKey.mockReset();
    mockCreateIdempotencyKey.mockImplementation(() => `key-${++counter}`);
  });

  it("reutiliza la misma clave al reintentar con el mismo payload", () => {
    const { result } = renderHook(() => useIdempotencyKey());

    const first = result.current.resolve({ email: "a@a.com" });
    const retry = result.current.resolve({ email: "a@a.com" });

    expect(first).toBe("key-1");
    expect(retry).toBe("key-1");
  });

  it("genera una clave nueva cuando el payload cambia", () => {
    const { result } = renderHook(() => useIdempotencyKey());

    const first = result.current.resolve({ email: "a@a.com" });
    const changed = result.current.resolve({ email: "b@b.com" });

    expect(changed).not.toBe(first);
  });

  it("genera una clave nueva después de reset aunque el payload sea el mismo", () => {
    const { result } = renderHook(() => useIdempotencyKey());

    const first = result.current.resolve({ email: "a@a.com" });
    result.current.reset();
    const next = result.current.resolve({ email: "a@a.com" });

    expect(next).not.toBe(first);
  });

  it("devuelve la misma referencia entre renders para poder usarse como dependencia", () => {
    const { result, rerender } = renderHook(() => useIdempotencyKey());
    const initial = result.current;

    rerender();

    expect(result.current).toBe(initial);
  });
});
