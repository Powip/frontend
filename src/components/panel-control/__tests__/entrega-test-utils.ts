import {
  PANEL_SECCIONES_OCULTAS,
  type PanelSeccionOculta,
} from "@/features/panel-control/shared/config/panel-entrega.config";

/**
 * Para los tests de secciones que hoy se retienen de la entrega: las muestra todas durante el
 * archivo (equivale a vaciar `PANEL_SECCIONES_OCULTAS`) y restaura la lista al terminar.
 */
export function mostrarTodasLasSeccionesEnEsteArchivo() {
  let guardadas: PanelSeccionOculta[] = [];
  beforeAll(() => {
    guardadas = PANEL_SECCIONES_OCULTAS.splice(0, PANEL_SECCIONES_OCULTAS.length);
  });
  afterAll(() => {
    PANEL_SECCIONES_OCULTAS.splice(0, PANEL_SECCIONES_OCULTAS.length, ...guardadas);
  });
}
