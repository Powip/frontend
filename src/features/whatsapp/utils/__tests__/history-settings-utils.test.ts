import {
  assistedMessage,
  deliveredWithClickMessage,
  failedMessage,
  historyMetricsPartialFixture,
  skippedMessage,
} from "@/mocks/whatsapp/whatsapp-history.fixtures";
import {
  WHATSAPP_ALERT_TYPES,
  WHATSAPP_PERMISSION_CODES,
  WHATSAPP_PERMISSION_ROLES,
} from "../../enums/whatsapp.enums";
import {
  addOptOutSchema,
  alertSettingsSchema,
  reactivateOptOutSchema,
  toAlertSettingsValues,
} from "../../schemas/settings-tab.schema";
import {
  buildAuditChanges,
  formatAuditValue,
  REDACTED_LABEL,
  truncateAuditText,
} from "../audit-format.util";
import {
  buildFunnel,
  buildTimelineSteps,
  computeRatio,
  getLimaPeriodRange,
  toHistoryQuery,
} from "../history.util";
import { formatPeruWhatsAppNumber, normalizeOptOutPhone } from "../opt-out-phone.util";
import {
  combineBlockReasons,
  countMatrixDifferences,
  getDocumentedPermissionMatrix,
  getPermissionBlockReason,
  resolveEffectivePermissions,
  UNKNOWN_PERMISSION_REASON,
  withAdminLocked,
} from "../whatsapp-permissions.util";

describe("periodos en America/Lima", () => {
  it("de noche en Lima, «Hoy» empieza en la medianoche de Lima y no en la de UTC", () => {
    const now = new Date("2026-10-08T03:00:00.000Z");
    const range = getLimaPeriodRange("today", now);
    expect(range.from.toISOString()).toBe("2026-10-07T05:00:00.000Z");
    expect(range.fromKey).toBe("2026-10-07");
    expect(range.toKey).toBe("2026-10-07");
  });

  it("últimos 7 días incluye hoy y los 6 anteriores, aunque cruce el año", () => {
    const range = getLimaPeriodRange("7d", new Date("2026-01-03T15:00:00.000Z"));
    expect(range.from.toISOString()).toBe("2025-12-28T05:00:00.000Z");
    expect(range.fromKey).toBe("2025-12-28");
  });

  it("este mes usa el mes de Lima en el cambio de mes", () => {
    const range = getLimaPeriodRange("month", new Date("2026-11-01T04:30:00.000Z"));
    expect(range.from.toISOString()).toBe("2026-10-01T05:00:00.000Z");
    expect(range.toKey).toBe("2026-10-31");
  });

  it("la consulta comparte periodo, tienda y búsqueda normalizada", () => {
    const now = new Date("2026-10-08T16:00:00.000Z");
    expect(
      toHistoryQuery(
        { period: "today", status: "read", search: " 987-111 222 ", storeId: "store-livii" },
        now,
      ),
    ).toEqual({
      period: "today",
      from: "2026-10-08T05:00:00.000Z",
      to: "2026-10-08T16:00:00.000Z",
      storeId: "store-livii",
      q: "987111222",
    });
  });
});

describe("indicadores", () => {
  it("distingue dato desconocido, base cero y porcentaje", () => {
    expect(computeRatio(null, 10)).toEqual({ kind: "unknown" });
    expect(computeRatio(5, null)).toEqual({ kind: "unknown" });
    expect(computeRatio(0, 0)).toEqual({ kind: "no-base" });
    expect(computeRatio(0, 10)).toMatchObject({ kind: "value", label: "0%" });
    expect(computeRatio(1251, 1284)).toMatchObject({ kind: "value", label: "97.4%" });
  });

  it("el embudo usa siempre los enviados como base y no inventa datos faltantes", () => {
    const funnel = buildFunnel(historyMetricsPartialFixture);
    expect(funnel.map((step) => step.ratio.kind)).toEqual(["value", "unknown", "unknown", "value"]);
    expect(funnel[3].ratio).toMatchObject({ label: "25%" });
  });
});

describe("línea de tiempo", () => {
  it("un asistido no muestra entregado ni leído", () => {
    const labels = buildTimelineSteps(assistedMessage).map((step) => step.label);
    expect(labels).toEqual([
      "Marcado como enviado por Katherine F.",
      "Sin confirmación de entrega ni de lectura",
    ]);
  });

  it("abrir el rastreo no marca el mensaje como leído", () => {
    const steps = buildTimelineSteps(deliveredWithClickMessage);
    expect(steps.find((step) => step.key === "read")).toMatchObject({ at: null, tone: "pending" });
    expect(steps.find((step) => step.key === "clicked")?.at).not.toBeNull();
  });

  it("distingue fallo de Meta y omisión de POWIP", () => {
    expect(buildTimelineSteps(failedMessage).at(-1)?.label).toBe("Meta no pudo entregarlo");
    expect(buildTimelineSteps(skippedMessage).at(-1)?.label).toBe("POWIP no lo envió");
  });
});

describe("permisos", () => {
  it("sin permisos de backend todo queda sin confirmar y bloquea con explicación", () => {
    const effective = resolveEffectivePermissions(null);
    expect(Object.values(effective).every((value) => value === null)).toBe(true);
    expect(getPermissionBlockReason(effective, WHATSAPP_PERMISSION_CODES.OPT_OUTS)).toBe(
      UNKNOWN_PERMISSION_REASON,
    );
  });

  it("traduce solo códigos y nunca roles", () => {
    const effective = resolveEffectivePermissions(["WA_OPTOUTS", "ADMINISTRADOR"]);
    expect(effective.WA_OPTOUTS).toBe(true);
    expect(effective.WA_CONNECTION).toBe(false);
    expect(getPermissionBlockReason(effective, WHATSAPP_PERMISSION_CODES.CONNECTION)).toBe(
      "No tienes permiso para esta acción.",
    );
  });

  it("la matriz del documento coincide con el PDF y el administrador no se puede quitar", () => {
    const matrix = getDocumentedPermissionMatrix();
    expect(matrix.WA_RULES).toEqual({ admin: true, cc_supervisor: false, cc_agent: false });
    expect(matrix.WA_TEMPLATES).toEqual({ admin: true, cc_supervisor: true, cc_agent: false });
    expect(matrix.WA_REPLY.cc_agent).toBe(true);
    const tampered = {
      ...matrix,
      WA_VIEW: { ...matrix.WA_VIEW, [WHATSAPP_PERMISSION_ROLES.ADMIN]: false },
    };
    expect(withAdminLocked(tampered).WA_VIEW.admin).toBe(true);
    expect(countMatrixDifferences(tampered, matrix)).toBe(1);
  });

  it("combina motivos de bloqueo", () => {
    expect(combineBlockReasons(null, undefined)).toBeNull();
    expect(combineBlockReasons("A.", null, "B.")).toBe("A. B.");
  });
});

describe("registro de cambios", () => {
  it("oculta tokens y secretos, también anidados", () => {
    const changes = buildAuditChanges(
      { accessToken: "EAAG-viejo", phoneNumberId: "1" },
      { accessToken: "EAAG-nuevo", phoneNumberId: "1", webhook: { verifyToken: "x", url: "u" } },
    );
    const token = changes.find((change) => change.key === "accessToken");
    expect(token).toMatchObject({ before: REDACTED_LABEL, after: REDACTED_LABEL, changed: true });
    const webhook = changes.find((change) => change.key === "webhook");
    expect(webhook?.after).toBe(`verifyToken: ${REDACTED_LABEL} · url: u`);
    expect(JSON.stringify(changes)).not.toMatch(/EAAG|"x"/);
  });

  it("muestra datos ausentes y valores de forma legible", () => {
    expect(formatAuditValue(null)).toBe("Sin dato");
    expect(formatAuditValue(undefined)).toBe("Sin dato");
    expect(formatAuditValue(true)).toBe("Sí");
    expect(formatAuditValue([])).toBe("Ninguno");
    expect(formatAuditValue(["MON", "TUE"])).toBe("MON, TUE");
    expect(buildAuditChanges(null, null)).toEqual([]);
    expect(truncateAuditText("a".repeat(200))).toMatchObject({ truncated: true });
  });
});

describe("teléfonos de bajas", () => {
  it.each([
    ["987 654 321", "51987654321"],
    ["+51 987-654-321", "51987654321"],
    ["01 444 5566", null],
    ["54325632", null],
  ])("normaliza %p", (raw, expected) => {
    expect(normalizeOptOutPhone(raw)).toBe(expected);
  });

  it("formatea para mostrar", () => {
    expect(formatPeruWhatsAppNumber("51987654321")).toBe("+51 987 654 321");
  });
});

describe("formularios", () => {
  it("agregar baja exige celular válido y tienda", () => {
    const base = { phone: "987654321", customerName: "", storeId: "store-livii", note: "" };
    expect(addOptOutSchema.safeParse(base).success).toBe(true);
    expect(addOptOutSchema.safeParse({ ...base, phone: "014445566" }).success).toBe(false);
    expect(addOptOutSchema.safeParse({ ...base, storeId: "" }).success).toBe(false);
  });

  it("reactivar exige el pedido del comprador y cómo lo pidió", () => {
    expect(
      reactivateOptOutSchema.safeParse({ customerRequested: false, note: "Lo pidió por chat" })
        .success,
    ).toBe(false);
    expect(reactivateOptOutSchema.safeParse({ customerRequested: true, note: "ok" }).success).toBe(
      false,
    );
    expect(
      reactivateOptOutSchema.safeParse({ customerRequested: true, note: "Lo pidió por chat" })
        .success,
    ).toBe(true);
  });

  it("los umbrales sugeridos son los del documento", () => {
    const values = toAlertSettingsValues(null);
    expect(values.rules.map((rule) => rule.threshold)).toEqual(["", "", "5", "80", "30"]);
    expect(values.rules.every((rule) => rule.enabled)).toBe(true);
  });

  it("valida unidades y rangos solo en alertas activas", () => {
    const values = toAlertSettingsValues(null);
    const withThreshold = (index: number, threshold: string, enabled = true) => ({
      ...values,
      rules: values.rules.map((rule, position) =>
        position === index ? { ...rule, threshold, enabled } : rule,
      ),
    });
    const failedIndex = values.rules.findIndex(
      (rule) => rule.type === WHATSAPP_ALERT_TYPES.FAILED_PCT,
    );
    const minutesIndex = values.rules.findIndex(
      (rule) => rule.type === WHATSAPP_ALERT_TYPES.UNATTENDED_MINUTES,
    );
    expect(alertSettingsSchema.safeParse(withThreshold(failedIndex, "101")).success).toBe(false);
    expect(alertSettingsSchema.safeParse(withThreshold(failedIndex, "2.5")).success).toBe(false);
    expect(alertSettingsSchema.safeParse(withThreshold(minutesIndex, "1441")).success).toBe(false);
    expect(alertSettingsSchema.safeParse(withThreshold(minutesIndex, "", false)).success).toBe(
      true,
    );
    const result = alertSettingsSchema.safeParse(withThreshold(minutesIndex, "0"));
    expect(result.error?.issues[0].message).toBe(
      "Escribe un número entero entre 1 y 1440 minutos.",
    );
  });
});
