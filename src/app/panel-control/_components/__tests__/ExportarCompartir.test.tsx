import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import {
  renderWithPanel,
  TEST_SOURCES,
} from "@/components/panel-control/__tests__/render-with-panel";
import type { CompartirReporteResponse } from "@/features/panel-control/exportacion/models/exportacion.model";
import type { PanelSourceRegistry } from "@/features/panel-control/shared/data/panel-source";
import { DEFAULT_PANEL_STATE } from "@/features/panel-control/shared/state/panel-state.model";
import { PanelShell } from "../shell/PanelShell";

const toastSuccess = jest.fn();
const toastError = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    info: jest.fn(),
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));
const saveAs = jest.fn();
jest.mock("file-saver", () => ({ saveAs: (...args: unknown[]) => saveAs(...args) }));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});
beforeEach(() => {
  toastSuccess.mockClear();
  toastError.mockClear();
  saveAs.mockClear();
});

const TEXTO =
  "*Reporte POWIP · 2026-09-01 a 2026-09-21*\nVenta total: S/ 300.00 (4 pedidos)\nCPA: Sin dato";

const REPORTE: CompartirReporteResponse = {
  periodo: "2026-09-01 a 2026-09-21",
  ventaTotal: 300,
  pedidos: 4,
  producto: null,
  productoIncompleto: false,
  publicidad: null,
  envios: null,
  costoPorVenta: null,
  entregado: 200,
  efectividadEntrega: null,
  gananciaSobreEntregado: null,
  meDeben: 0,
  vencido: null,
  texto: TEXTO,
};

function fuentes(
  libro: () => Promise<{ archivo: Blob; nombreArchivo: string }>,
  reporte: CompartirReporteResponse = REPORTE,
): PanelSourceRegistry {
  return {
    ...TEST_SOURCES,
    "exportacion-libro": {
      contractId: "exportacion-libro",
      kind: "real",
      descripcion: "prueba",
      fetch: libro,
    },
    "compartir-reporte": {
      contractId: "compartir-reporte",
      kind: "real",
      descripcion: "prueba",
      fetch: async () => reporte,
    },
  };
}

const ok = async () => ({
  archivo: new Blob(["x"]),
  nombreArchivo: "powip_panel_2026-09-01_2026-09-21.xlsx",
});

function render(sources: PanelSourceRegistry) {
  const user = userEvent.setup();
  renderWithPanel(<PanelShell />, {
    sources,
    state: { ...DEFAULT_PANEL_STATE, navigation: { tab: "resumen", subtab: null } },
  });
  return user;
}

describe("Excel completo (real)", () => {
  it("descarga con el nombre que entrega la fuente", async () => {
    const user = render(fuentes(ok));
    await user.click(await screen.findByRole("button", { name: "Descargar Excel completo" }));
    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    expect(saveAs.mock.calls[0][1]).toBe("powip_panel_2026-09-01_2026-09-21.xlsx");
    expect(toastSuccess).toHaveBeenCalledWith(
      "Excel descargado: powip_panel_2026-09-01_2026-09-21.xlsx",
      expect.anything(),
    );
  });

  it("un 403 muestra el mensaje de sin permiso; un 400, el del servidor; un 503, servicio no disponible", async () => {
    const casos: [number, unknown, RegExp][] = [
      [403, { message: "Forbidden resource" }, /no tiene acceso/],
      [400, { message: "El rango no puede superar 180 días" }, /180 días/],
      [503, { message: "x" }, /no está disponible/],
    ];
    for (const [status, data, texto] of casos) {
      toastError.mockClear();
      const error = Object.assign(new Error(`Request failed with status code ${status}`), {
        response: { status, data },
      });
      const user = render(fuentes(() => Promise.reject(error)));
      await user.click(await screen.findByRole("button", { name: "Descargar Excel completo" }));
      await waitFor(() => expect(toastError).toHaveBeenCalled());
      expect(toastError.mock.calls[0][1]).toEqual({ description: expect.stringMatching(texto) });
      expect(saveAs).not.toHaveBeenCalled();
      document.body.innerHTML = "";
    }
  });

  it("muestra «Generando…» mientras descarga y no deja pulsar dos veces", async () => {
    let resolver: (v: Awaited<ReturnType<typeof ok>>) => void = () => {};
    const user = render(fuentes(() => new Promise((r) => (resolver = r))));
    const boton = await screen.findByRole("button", { name: "Descargar Excel completo" });
    await user.click(boton);
    expect(await screen.findByRole("button", { name: "Generando Excel completo" })).toBeDisabled();
    resolver(await ok());
    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
  });
});

describe("Compartir reporte (real)", () => {
  async function abrir(reporte?: CompartirReporteResponse) {
    const user = render(fuentes(ok, reporte));
    await user.click(await screen.findByRole("button", { name: "Compartir reporte" }));
    const dialogo = await screen.findByRole("dialog", { name: /Compartir reporte/ });
    await within(dialogo).findByText(/Venta total: S\//);
    return { user, dialogo };
  }

  it("copia el texto del backend tal cual, sin tocarlo", async () => {
    const { user, dialogo } = await abrir();
    const writeText = jest.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    await user.click(within(dialogo).getByRole("button", { name: /Copiar para WhatsApp/ }));
    expect(writeText).toHaveBeenCalledWith(TEXTO);
  });

  it("muestra «Sin dato» donde viene null: nunca 0 ni «S/ null»", async () => {
    const { dialogo } = await abrir();
    const cifras = within(dialogo).getByLabelText("Cifras del reporte");
    for (const nombre of [
      "Producto",
      "Publicidad",
      "Envíos",
      "Costo por venta (CPA)",
      "Ganancia real sobre entregado",
      "Vencido",
      "Efectividad de entrega",
    ]) {
      const fila = within(cifras).getByText(nombre).parentElement as HTMLElement;
      expect(fila).toHaveTextContent("Sin dato");
    }
    expect(dialogo.textContent).not.toMatch(/null|S\/ 0\b|NaN/);
  });

  it("una sola ganancia, sin «sobre venta total» ni la nota de las dos ganancias", async () => {
    const { dialogo } = await abrir({ ...REPORTE, gananciaSobreEntregado: 127 });
    expect(within(dialogo).getAllByText(/Ganancia/)).toHaveLength(1);
    expect(dialogo.textContent).not.toMatch(/sobre venta total|dos ganancias/i);
    expect(
      within(within(dialogo).getByLabelText("Cifras del reporte")).getByText("S/ 127.00"),
    ).toBeInTheDocument();
  });

  it("ofrece el Excel completo y no muestra el badge Demo", async () => {
    const { user, dialogo } = await abrir();
    expect(within(dialogo).queryByText(/demo/i)).toBeNull();
    await user.click(within(dialogo).getByRole("button", { name: "Excel completo" }));
    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
  });
});
