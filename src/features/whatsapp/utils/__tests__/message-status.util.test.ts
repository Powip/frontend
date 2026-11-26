import {
  WHATSAPP_MESSAGE_STATUSES,
  WHATSAPP_NOTIFICATION_EVENTS,
  WHATSAPP_THREAD_COLUMNS,
} from "../../enums/whatsapp.enums";
import {
  getMessageStatusAccessibleLabel,
  getMetaStatusRank,
  hasDeliveryConfirmation,
  hasReadConfirmation,
  isMetaTrackedStatus,
  isNotSentStatus,
  MESSAGE_STATUS_PRESENTATION,
  THREAD_COLUMN_LABELS,
} from "../message-status.util";

const { QUEUED, SENT, DELIVERED, READ, FAILED, SKIPPED, ASSISTED } = WHATSAPP_MESSAGE_STATUSES;

describe("estados de mensaje", () => {
  it("un mensaje asistido no tiene entrega ni lectura confirmadas", () => {
    expect(hasDeliveryConfirmation(ASSISTED)).toBe(false);
    expect(hasReadConfirmation(ASSISTED)).toBe(false);
    expect(isMetaTrackedStatus(ASSISTED)).toBe(false);
    expect(getMetaStatusRank(ASSISTED)).toBeNull();
    expect(isNotSentStatus(ASSISTED)).toBe(false);
  });

  it("distingue fallido en Meta de omitido por POWIP", () => {
    expect(isNotSentStatus(FAILED)).toBe(true);
    expect(isNotSentStatus(SKIPPED)).toBe(true);
    expect(getMessageStatusAccessibleLabel(FAILED)).not.toBe(
      getMessageStatusAccessibleLabel(SKIPPED),
    );
    expect(isMetaTrackedStatus(SKIPPED)).toBe(false);
  });

  it("ordena solo los estados que informa Meta", () => {
    expect([SENT, DELIVERED, READ].map(getMetaStatusRank)).toEqual([1, 2, 3]);
    expect([QUEUED, FAILED, SKIPPED].map(getMetaStatusRank)).toEqual([null, null, null]);
  });

  it("tiene texto accesible para todos los estados", () => {
    for (const status of Object.values(WHATSAPP_MESSAGE_STATUSES)) {
      expect(MESSAGE_STATUS_PRESENTATION[status].label.length).toBeGreaterThan(0);
    }
    expect(getMessageStatusAccessibleLabel(ASSISTED)).toContain("sin confirmación de entrega");
  });
});

describe("separación de estados", () => {
  it("Respondió es una columna de conversación, no un estado de mensaje", () => {
    expect(Object.values(WHATSAPP_MESSAGE_STATUSES)).not.toContain(WHATSAPP_THREAD_COLUMNS.REPLIED);
    expect(THREAD_COLUMN_LABELS[WHATSAPP_THREAD_COLUMNS.REPLIED]).toBe("Respondió");
  });

  it("los eventos de aviso incluyen etapas que no son estados reales del pedido", () => {
    const orderStatuses = [
      "INCOMPLETE",
      "PREVENTA",
      "PENDIENTE",
      "PREPARADO",
      "LLAMADO",
      "ASIGNADO_A_GUIA",
      "EN_ENVIO",
      "ENTREGADO",
      "ANULADO",
      "PAGADO",
    ];
    const eventsWithoutOrderStatus = Object.values(WHATSAPP_NOTIFICATION_EVENTS).filter(
      (event) => !orderStatuses.includes(event),
    );
    expect(eventsWithoutOrderStatus).toEqual([
      "GUIA_CREADA",
      "EN_AGENCIA",
      "EN_REPARTO",
      "INCIDENCIA",
      "SALDO_COD",
      "COMPROBANTE_ACEPTADO",
    ]);
  });
});
