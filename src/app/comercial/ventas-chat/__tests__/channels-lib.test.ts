import { telHref, toLocalPhone } from "@/lib/crmPhone";
import {
  META_WINDOW_CLOSED_NOTICE,
  WINDOW_CLOSED_NOTICE,
  contactLabel,
  crearPedidoUrl,
  phoneForCustomer,
  windowClosedNotice,
} from "@/components/ventas-chat/format";
import { answeredPercent, formatCallDuration, toSeconds } from "@/components/ventas-chat/calls";

describe("phoneForCustomer", () => {
  it("WhatsApp: usa contactPhone", () => {
    expect(
      phoneForCustomer({ channel: "whatsapp", contactPhone: "51999111222", customerPhone: null }),
    ).toBe("51999111222");
  });
  it("sin canal se comporta como WhatsApp", () => {
    expect(phoneForCustomer({ contactPhone: "51999111222" })).toBe("51999111222");
  });
  it("Messenger e Instagram: usa customerPhone y nunca el identificador", () => {
    expect(
      phoneForCustomer({
        channel: "instagram",
        contactPhone: "17841400000000",
        customerPhone: "+51 988 777 666",
      }),
    ).toBe("+51 988 777 666");
    expect(
      phoneForCustomer({ channel: "messenger", contactPhone: "6100200300", customerPhone: null }),
    ).toBeNull();
    expect(
      phoneForCustomer({ channel: "messenger", contactPhone: "6100200300", customerPhone: "  " }),
    ).toBeNull();
  });
});

describe("crearPedidoUrl", () => {
  it("WhatsApp manda crmPhone con el contactPhone", () => {
    const q = new URLSearchParams(
      crearPedidoUrl({ id: "c1", channel: "whatsapp", contactPhone: "51999", customerPhone: null }).split("?")[1],
    );
    expect(q.get("crmPhone")).toBe("51999");
    expect(q.get("crmConversationId")).toBe("c1");
  });
  it("Instagram con teléfono guardado manda ese teléfono; sin él, no manda crmPhone", () => {
    const withPhone = new URLSearchParams(
      crearPedidoUrl({ id: "c2", channel: "instagram", contactPhone: "1784", customerPhone: "999111222" }).split("?")[1],
    );
    expect(withPhone.get("crmPhone")).toBe("999111222");
    const without = new URLSearchParams(
      crearPedidoUrl({ id: "c2", channel: "instagram", contactPhone: "1784", customerPhone: null }).split("?")[1],
    );
    expect(without.has("crmPhone")).toBe(false);
  });
});

describe("contactLabel y avisos de ventana", () => {
  it("sin nombre en Instagram no muestra el identificador", () => {
    expect(contactLabel({ channel: "instagram", contactName: null, contactPhone: "1784" })).toBe(
      "Contacto de Instagram",
    );
    expect(contactLabel({ channel: "whatsapp", contactName: null, contactPhone: "51999" })).toBe("51999");
    expect(contactLabel({ contactName: " Ana ", contactPhone: "51999" })).toBe("Ana");
  });
  it("el aviso depende del canal", () => {
    expect(windowClosedNotice({ channel: "whatsapp" })).toBe(WINDOW_CLOSED_NOTICE);
    expect(windowClosedNotice({ channel: "messenger" })).toBe(META_WINDOW_CLOSED_NOTICE);
    expect(META_WINDOW_CLOSED_NOTICE).toMatch(/7 días/);
  });
});

describe("telHref", () => {
  it("arma tel:+código; 9 dígitos se toman como Perú", () => {
    expect(telHref("51999111222")).toBe("tel:+51999111222");
    expect(telHref("999 111 222")).toBe("tel:+51999111222");
    expect(telHref("+57 300 123 4567")).toBe("tel:+573001234567");
  });
  it("devuelve null para vacío, corto o identificadores largos de Instagram", () => {
    expect(telHref(null)).toBeNull();
    expect(telHref("123")).toBeNull();
    expect(telHref("17841400000000000")).toBeNull();
  });
  it("toLocalPhone sigue igual", () => {
    expect(toLocalPhone("51999111222")).toBe("999111222");
  });
});

describe("calls helpers", () => {
  it("formatCallDuration", () => {
    expect(formatCallDuration(null)).toBe("—");
    expect(formatCallDuration(45)).toBe("45 s");
    expect(formatCallDuration(120)).toBe("2 min");
    expect(formatCallDuration(130)).toBe("2 min 10 s");
  });
  it("toSeconds", () => {
    expect(toSeconds("", "")).toBeUndefined();
    expect(toSeconds("2", "10")).toBe(130);
    expect(toSeconds("", "30")).toBe(30);
  });
  it("answeredPercent", () => {
    expect(answeredPercent(0, 0)).toBe(0);
    expect(answeredPercent(10, 7)).toBe(70);
  });
});
