import { ESTADOS_PANEL_DEFINICION } from "../estados.config";
import { GLOSARIO } from "../glosario.config";

/**
 * En Powip y en /ventas un pedido confirmado que aún no se prepara se llama «Pendiente»; el panel
 * llamaba «Pendiente» al lead sin confirmar y «Llamado» a esa venta, y el mismo pedido se veía con
 * dos nombres. El panel dice «Por confirmar» (lead) y «Confirmado» (venta sin preparar). Solo cambian
 * las etiquetas y los textos: las claves del contrato (PENDIENTE, LLAMADO…) no se tocan.
 */
describe("vocabulario de estados del panel", () => {
  it("el lead sin confirmar es «Por confirmar» y la venta confirmada sin preparar es «Confirmado»", () => {
    expect(ESTADOS_PANEL_DEFINICION.PENDIENTE.etiqueta).toBe("Por confirmar");
    expect(ESTADOS_PANEL_DEFINICION.LLAMADO.etiqueta).toBe("Confirmado");
  });

  it("las claves del contrato siguen siendo las mismas", () => {
    expect(Object.keys(ESTADOS_PANEL_DEFINICION)).toEqual([
      "PENDIENTE",
      "LLAMADO",
      "PREPARADO",
      "CON_GUIA",
      "EN_ENVIO",
      "ENTREGADO",
      "PAGADO",
      "ANULADO",
      "RECHAZADO",
    ]);
    expect(ESTADOS_PANEL_DEFINICION.PENDIENTE.esVenta).toBe(false);
    expect(ESTADOS_PANEL_DEFINICION.LLAMADO.esVenta).toBe(true);
  });

  it("ninguna etiqueta visible usa los nombres que chocaban con Powip", () => {
    const etiquetas = Object.values(ESTADOS_PANEL_DEFINICION).map((d) => d.etiqueta);
    expect(etiquetas).not.toContain("Pendiente");
    expect(etiquetas).not.toContain("Llamado");
  });

  it("«Confirmado» aclara que en /ventas se ve como «Pendiente» hasta que se prepara", () => {
    expect(ESTADOS_PANEL_DEFINICION.LLAMADO.descripcion).toMatch(/Pendiente/);
    expect(ESTADOS_PANEL_DEFINICION.LLAMADO.descripcion).toMatch(/\/ventas/);
  });

  it("el glosario habla con las etiquetas de pantalla, no con las claves crudas", () => {
    const crudas = /\b(LLAMADO|PENDIENTE|PREPARADO|CON_GUIA|EN_ENVIO)\b/;
    for (const [id, entrada] of Object.entries(GLOSARIO)) {
      expect({ id, usaClaveCruda: crudas.test(entrada.definicion) }).toEqual({
        id,
        usaClaveCruda: false,
      });
    }
  });

  it("el glosario de «Lead» aclara que las ventas directas no son leads", () => {
    expect(GLOSARIO.lead.definicion).toMatch(/Por confirmar/);
    expect(GLOSARIO.lead.definicion).toMatch(/ventas directas/i);
  });
});
