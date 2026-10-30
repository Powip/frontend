import {
  WHATSAPP_CAMPAIGN_RECURRENCES,
  WHATSAPP_CAMPAIGN_SCHEDULE_TYPES,
  WHATSAPP_RULE_DATE_MODES,
  WHATSAPP_RULE_WHEN_MODES,
} from "../../enums/whatsapp.enums";
import {
  toCampaignValues,
  toSendingScheduleValues,
} from "../../mappers/to-scheduling-form-values.mapper";
import { type CampaignValues, createCampaignSchema } from "../campaign.schema";
import { createRuleConfigSchema, type RuleConfigValues } from "../rule-config.schema";
import { type SendingScheduleValues, sendingScheduleSchema } from "../sending-schedule.schema";

function issues(result: {
  success: boolean;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}) {
  if (result.success || !result.error) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}

const ruleValues = (overrides: Partial<RuleConfigValues> = {}): RuleConfigValues => ({
  templateId: "tpl-1",
  whenMode: WHATSAPP_RULE_WHEN_MODES.IMMEDIATELY,
  delayMinutes: "",
  fixedTime: "",
  hoursBefore: "",
  reminderEnabled: false,
  reminderHours: "",
  dateMode: WHATSAPP_RULE_DATE_MODES.SINCE_ACTIVATION,
  from: "",
  to: "",
  maxOrderAgeDays: "15",
  storeIds: [],
  salesChannels: [],
  shippingTypes: [],
  courierIds: [],
  ...overrides,
});

const allModes = Object.values(WHATSAPP_RULE_WHEN_MODES);

describe("createRuleConfigSchema", () => {
  const schema = createRuleConfigSchema({ allowedWhenModes: allModes, supportsReminder: true });

  it("acepta una regla válida", () => {
    expect(issues(schema.safeParse(ruleValues()))).toEqual({});
  });

  it("exige plantilla y valida el valor de cada momento de envío", () => {
    expect(issues(schema.safeParse(ruleValues({ templateId: "" })))).toEqual({
      templateId: "Elige una plantilla.",
    });
    expect(
      issues(
        schema.safeParse(
          ruleValues({ whenMode: WHATSAPP_RULE_WHEN_MODES.DELAY_MINUTES, delayMinutes: "0" }),
        ),
      ),
    ).toEqual({ delayMinutes: "Escribe un número entero entre 1 y 10,080." });
    expect(
      issues(
        schema.safeParse(
          ruleValues({ whenMode: WHATSAPP_RULE_WHEN_MODES.FIXED_TIME, fixedTime: "25:00" }),
        ),
      ),
    ).toEqual({ fixedTime: "Elige una hora válida." });
    expect(
      issues(
        schema.safeParse(
          ruleValues({
            whenMode: WHATSAPP_RULE_WHEN_MODES.HOURS_BEFORE_DELIVERY,
            hoursBefore: "2.5",
          }),
        ),
      ),
    ).toEqual({ hoursBefore: "Escribe un número entero entre 1 y 168." });
  });

  it("rechaza modos no permitidos para la regla", () => {
    const restricted = createRuleConfigSchema({
      allowedWhenModes: [WHATSAPP_RULE_WHEN_MODES.IMMEDIATELY],
      supportsReminder: false,
    });
    expect(
      issues(
        restricted.safeParse(
          ruleValues({
            whenMode: WHATSAPP_RULE_WHEN_MODES.HOURS_BEFORE_DELIVERY,
            hoursBefore: "24",
          }),
        ),
      ),
    ).toEqual({ whenMode: "Este momento de envío no está disponible para este aviso." });
  });

  it("valida el recordatorio solo si la regla lo admite y está activo", () => {
    expect(
      issues(schema.safeParse(ruleValues({ reminderEnabled: true, reminderHours: "" }))),
    ).toEqual({
      reminderHours: "Escribe un número entero entre 1 y 168.",
    });
    const noReminder = createRuleConfigSchema({
      allowedWhenModes: allModes,
      supportsReminder: false,
    });
    expect(
      issues(noReminder.safeParse(ruleValues({ reminderEnabled: true, reminderHours: "" }))),
    ).toEqual({});
  });

  it("valida el rango de fechas y la antigüedad", () => {
    const range = { dateMode: WHATSAPP_RULE_DATE_MODES.RANGE };
    expect(issues(schema.safeParse(ruleValues({ ...range, from: "" })))).toEqual({
      from: "Elige la fecha de inicio.",
    });
    expect(issues(schema.safeParse(ruleValues({ ...range, from: "2026-02-30" })))).toEqual({
      from: "Elige la fecha de inicio.",
    });
    expect(
      issues(schema.safeParse(ruleValues({ ...range, from: "2026-10-10", to: "2026-10-01" }))),
    ).toEqual({
      to: "La fecha final no puede ser anterior a la inicial.",
    });
    expect(issues(schema.safeParse(ruleValues({ ...range, from: "2026-10-10", to: "" })))).toEqual(
      {},
    );
    expect(issues(schema.safeParse(ruleValues({ maxOrderAgeDays: "366" })))).toEqual({
      maxOrderAgeDays: "Escribe un número entero entre 1 y 365.",
    });
  });
});

describe("sendingScheduleSchema", () => {
  const base: SendingScheduleValues = toSendingScheduleValues(null);

  it("parte de los valores sugeridos del documento", () => {
    expect(base).toEqual({
      days: ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
      from: "08:00",
      to: "21:00",
      outOfHours: "defer",
      dedupe: true,
      maxPerOrderPerDay: "3",
    });
    expect(issues(sendingScheduleSchema.safeParse(base))).toEqual({});
  });

  it("exige días, horas válidas y un rango dentro del mismo día", () => {
    expect(issues(sendingScheduleSchema.safeParse({ ...base, days: [] }))).toEqual({
      days: "Elige al menos un día.",
    });
    expect(
      issues(sendingScheduleSchema.safeParse({ ...base, from: "21:00", to: "21:00" })),
    ).toEqual({
      to: "La hora final debe ser distinta de la inicial.",
    });
    expect(
      issues(sendingScheduleSchema.safeParse({ ...base, from: "22:00", to: "06:00" })),
    ).toEqual({
      to: "El horario no puede cruzar la medianoche. Usa un rango dentro del mismo día.",
    });
    expect(
      issues(sendingScheduleSchema.safeParse({ ...base, from: "", maxPerOrderPerDay: "11" })),
    ).toEqual({
      from: "Elige una hora válida.",
      maxPerOrderPerDay: "Escribe un número entero entre 1 y 10.",
    });
  });
});

describe("createCampaignSchema", () => {
  const now = () => new Date("2026-10-08T15:00:00.000Z");
  const schema = createCampaignSchema(now);
  const base = (overrides: Partial<CampaignValues> = {}): CampaignValues => ({
    ...toCampaignValues(null, { storeId: "store-livii" }),
    name: "Aviso de feriado",
    templateId: "tpl-1",
    date: "2026-10-09",
    time: "09:00",
    ...overrides,
  });

  it("acepta un envío único futuro", () => {
    expect(issues(schema.safeParse(base()))).toEqual({});
  });

  it("compara con la hora de Lima, no con la del navegador", () => {
    expect(issues(schema.safeParse(base({ date: "2026-10-08", time: "10:01" })))).toEqual({});
    expect(issues(schema.safeParse(base({ date: "2026-10-08", time: "09:59" })))).toEqual({
      date: "La fecha y hora deben ser posteriores a ahora (hora de Lima).",
    });
  });

  it("exige frecuencia en los envíos recurrentes y no pide fecha", () => {
    const recurring = { scheduleType: WHATSAPP_CAMPAIGN_SCHEDULE_TYPES.RECURRING, date: "" };
    expect(issues(schema.safeParse(base({ ...recurring, recurrence: "" })))).toEqual({
      recurrence: "Elige la frecuencia.",
    });
    expect(
      issues(
        schema.safeParse(
          base({ ...recurring, recurrence: WHATSAPP_CAMPAIGN_RECURRENCES.WEEKLY_MONDAY }),
        ),
      ),
    ).toEqual({});
  });

  it("exige nombre, plantilla, tienda y hora", () => {
    expect(
      issues(schema.safeParse(base({ name: " ", templateId: "", storeId: "", time: "" }))),
    ).toEqual({
      name: "Escribe un nombre para el envío.",
      templateId: "Elige una plantilla aprobada.",
      storeId: "Elige una tienda.",
      time: "Elige una hora válida.",
    });
  });
});
