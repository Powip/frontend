import { renderHook } from "@testing-library/react";
import { useReceiptPrintScope } from "../useReceiptPrintScope";

it.each(["company", "user", "order"])(
  "invalidates active document work when %s changes, even before a delayed render completes",
  (part) => {
    const initial = { scope: "company:user:order", enabled: true };
    const { result, rerender } = renderHook(
      (props) => useReceiptPrintScope(props.scope, props.enabled),
      { initialProps: initial },
    );
    const operation = result.current();
    expect(operation.isCurrent?.()).toBe(true);
    rerender({ scope: initial.scope.replace(part, "changed"), enabled: true });
    expect(operation.signal?.aborted).toBe(true);
    expect(operation.isCurrent?.()).toBe(false);
    const next = result.current();
    expect(next.isCurrent?.()).toBe(true);
    next.release();
  },
);
it("cancels on close and never revives an old operation on reopening the same order", () => {
  const { result, rerender } = renderHook(
    (props) => useReceiptPrintScope("same", props.enabled),
    { initialProps: { enabled: true } },
  );
  const old = result.current();
  rerender({ enabled: false });
  expect(old.signal?.aborted).toBe(true);
  expect(result.current().isCurrent?.()).toBe(false);
  rerender({ enabled: true });
  expect(old.isCurrent?.()).toBe(false);
  expect(result.current().isCurrent?.()).toBe(true);
});
it("aborts active operations on unmount but does not retain completed operations", () => {
  const { result, unmount } = renderHook(() =>
    useReceiptPrintScope("same", true),
  );
  const complete = result.current(),
    active = result.current();
  complete.release();
  unmount();
  expect(active.signal?.aborted).toBe(true);
  expect(complete.signal?.aborted).toBe(false);
});
