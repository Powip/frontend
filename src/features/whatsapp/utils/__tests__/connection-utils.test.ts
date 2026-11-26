import {
  accountsFixture,
  CONNECTION_FIXTURE_NOW,
  connectedStatusFixture,
  liviiAccountFixture,
  notConnectedStatusFixture,
  partialAccountFixture,
  testRunFixtures,
  unknownStatusFixture,
} from "@/mocks/whatsapp/whatsapp-connection.fixtures";
import {
  contingencySchema,
  testMessageSchema,
  toContingencyValues,
} from "../../schemas/connection.schema";
import {
  describeConnectionStatus,
  describeLimitReset,
  describeUsage,
  describeWebhook,
  formatMetaId,
  isPricingStale,
  resolveStoreConnection,
  resolveTestProgress,
} from "../connection.util";

const now = CONNECTION_FIXTURE_NOW;
const minutesLater = (minutes: number) => new Date(now.getTime() + minutes * 60 * 1000);

describe("estado de conexión", () => {
  it("lo desconocido no se muestra como desconectado", () => {
    expect(describeConnectionStatus(null)).toBe("Estado sin confirmar");
    expect(describeConnectionStatus(unknownStatusFixture)).toBe("Estado sin confirmar");
    expect(describeConnectionStatus(connectedStatusFixture)).toBe("Conectado · API oficial");
    expect(describeConnectionStatus(notConnectedStatusFixture)).toBe("Sin conectar");
  });

  it("las filas por tienda distinguen pendiente, sin número y conectado", () => {
    expect(resolveStoreConnection("store-livii", { kind: "pending-integration" })).toEqual({
      kind: "unknown",
      reason: "pending",
    });
    expect(
      resolveStoreConnection("store-kunca", { kind: "ready", data: accountsFixture }).kind,
    ).toBe("not-connected");
    expect(
      resolveStoreConnection("store-livii", { kind: "ready", data: accountsFixture }).kind,
    ).toBe("connected");
  });
});

describe("datos del número", () => {
  it("uso del límite sin dato no es cero", () => {
    expect(describeUsage(partialAccountFixture)).toEqual({
      text: "Sin dato de uso",
      percent: null,
    });
    expect(
      describeUsage({ usageToday: { uniqueContacts: 5, limit: null, resetsAt: null } }).percent,
    ).toBeNull();
    expect(describeUsage(liviiAccountFixture)).toEqual({
      text: "312 de 1,000 compradores hoy",
      percent: 31.2,
    });
  });

  it("no inventa reinicios del límite", () => {
    expect(describeLimitReset(null, now)).toBe("Meta no informó cuándo se reinicia");
    expect(describeLimitReset(new Date(now.getTime() - 1000), now)).toBe(
      "Reinicio pendiente de confirmar por Meta",
    );
    expect(describeLimitReset(minutesLater(90), now)).toBe("Se reinicia en 1 h 30 min");
  });

  it("describe el webhook solo con datos", () => {
    expect(describeWebhook(partialAccountFixture, now)).toBe("Sin dato");
    expect(describeWebhook(liviiAccountFixture, now)).toBe("Activo · último evento hace 2 min");
  });

  it("formatea IDs de Meta", () => {
    expect(formatMetaId("310559812447021")).toBe("310 559 812 447 021");
    expect(formatMetaId(null)).toBe("Sin dato");
  });
});

describe("mensaje de prueba", () => {
  it("avanza solo con estados reales y termina en entregado sin esperar leído para siempre", () => {
    expect(resolveTestProgress(testRunFixtures.queued, now)).toEqual({
      kind: "in-progress",
      waitingFor: "sent",
    });
    expect(resolveTestProgress(testRunFixtures.deliveredRecently, now)).toEqual({
      kind: "in-progress",
      waitingFor: "read",
    });
    expect(resolveTestProgress(testRunFixtures.deliveredWithoutRead, now)).toEqual({
      kind: "delivered-without-read",
    });
    expect(resolveTestProgress(testRunFixtures.read, now)).toEqual({ kind: "read" });
    expect(resolveTestProgress(testRunFixtures.failed, now)).toEqual({
      kind: "failed",
      message: "El número no tiene WhatsApp.",
    });
  });

  it("valida teléfono y plantilla", () => {
    expect(testMessageSchema.safeParse({ phone: "912 345 678", templateId: "tpl" }).success).toBe(
      true,
    );
    expect(testMessageSchema.safeParse({ phone: "12345", templateId: "tpl" }).success).toBe(false);
    expect(testMessageSchema.safeParse({ phone: "912345678", templateId: "" }).success).toBe(false);
  });
});

describe("contingencia", () => {
  const base = toContingencyValues(null);

  it("parte de los valores del documento como sugeridos", () => {
    expect(base).toMatchObject({ failuresCount: "5", failuresMinutes: "15", manualOnly: false });
  });

  it("«solo manual» excluye los demás motivos y hace falta al menos uno si está activa", () => {
    expect(contingencySchema.safeParse({ ...base, manualOnly: true }).success).toBe(false);
    expect(
      contingencySchema.safeParse({
        ...base,
        enabled: true,
        onRestrictedOrRed: false,
        onDailyLimit: false,
        failuresEnabled: false,
      }).success,
    ).toBe(false);
    expect(
      contingencySchema.safeParse({
        ...base,
        enabled: true,
        onRestrictedOrRed: false,
        onDailyLimit: false,
        failuresEnabled: false,
        manualOnly: true,
      }).success,
    ).toBe(true);
  });

  it("valida rangos y la persona que envía", () => {
    expect(contingencySchema.safeParse({ ...base, failuresCount: "0" }).success).toBe(false);
    expect(contingencySchema.safeParse({ ...base, failuresMinutes: "1441" }).success).toBe(false);
    expect(
      contingencySchema.safeParse({ ...base, senderType: "user", senderUserId: "" }).success,
    ).toBe(false);
  });
});

describe("tarifas", () => {
  it("sin fecha de verificación o con más de 30 días se marcan como no verificadas", () => {
    expect(isPricingStale(null, now)).toBe(true);
    expect(isPricingStale(new Date(now.getTime() - 31 * 24 * 3600 * 1000), now)).toBe(true);
    expect(isPricingStale(new Date(now.getTime() - 3 * 24 * 3600 * 1000), now)).toBe(false);
  });
});
