import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { resolveSaleLifecycleTransition } from "@/services/saleUnitLifecycleService";
import { useSaleLifecycleRouting } from "../useSaleLifecycleRouting";

let company = "company";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { company: { id: company }, user: { id: "user" } } }),
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn() } }));
jest.mock("@/services/saleUnitLifecycleService", () => ({
  resolveSaleLifecycleTransition: jest.fn(),
}));
const order = { id: "order", status: "ANULADO", unitAssignmentStatus: "UNKNOWN" as const };
beforeEach(() => {
  jest.clearAllMocks();
  company = "company";
});

test("a normal classification continues the original action in the same user intent", async () => {
  jest.mocked(resolveSaleLifecycleTransition).mockResolvedValue(null);
  const { result } = renderHook(() => useSaleLifecycleRouting());
  const legacy = jest.fn();
  const tracked = jest.fn();
  await act(async () => {
    if (!(await result.current(order, "PENDIENTE", tracked))) legacy();
  });
  expect(legacy).toHaveBeenCalledTimes(1);
  expect(tracked).not.toHaveBeenCalled();
});
test("a serialized classification opens the explicit selection without running the normal mutation", async () => {
  jest.mocked(resolveSaleLifecycleTransition).mockResolvedValue("reactivate");
  const { result } = renderHook(() => useSaleLifecycleRouting());
  const tracked = jest.fn();
  await expect(result.current(order, "PENDIENTE", tracked)).resolves.toBe(true);
  expect(tracked).toHaveBeenCalledWith("reactivate");
});
test("unavailable context stops the action and surfaces a retryable error", async () => {
  jest.mocked(resolveSaleLifecycleTransition).mockRejectedValue(new Error("No disponible"));
  const { result } = renderHook(() => useSaleLifecycleRouting());
  const tracked = jest.fn();
  await expect(result.current(order, "PENDIENTE", tracked)).resolves.toBe(true);
  expect(tracked).not.toHaveBeenCalled();
  expect(toast.error).toHaveBeenCalled();
});
test("changing company cancels classification and never continues either mutation using the stale result", async () => {
  let finish!: (value: null) => void;
  jest.mocked(resolveSaleLifecycleTransition).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result, rerender } = renderHook(() => useSaleLifecycleRouting());
  const tracked = jest.fn();
  const pending = result.current(order, "PENDIENTE", tracked);
  const signal = jest.mocked(resolveSaleLifecycleTransition).mock.calls[0][2];
  company = "other-company";
  rerender();
  await act(async () => finish(null));
  await expect(pending).resolves.toBe(true);
  expect(signal?.aborted).toBe(true);
  expect(tracked).not.toHaveBeenCalled();
  expect(toast.error).not.toHaveBeenCalled();
});
test("duplicate clicks share the in-flight classification and open only one modal", async () => {
  let finish!: (value: "reactivate") => void;
  jest.mocked(resolveSaleLifecycleTransition).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { result } = renderHook(() => useSaleLifecycleRouting());
  const tracked = jest.fn();
  const pending = result.current(order, "PENDIENTE", tracked);
  await expect(result.current(order, "PENDIENTE", tracked)).resolves.toBe(true);
  await act(async () => finish("reactivate"));
  await pending;
  expect(resolveSaleLifecycleTransition).toHaveBeenCalledTimes(1);
  expect(tracked).toHaveBeenCalledTimes(1);
});
