import {
  draftsToInput,
  emptyRule,
  inventoryRulesChanged,
  moveRule,
  parseReleaseDays,
  releaseDaysToText,
  rulesChanged,
  rulesToDrafts,
  shadowedRuleKeys,
  validateRules,
  withNames,
  type RuleDraft,
} from "../stockRules";
import type { ReservationRule } from "@/services/warehousesService";

const W1 = "11111111-1111-4111-8111-111111111111";
const W2 = "22222222-2222-4222-8222-222222222222";
const S1 = "33333333-3333-4333-8333-333333333333";

const rule = (over: Partial<ReservationRule>): ReservationRule => ({
  id: "r",
  priority: 10,
  department: null,
  province: null,
  storeId: null,
  inventoryId: W1,
  active: true,
  ...over,
});

const draft = (over: Partial<RuleDraft>): RuleDraft => ({
  key: "k",
  department: "",
  province: "",
  storeId: "",
  inventoryId: W1,
  active: true,
  ...over,
});

describe("reglas de reserva por región (FEAT-24 H2-F)", () => {
  it("las reglas del servidor quedan en el orden en que se evalúan y los null pasan a vacío", () => {
    const drafts = rulesToDrafts([
      rule({ id: "b", priority: 50, department: "Lima", inventoryId: W2 }),
      rule({ id: "a", priority: 5, storeId: S1, active: false }),
    ]);
    expect(drafts).toEqual([
      { key: "a", department: "", province: "", storeId: S1, inventoryId: W1, active: false },
      { key: "b", department: "Lima", province: "", storeId: "", inventoryId: W2, active: true },
    ]);
  });

  it("al guardar, la prioridad sale del orden en pantalla y vacío viaja como null", () => {
    const input = draftsToInput([
      draft({ key: "x", department: " Lima ", province: "Lima", storeId: S1, inventoryId: W2 }),
      draft({ key: "y", active: false }),
    ]);
    expect(input).toEqual([
      { priority: 10, department: "Lima", province: "Lima", storeId: S1, inventoryId: W2, active: true },
      { priority: 20, department: null, province: null, storeId: null, inventoryId: W1, active: false },
    ]);
  });

  it("una provincia sin departamento no se manda", () => {
    expect(draftsToInput([draft({ province: "Lima" })])[0].province).toBeNull();
  });

  it("200 reglas entran en el rango de prioridades de la fachada (0..10.000) y no se repiten", () => {
    const priorities = draftsToInput(Array.from({ length: 200 }, (_, i) => draft({ key: String(i) }))).map((r) => r.priority);
    expect(new Set(priorities).size).toBe(200);
    expect(Math.max(...priorities)).toBeLessThanOrEqual(10000);
    expect(Math.min(...priorities)).toBeGreaterThanOrEqual(0);
  });

  it("subir y bajar intercambia con la vecina; en los bordes no cambia nada", () => {
    expect(moveRule(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveRule(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
    const list = ["a", "b"];
    expect(moveRule(list, 0, -1)).toBe(list);
    expect(moveRule(list, 1, 1)).toBe(list);
  });

  it("detecta cambios, incluido el orden", () => {
    const saved = [rule({ id: "a", priority: 1 }), rule({ id: "b", priority: 2, department: "Cusco" })];
    const drafts = rulesToDrafts(saved);
    expect(rulesChanged(drafts, saved)).toBe(false);
    expect(rulesChanged(moveRule(drafts, 0, 1), saved)).toBe(true);
    expect(rulesChanged([...drafts, emptyRule(W1)], saved)).toBe(true);
    expect(rulesChanged(drafts.map((d) => ({ ...d, active: !d.active })), saved)).toBe(true);
  });

  it("cada regla necesita un almacén activo", () => {
    const problems = validateRules(
      [draft({ key: "ok" }), draft({ key: "sin", inventoryId: "" }), draft({ key: "inactivo", inventoryId: W2 })],
      new Set([W1]),
    );
    expect(problems).toEqual([
      { key: "sin", message: "Elige el almacén de la regla." },
      { key: "inactivo", message: "El almacén no está activo: elige otro." },
    ]);
  });

  it("no deja más de 200 reglas", () => {
    const many = Array.from({ length: 201 }, (_, i) => draft({ key: String(i) }));
    expect(validateRules(many, new Set([W1]))[0].message).toMatch(/como máximo 200/);
  });

  it("avisa de una regla que otra más arriba ya cubre (sin tildes ni mayúsculas)", () => {
    const keys = shadowedRuleKeys([
      draft({ key: "lima", department: "Lima" }),
      draft({ key: "lima-lima", department: "LIMA", province: "Lima" }),
      draft({ key: "cusco", department: "Cusco" }),
      draft({ key: "inactiva", department: "Lima", active: false }),
      draft({ key: "junin-tienda", department: "Junín", storeId: S1 }),
      draft({ key: "junin", department: "Junin" }),
    ]);
    expect([...keys]).toEqual(["lima-lima"]);
    expect([...shadowedRuleKeys([draft({ key: "todo" }), draft({ key: "x", department: "Ica" })])]).toEqual(["x"]);
  });

  it("nombra los almacenes que el servidor menciona por id", () => {
    expect(withNames(`El almacén ${W1} no está activo o no es de la empresa.`, new Map([[W1, "Central"]]))).toBe(
      "El almacén «Central» no está activo o no es de la empresa.",
    );
    expect(withNames(`El almacén ${W2} no existe.`, new Map())).toContain(W2);
  });
});

describe("reglas de inventario (FEAT-24 H2-F)", () => {
  it("vacío = nunca; 1..365 entero", () => {
    expect(parseReleaseDays("")).toEqual({ ok: true, value: null });
    expect(parseReleaseDays("  ")).toEqual({ ok: true, value: null });
    expect(parseReleaseDays("7")).toEqual({ ok: true, value: 7 });
    expect(parseReleaseDays("365")).toEqual({ ok: true, value: 365 });
    expect(parseReleaseDays("0")).toMatchObject({ ok: false, error: expect.stringMatching(/de 1 a 365/) });
    expect(parseReleaseDays("366")).toMatchObject({ ok: false });
    expect(parseReleaseDays("2.5")).toMatchObject({ ok: false, error: expect.stringMatching(/entero/) });
    expect(parseReleaseDays("-3")).toMatchObject({ ok: false });
  });

  it("muestra los días guardados y detecta cambios", () => {
    expect(releaseDaysToText(null)).toBe("");
    expect(releaseDaysToText(7)).toBe("7");
    const saved = { releaseAfterDays: 7, pickingRequired: false };
    expect(inventoryRulesChanged({ releaseDays: "7", pickingRequired: false }, saved)).toBe(false);
    expect(inventoryRulesChanged({ releaseDays: "", pickingRequired: false }, saved)).toBe(true);
    expect(inventoryRulesChanged({ releaseDays: "7", pickingRequired: true }, saved)).toBe(true);
    expect(inventoryRulesChanged({ releaseDays: "abc", pickingRequired: false }, saved)).toBe(true);
  });
});
