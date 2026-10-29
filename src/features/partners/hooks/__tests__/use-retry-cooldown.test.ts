import { act, renderHook } from "@testing-library/react";
import { useRetryCooldown } from "../use-retry-cooldown";

describe("useRetryCooldown", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-10-07T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("bloquea durante el tiempo indicado y se libera al terminar", () => {
    const { result } = renderHook(() => useRetryCooldown());

    act(() => result.current.start(3000));
    expect(result.current.isCoolingDown).toBe(true);
    expect(result.current.remainingMs).toBe(3000);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.remainingMs).toBe(2000);

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.isCoolingDown).toBe(false);
    expect(result.current.remainingMs).toBe(0);
  });

  it("una espera de 0 no bloquea", () => {
    const { result } = renderHook(() => useRetryCooldown());

    act(() => result.current.start(0));

    expect(result.current.isCoolingDown).toBe(false);
  });
});
