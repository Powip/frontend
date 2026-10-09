import {
  alexandraFailedConversation,
  CONVERSATION_FIXTURE_NOW,
  conversationBoardFixture,
  conversationTemplatesFixture,
  diegoAttendedConversation,
  jorgeReadConversation,
  luciaConversation,
  rosaAssistedConversation,
  sofiaConversation,
} from "@/mocks/whatsapp/whatsapp-conversation.fixtures";
import { WHATSAPP_QUICK_REPLIES } from "../../constants/whatsapp-conversation-catalog";
import { WHATSAPP_THREAD_COLUMNS } from "../../enums/whatsapp.enums";
import { autoReplySchema } from "../../schemas/auto-reply.schema";
import { resolveConversationCapabilities } from "../conversation-access.util";
import {
  getSendableTemplates,
  resolveQuickReplyText,
  validateReplyText,
} from "../conversation-composer.util";
import {
  EMPTY_CONVERSATION_FILTERS,
  hasActiveConversationFilters,
  isSearchTooShort,
  normalizeConversationSearch,
  toConversationQuery,
} from "../conversation-filters.util";
import {
  readStoredConversationView,
  writeStoredConversationView,
} from "../conversation-preferences.util";
import {
  canMarkAttended,
  describeWaiting,
  formatElapsed,
  getConversationColumn,
  groupBoardByColumn,
  isShownAsAttended,
} from "../conversation-state.util";

const MINUTE = 60 * 1000;

describe("columna de la conversación", () => {
  it("Respondió tiene prioridad sobre el estado del último aviso", () => {
    expect(getConversationColumn(sofiaConversation)).toBe(WHATSAPP_THREAD_COLUMNS.REPLIED);
    expect(
      getConversationColumn({
        ...alexandraFailedConversation,
        attention: sofiaConversation.attention,
      }),
    ).toBe(WHATSAPP_THREAD_COLUMNS.REPLIED);
  });

  it("sin respuesta pendiente sigue al último aviso saliente", () => {
    expect(getConversationColumn(jorgeReadConversation)).toBe(WHATSAPP_THREAD_COLUMNS.READ);
    expect(getConversationColumn(alexandraFailedConversation)).toBe(WHATSAPP_THREAD_COLUMNS.FAILED);
    expect(getConversationColumn(rosaAssistedConversation)).toBe(WHATSAPP_THREAD_COLUMNS.SENT);
  });

  it("una conversación atendida no se mueve a Leído si su último mensaje no fue leído", () => {
    expect(diegoAttendedConversation.attention.attended).toBe(true);
    expect(getConversationColumn(diegoAttendedConversation)).toBe(WHATSAPP_THREAD_COLUMNS.SENT);
    expect(isShownAsAttended(diegoAttendedConversation)).toBe(true);
  });

  it("una respuesta nueva oculta «Atendida» y vuelve a permitir marcarla", () => {
    const reopened = {
      ...diegoAttendedConversation,
      attention: { ...diegoAttendedConversation.attention, pendingReply: true },
    };
    expect(isShownAsAttended(reopened)).toBe(false);
    expect(canMarkAttended(reopened)).toBe(true);
    expect(canMarkAttended(diegoAttendedConversation)).toBe(false);
  });

  it("sin aviso saliente ni respuesta pendiente no inventa una columna", () => {
    expect(getConversationColumn({ ...jorgeReadConversation, lastOutbound: null })).toBeNull();
  });

  it("reagrupa el tablero por la regla de atención sin duplicar tarjetas", () => {
    const board = {
      ...conversationBoardFixture,
      read: {
        ...conversationBoardFixture.read,
        items: [...conversationBoardFixture.read.items, luciaConversation],
      },
    };
    const grouped = groupBoardByColumn(board);
    expect(grouped.replied.map((item) => item.id)).toContain("cv-sofia");
    expect(grouped.delivered.map((item) => item.id)).not.toContain("cv-sofia");
    const allIds = Object.values(grouped).flatMap((items) => items.map((item) => item.id));
    expect(allIds.filter((id) => id === "cv-lucia")).toHaveLength(1);
  });
});

describe("espera", () => {
  it.each([
    [30 * 1000, "menos de 1 min"],
    [8 * MINUTE, "8 min"],
    [165 * MINUTE, "2 h 45 min"],
    [120 * MINUTE, "2 h"],
    [26 * 60 * MINUTE, "1 día"],
  ])("formatea %p ms como %p", (elapsed, expected) => {
    expect(
      formatElapsed(
        new Date(CONVERSATION_FIXTURE_NOW.getTime() - elapsed),
        CONVERSATION_FIXTURE_NOW,
      ),
    ).toBe(expected);
  });

  it("usa el umbral que informa backend", () => {
    expect(describeWaiting(luciaConversation, CONVERSATION_FIXTURE_NOW)).toEqual({
      text: "Espera hace 8 min",
      overdue: false,
    });
    expect(describeWaiting(sofiaConversation, CONVERSATION_FIXTURE_NOW)).toEqual({
      text: "Sin atender hace 2 h 45 min",
      overdue: true,
    });
    expect(describeWaiting(diegoAttendedConversation, CONVERSATION_FIXTURE_NOW)).toBeNull();
  });
});

describe("filtros", () => {
  it("normaliza teléfonos y exige un mínimo de caracteres", () => {
    expect(normalizeConversationSearch(" +51 987-111 222 ")).toBe("51987111222");
    expect(normalizeConversationSearch("  Lucía   Ramos ")).toBe("Lucía Ramos");
    expect(normalizeConversationSearch("a")).toBeNull();
    expect(isSearchTooShort("a")).toBe(true);
    expect(isSearchTooShort("")).toBe(false);
  });

  it("arma la consulta con IDs reales de tienda y usuario", () => {
    expect(
      toConversationQuery(
        { search: "ORD-149905", storeId: "store-livii", assignedToMe: true },
        "u-mr",
      ),
    ).toEqual({ q: "ORD-149905", storeId: "store-livii", assignedTo: "u-mr" });
  });

  it("no filtra por asignación sin un usuario identificado", () => {
    expect(
      toConversationQuery({ ...EMPTY_CONVERSATION_FILTERS, assignedToMe: true }, null).assignedTo,
    ).toBeNull();
  });

  it("detecta filtros activos ignorando búsquedas demasiado cortas", () => {
    expect(hasActiveConversationFilters(EMPTY_CONVERSATION_FILTERS)).toBe(false);
    expect(hasActiveConversationFilters({ ...EMPTY_CONVERSATION_FILTERS, search: "a" })).toBe(
      false,
    );
    expect(
      hasActiveConversationFilters({ ...EMPTY_CONVERSATION_FILTERS, storeId: "store-kunca" }),
    ).toBe(true);
  });
});

describe("preferencia de vista", () => {
  it("lee y escribe solo la vista", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    };
    writeStoredConversationView("list", storage);
    expect(readStoredConversationView(storage)).toBe("list");
    expect([...store.values()]).toEqual(["list"]);
  });

  it("tolera un almacenamiento que falla o un valor desconocido", () => {
    const failing = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(readStoredConversationView(failing)).toBeNull();
    expect(() => writeStoredConversationView("board", failing)).not.toThrow();
    expect(readStoredConversationView({ getItem: () => "kanban" })).toBeNull();
  });
});

describe("capacidades", () => {
  it("no concede nada sin permisos explícitos", () => {
    expect(resolveConversationCapabilities(null)).toEqual({
      view: false,
      reply: false,
      reassign: false,
      manageOptOuts: false,
    });
  });

  it("traduce solo códigos de permiso, no roles", () => {
    expect(resolveConversationCapabilities(["WA_VIEW", "WA_REPLY", "ADMINISTRADOR"])).toEqual({
      view: true,
      reply: true,
      reassign: false,
      manageOptOuts: false,
    });
  });
});

describe("composición", () => {
  const [trackingLink, reschedule, changeAddress] = WHATSAPP_QUICK_REPLIES;

  it("completa la respuesta rápida con el primer nombre y el link real", () => {
    expect(
      resolveQuickReplyText(trackingLink, {
        customerName: "Lucía Ramos",
        trackingUrl: "powip.lat/r/L4K8M",
      }),
    ).toBe("Hola Lucía, aquí puedes ver tu pedido en tiempo real: powip.lat/r/L4K8M");
  });

  it("no ofrece el link de rastreo si el pedido no lo tiene", () => {
    expect(resolveQuickReplyText(trackingLink, { customerName: "Ana", trackingUrl: null })).toBe(
      null,
    );
  });

  it("funciona sin nombre del comprador", () => {
    expect(resolveQuickReplyText(reschedule, { customerName: null, trackingUrl: null })).toMatch(
      /^Hola, ¿qué día/,
    );
  });

  it("reprogramar y cambiar dirección no anuncian cambios que no ocurrieron", () => {
    const context = { customerName: "Lucía", trackingUrl: null };
    for (const reply of [reschedule, changeAddress]) {
      const text = resolveQuickReplyText(reply, context) ?? "";
      expect(text).not.toMatch(/reprogramamos|corregimos|actualizamos|ya cambiamos/i);
      expect(text).toMatch(/confirmamos por aquí/);
    }
  });

  it("valida texto vacío y largo máximo", () => {
    expect(validateReplyText("   ")).toBe("Escribe un mensaje.");
    expect(validateReplyText("a".repeat(4097))).toBe("Máximo 4,096 caracteres.");
    expect(validateReplyText("Hola")).toBeNull();
  });

  it("solo ofrece plantillas enviables de la tienda", () => {
    const sendable = getSendableTemplates(conversationTemplatesFixture, "store-livii");
    const statuses = sendable.map((template) => template.status);
    expect(statuses).toContain("APPROVED");
    expect(statuses).toContain("PENDING");
    expect(statuses.some((status) => ["DRAFT", "REJECTED", "PAUSED"].includes(status))).toBe(false);
    expect(
      sendable
        .filter((template) => template.status === "PENDING")
        .every((template) => template.approvedVersion !== null),
    ).toBe(true);
    expect(getSendableTemplates(conversationTemplatesFixture, "store-kunca")).toEqual([]);
  });
});

describe("respuesta automática", () => {
  const valid = {
    enabled: true,
    inHoursText: "Hola {{cliente}}: {{link_rastreo}}",
    outOfHoursText: "Te respondemos mañana.",
  };

  it("acepta solo las dos variables permitidas", () => {
    expect(autoReplySchema.safeParse(valid).success).toBe(true);
    const result = autoReplySchema.safeParse({ ...valid, inHoursText: "Hola {{orden}}" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/Quita: \{\{orden\}\}/);
  });

  it("rechaza llaves mal cerradas y textos largos", () => {
    expect(autoReplySchema.safeParse({ ...valid, outOfHoursText: "Hola {{cliente" }).success).toBe(
      false,
    );
    expect(autoReplySchema.safeParse({ ...valid, inHoursText: "a".repeat(1025) }).success).toBe(
      false,
    );
  });

  it("exige textos solo si está activa", () => {
    expect(autoReplySchema.safeParse({ ...valid, inHoursText: "" }).success).toBe(false);
    expect(
      autoReplySchema.safeParse({ enabled: false, inHoursText: "", outOfHoursText: "" }).success,
    ).toBe(true);
  });
});
