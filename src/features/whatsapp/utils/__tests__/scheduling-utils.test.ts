import { WHATSAPP_RULE_DATE_MODES, WHATSAPP_RULE_WHEN_MODES } from "../../enums/whatsapp.enums";
import {
  formatLimaDayLabel,
  isLimaDateTimeInFuture,
  isValidDateKey,
  isValidTimeKey,
  toLimaDateKey,
} from "../lima-time.util";
import { buildActivateRuleSearch, resolveRuleLink } from "../rule-link.util";
import { describeRuleScope, describeRuleWhen } from "../rule-summary.util";

describe("fechas y horas de Lima", () => {
  it("valida claves de fecha y hora", () => {
    expect(isValidDateKey("2026-02-28")).toBe(true);
    expect(isValidDateKey("2026-02-29")).toBe(false);
    expect(isValidDateKey("08/10/2026")).toBe(false);
    expect(isValidTimeKey("23:59")).toBe(true);
    expect(isValidTimeKey("24:00")).toBe(false);
  });

  it("usa el día de Lima para comparar con ahora", () => {
    const now = new Date("2026-10-09T03:00:00.000Z");
    expect(toLimaDateKey(now)).toBe("2026-10-08");
    expect(isLimaDateTimeInFuture("2026-10-08", "22:01", now)).toBe(true);
    expect(isLimaDateTimeInFuture("2026-10-08", "21:59", now)).toBe(false);
  });

  it("etiqueta mañana en hora de Lima", () => {
    expect(formatLimaDayLabel("2026-10-09T14:00:00.000Z", "2026-10-08T15:00:00.000Z")).toBe(
      "Mañana",
    );
  });
});

describe("resúmenes de regla", () => {
  it("describe el momento de envío", () => {
    const when = { minutes: null, time: null, hours: null };
    expect(describeRuleWhen({ ...when, mode: WHATSAPP_RULE_WHEN_MODES.IMMEDIATELY })).toBe(
      "Inmediato",
    );
    expect(
      describeRuleWhen({ ...when, mode: WHATSAPP_RULE_WHEN_MODES.DELAY_MINUTES, minutes: 30 }),
    ).toBe("30 min después");
    expect(
      describeRuleWhen({ ...when, mode: WHATSAPP_RULE_WHEN_MODES.DELAY_MINUTES, minutes: 1440 }),
    ).toBe("1 día después");
    expect(
      describeRuleWhen({ ...when, mode: WHATSAPP_RULE_WHEN_MODES.FIXED_TIME, time: "08:30" }),
    ).toBe("Todos los días a las 08:30");
    expect(
      describeRuleWhen({
        ...when,
        mode: WHATSAPP_RULE_WHEN_MODES.HOURS_BEFORE_DELIVERY,
        hours: 24,
      }),
    ).toBe("24 h antes de la entrega estimada");
  });

  it("describe el alcance con nombres de catálogo y lista vacía como todos", () => {
    expect(
      describeRuleScope(
        {
          dateMode: WHATSAPP_RULE_DATE_MODES.RANGE,
          from: "2026-10-01",
          to: null,
          maxOrderAgeDays: 15,
          storeIds: ["s-1"],
          salesChannels: [],
          shippingTypes: ["DOMICILIO"],
          courierIds: ["c-x"],
        },
        {
          stores: new Map([["s-1", "LIVII"]]),
          couriers: new Map(),
          shippingTypes: new Map([["DOMICILIO", "Domicilio"]]),
        },
      ),
    ).toBe(
      "LIVII · Todos los canales · Domicilio · c-x · Pedidos del 01/10/2026 en adelante · máx. 15 días",
    );
  });
});

describe("enlace desde Plantillas", () => {
  it("lleva a Programación con la regla del mismo uso y la plantilla", () => {
    const search = buildActivateRuleSearch("tab=plantillas&thread=t-1", {
      id: "tpl-camino",
      usage: "pedido_en_camino",
    });
    expect(new URLSearchParams(search).get("tab")).toBe("programacion");
    expect(resolveRuleLink(new URLSearchParams(search))).toEqual({
      kind: "rule",
      ruleKey: "pedido_en_camino",
      templateId: "tpl-camino",
    });
  });

  it("explica cuando la plantilla no tiene aviso automático o la regla no existe", () => {
    const search = buildActivateRuleSearch("rule=guia_creada", {
      id: "tpl-x",
      usage: "solo_envios_programados",
    });
    expect(resolveRuleLink(new URLSearchParams(search))).toEqual({
      kind: "no-rule-for-template",
      templateId: "tpl-x",
    });
    expect(resolveRuleLink(new URLSearchParams("rule=inventada"))).toEqual({
      kind: "unknown-rule",
      requestedKey: "inventada",
      templateId: null,
    });
    expect(resolveRuleLink(new URLSearchParams("tab=programacion"))).toEqual({ kind: "none" });
  });
});
