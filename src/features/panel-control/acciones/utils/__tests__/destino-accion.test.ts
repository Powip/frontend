import { ACCIONES_PEDIDO } from "../../models/accion-pedido.model";
import { destinoAccion, mensajeAccion } from "../destino-accion";

describe("mensajeAccion", () => {
  const vacios = [
    {},
    { pedido: undefined, courier: null, monto: null, telefono: null },
    { monto: Number.NaN },
    { pedido: "  ", courier: " " },
  ];
  it.each(ACCIONES_PEDIDO)("%s nunca escribe undefined, null ni NaN", (accion) => {
    for (const datos of vacios) {
      expect(mensajeAccion(accion, datos)).not.toMatch(/undefined|null|NaN/);
    }
    expect(mensajeAccion(accion, { pedido: "V-1", courier: "Shalom", monto: 120 })).not.toMatch(
      /undefined|null|NaN/,
    );
  });

  it("incluye pedido, courier y monto cuando existen", () => {
    expect(mensajeAccion("avisar_cliente", { pedido: "V-100" })).toContain("V-100");
    expect(mensajeAccion("reclamar_courier", { courier: "Shalom", pedido: "V-7" })).toMatch(
      /Shalom.*V-7/,
    );
    expect(mensajeAccion("pedir_liquidacion", { courier: "Olva", monto: 1500 })).toMatch(
      /Olva.*1.?500/,
    );
  });
});

describe("destinoAccion", () => {
  it("lleva a las pantallas existentes", () => {
    expect(destinoAccion("preparar", { pedido: "V-1" })).toEqual({
      tipo: "enlace",
      href: "/operaciones/pedidos?tab=pendientes&q=V-1",
    });
    expect(destinoAccion("asignar_guia")).toEqual({
      tipo: "enlace",
      href: "/operaciones/pedidos?tab=despachar",
    });
    expect(destinoAccion("coordinar_recojo")?.href).toBe("/operaciones/guias?tab=agenda");
    expect(destinoAccion("reclamar_courier")?.href).toBe("/operaciones/liquidaciones");
    expect(destinoAccion("pedir_liquidacion")?.href).toBe("/operaciones/liquidaciones");
    expect(destinoAccion("llamar")?.href).toBe("/atencion-cliente");
  });

  it("codifica el número de pedido en la búsqueda", () => {
    expect(destinoAccion("asignar_guia", { pedido: "A&B 1" })?.href).toBe(
      "/operaciones/pedidos?tab=despachar&q=A%26B%201",
    );
  });

  it("avisar al cliente abre WhatsApp, con teléfono si lo hay y sin él si no", () => {
    const con = destinoAccion("avisar_cliente", { pedido: "V-1", telefono: "987654321" });
    expect(con?.tipo).toBe("whatsapp");
    expect(con?.href).toMatch(/^https:\/\/wa\.me\/51987654321\?text=/);
    expect(destinoAccion("avisar_cliente", { pedido: "V-1" })?.href).toMatch(
      /^https:\/\/wa\.me\/\?text=/,
    );
  });

  it("completar motivo y asignar canal siguen sin destino", () => {
    expect(destinoAccion("completar_motivo")).toBeNull();
    expect(destinoAccion("asignar_canal")).toBeNull();
  });
});
