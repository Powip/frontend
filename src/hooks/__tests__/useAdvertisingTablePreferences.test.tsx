import { act, renderHook } from "@testing-library/react";
import { useAdvertisingTablePreferences } from "../useAdvertisingTablePreferences";

beforeEach(() => localStorage.clear());
it("guarda sólo preferencia de columnas y separa usuarios", () => {
  const { result, rerender } = renderHook(
    ({ actorId }) => useAdvertisingTablePreferences(actorId),
    { initialProps: { actorId: "actor-a" } },
  );
  act(() => result.current.setMore(true));
  expect(localStorage.getItem("powip:advertising:table:v1:actor-a")).toBe(
    '{"version":1,"more":true}',
  );
  rerender({ actorId: "actor-b" });
  expect(result.current.more).toBe(false);
  rerender({ actorId: "actor-a" });
  expect(result.current.more).toBe(true);
});
it("ignora almacenamiento inválido o inaccesible sin bloquear tabla", () => {
  localStorage.setItem("powip:advertising:table:v1:actor-a", "{invalid");
  const { result } = renderHook(() => useAdvertisingTablePreferences("actor-a"));
  expect(result.current.more).toBe(false);
});
