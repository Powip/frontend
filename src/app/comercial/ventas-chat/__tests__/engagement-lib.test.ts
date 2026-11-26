import {
  audienceLabel,
  broadcastActions,
  broadcastProgress,
  draftFromRule,
  draftToInput,
  emptyRuleDraft,
  estimateCost,
  fillTemplateBody,
  firstWonStage,
  formatWait,
  minutesToWait,
  PRESETS,
  presetToInputs,
  summarizeRule,
  validateRuleDraft,
  waitToMinutes,
} from "@/components/ventas-chat/engagement";
import type { FollowupRule, Stage, Template } from "@/types/crm";

describe("espera y minutos", () => {
  it("convierte número + unidad a minutos", () => {
    expect(waitToMinutes(30, "minutes")).toBe(30);
    expect(waitToMinutes(2, "hours")).toBe(120);
    expect(waitToMinutes(3, "days")).toBe(4320);
    expect(waitToMinutes(1.5, "hours")).toBe(90);
  });

  it("elige la unidad más grande que divide exacto", () => {
    expect(minutesToWait(15)).toEqual({ value: 15, unit: "minutes" });
    expect(minutesToWait(120)).toEqual({ value: 2, unit: "hours" });
    expect(minutesToWait(1200)).toEqual({ value: 20, unit: "hours" });
    expect(minutesToWait(2880)).toEqual({ value: 2, unit: "days" });
    expect(minutesToWait(90)).toEqual({ value: 90, unit: "minutes" });
    expect(minutesToWait(86400)).toEqual({ value: 60, unit: "days" });
  });

  it("ida y vuelta no cambia el valor", () => {
    for (const m of [5, 45, 60, 600, 1440, 7200, 86400]) {
      const w = minutesToWait(m);
      expect(waitToMinutes(w.value, w.unit)).toBe(m);
    }
  });

  it("formatea corto", () => {
    expect(formatWait(30)).toBe("30 min");
    expect(formatWait(120)).toBe("2 h");
    expect(formatWait(1440)).toBe("1 día");
    expect(formatWait(4320)).toBe("3 días");
  });
});

const rule = (over: Partial<FollowupRule> = {}): FollowupRule => ({
  id: "r1",
  name: "Recordatorio",
  objective: "sale",
  trigger: "customer_silent",
  stageId: null,
  waitMinutes: 120,
  target: "customer",
  message: "Hola {nombre}",
  templateName: null,
  templateLanguage: null,
  templateVariables: [],
  active: true,
  createdAt: "2026-11-19T10:00:00.000Z",
  ...over,
});

describe("summarizeRule", () => {
  it("cliente sin plantilla: solo dentro de 24 h", () => {
    expect(summarizeRule(rule())).toBe(
      "Si el cliente no responde en 2 h → WhatsApp al cliente · solo dentro de 24 h",
    );
  });
  it("cliente con plantilla", () => {
    expect(summarizeRule(rule({ templateName: "seguimiento", templateLanguage: "es" }))).toBe(
      "Si el cliente no responde en 2 h → WhatsApp al cliente · plantilla seguimiento fuera de 24 h",
    );
  });
  it("equipo sin respuesta crea tarea", () => {
    expect(summarizeRule(rule({ trigger: "agent_silent", waitMinutes: 15, target: "agent" }))).toBe(
      "Si nadie del equipo responde en 15 min → tarea en la Agenda de la vendedora",
    );
  });
  it("etapa con nombre", () => {
    expect(
      summarizeRule(rule({ trigger: "stage_idle", waitMinutes: 2880, stageId: "s1" }), "Cotizado"),
    ).toBe("Si el trato lleva 2 días en «Cotizado» → WhatsApp al cliente · solo dentro de 24 h");
  });
});

describe("borrador de regla", () => {
  const ok = { ...emptyRuleDraft(), name: "x", message: "hola" };

  it("stage_idle exige etapa", () => {
    expect(validateRuleDraft({ ...ok, trigger: "stage_idle" }).stage).toBeTruthy();
    expect(validateRuleDraft({ ...ok, trigger: "stage_idle", stageId: "s1" }).stage).toBeUndefined();
    expect(validateRuleDraft(ok)).toEqual({});
  });

  it("valida nombre, mensaje y rango de espera", () => {
    const e = validateRuleDraft(emptyRuleDraft());
    expect(e.name).toBeTruthy();
    expect(e.message).toBeTruthy();
    expect(validateRuleDraft({ ...ok, waitValue: "2", waitUnit: "minutes" }).wait).toBeTruthy();
    expect(validateRuleDraft({ ...ok, waitValue: "61", waitUnit: "days" }).wait).toBeTruthy();
    expect(validateRuleDraft({ ...ok, waitValue: "5", waitUnit: "minutes" }).wait).toBeUndefined();
    expect(validateRuleDraft({ ...ok, waitValue: "60", waitUnit: "days" }).wait).toBeUndefined();
  });

  it("draftToInput convierte la espera y descarta plantilla si el destino es la vendedora", () => {
    const withTpl = {
      ...ok,
      waitValue: "1",
      waitUnit: "days" as const,
      templateName: "t",
      templateLanguage: "es",
      templateVariables: ["{nombre}"],
    };
    expect(draftToInput(withTpl)).toMatchObject({
      waitMinutes: 1440,
      templateName: "t",
      templateLanguage: "es",
      templateVariables: ["{nombre}"],
      stageId: null,
      active: false,
    });
    expect(draftToInput({ ...withTpl, target: "agent" })).toMatchObject({
      templateName: null,
      templateLanguage: null,
      templateVariables: [],
    });
  });

  it("draftFromRule recupera número y unidad", () => {
    expect(draftFromRule(rule({ waitMinutes: 2880 }))).toMatchObject({
      waitValue: "2",
      waitUnit: "days",
    });
  });
});

describe("plantillas", () => {
  it("rellena {{n}} con los valores y deja los vacíos", () => {
    expect(fillTemplateBody("Hola {{1}}, tu {{2}}", ["Ana", ""])).toBe("Hola Ana, tu {{2}}");
  });

  it("costo estimado por categoría", () => {
    expect(estimateCost("MARKETING", 10)).toBe(3);
    expect(estimateCost("UTILITY", 10)).toBe(0.5);
    expect(estimateCost("AUTHENTICATION", 10)).toBeNull();
    expect(estimateCost(undefined, 10)).toBeNull();
  });
});

describe("secuencias rápidas", () => {
  const tpl: Template = {
    name: "seg",
    language: "es",
    category: "MARKETING",
    status: "APPROVED",
    bodyText: "Hola {{1}}",
    variableCount: 1,
  };
  const venta = PRESETS.find((p) => p.key === "venta-6-dias")!;

  it("crea todo inactivo, con plantilla solo en los pasos de plantilla", () => {
    const inputs = presetToInputs(venta, { stageId: null, template: tpl });
    expect(inputs).toHaveLength(5);
    expect(inputs.every((i) => i.active === false)).toBe(true);
    expect(inputs.map((i) => i.waitMinutes)).toEqual([120, 1200, 2880, 5760, 8640]);
    expect(inputs.map((i) => i.templateName)).toEqual([null, null, "seg", "seg", "seg"]);
    expect(inputs[2].templateVariables).toEqual(["{nombre}"]);
    expect(inputs[0].templateVariables).toEqual([]);
  });

  it("sin plantilla elegida ningún paso lleva plantilla", () => {
    const inputs = presetToInputs(venta, { stageId: null, template: null });
    expect(inputs.every((i) => i.templateName === null)).toBe(true);
  });

  it("sin respuesta del equipo es agent_silent y crea tarea", () => {
    const p = PRESETS.find((x) => x.key === "equipo-sin-respuesta")!;
    const inputs = presetToInputs(p, { stageId: null, template: null });
    expect(inputs[0]).toMatchObject({ trigger: "agent_silent", target: "agent", waitMinutes: 15 });
  });

  it("postventa usa la etapa Ganado y es stage_idle", () => {
    const p = PRESETS.find((x) => x.key === "postventa")!;
    const inputs = presetToInputs(p, { stageId: "won1", template: null });
    expect(inputs.every((i) => i.trigger === "stage_idle" && i.stageId === "won1")).toBe(true);
  });

  it("firstWonStage prefiere el embudo por defecto", () => {
    const st = (id: string, kind: Stage["kind"]): Stage => ({
      id,
      pipelineId: "p",
      name: id,
      color: "#000",
      position: 0,
      kind,
    });
    expect(
      firstWonStage([
        { isDefault: false, stages: [st("a", "won")] },
        { isDefault: true, stages: [st("b", "open"), st("c", "won")] },
      ])?.id,
    ).toBe("c");
    expect(firstWonStage([{ isDefault: true, stages: [st("b", "open")] }])).toBeNull();
  });
});

describe("difusiones", () => {
  it("el progreso es (enviados + fallidos) sobre el total", () => {
    expect(broadcastProgress({ total: 100, sentCount: 40, failedCount: 10 })).toBe(50);
    expect(broadcastProgress({ total: 0, sentCount: 0, failedCount: 0 })).toBe(0);
  });

  it("acciones según estado", () => {
    expect(broadcastActions("draft")).toEqual(["edit", "send", "delete"]);
    expect(broadcastActions("sending")).toEqual(["pause", "cancel"]);
    expect(broadcastActions("paused")).toEqual(["resume", "cancel"]);
    expect(broadcastActions("sent")).toEqual([]);
    expect(broadcastActions("cancelled")).toEqual(["delete"]);
  });

  it("texto del público", () => {
    expect(audienceLabel({ type: "all" })).toBe("Todos los contactos");
    expect(audienceLabel({ type: "stage", stageId: "s" }, "Cotizado")).toBe("Etapa «Cotizado»");
    expect(audienceLabel({ type: "inactive", inactiveDays: 30 })).toBe("Sin escribir hace 30 días");
  });
});
