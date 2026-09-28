import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DetalleGrupo } from "@/features/panel-control/detalle/models/detalle.model";
import { detalleDemoSource } from "@/features/panel-control/detalle/sources/detalle.demo";
import type { ExportTablaRequest } from "@/features/panel-control/exportacion/models/exportacion.model";
import {
  buildTableWorkbook,
  tableFileName,
} from "@/features/panel-control/exportacion/services/export-table.service";
import { grupos } from "@/features/panel-control/resumen/resumen-grupos";
import type { PanelSource } from "@/features/panel-control/shared/data/panel-source";
import { usePanel } from "@/features/panel-control/shared/state/panel-context";
import { DEFAULT_PANEL_STATE } from "@/features/panel-control/shared/state/panel-state.model";
import { DetailDrawer } from "../DetailDrawer";
import { renderWithPanel, TEST_SOURCES } from "./render-with-panel";

const exportTable = jest.fn((request: ExportTablaRequest) => tableFileName(request));
jest.mock("@/features/panel-control/exportacion/services/export-table.service", () => {
  const real = jest.requireActual(
    "@/features/panel-control/exportacion/services/export-table.service",
  );
  return { ...real, exportTable: (request: ExportTablaRequest) => exportTable(request) };
});

const toastSuccess = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    info: jest.fn(),
    success: (...args: unknown[]) => toastSuccess(...args),
    error: jest.fn(),
  },
}));

function Abrir({ grupo }: { grupo: DetalleGrupo }) {
  const { openDrilldown } = usePanel();
  return (
    <button type="button" onClick={() => openDrilldown(grupo)}>
      Abrir detalle
    </button>
  );
}

describe("Exportación del detalle a Excel", () => {
  beforeEach(() => {
    exportTable.mockClear();
    toastSuccess.mockClear();
  });

  it("descarga todas las páginas del grupo con sus filtros y marca DEMO", async () => {
    const paginas: number[] = [];
    const detalle: PanelSource<"detalle"> = {
      ...detalleDemoSource,
      fetch: (query, context) => {
        if (query.tamano_pagina === 500) paginas.push(query.pagina);
        return detalleDemoSource.fetch(query, context);
      },
    };
    const user = userEvent.setup();
    const grupo = grupos.ventas();
    renderWithPanel(
      <>
        <Abrir grupo={grupo} />
        <DetailDrawer />
      </>,
      {
        sources: { ...TEST_SOURCES, detalle },
        state: {
          ...DEFAULT_PANEL_STATE,
          filters: {
            ...DEFAULT_PANEL_STATE.filters,
            zona: "lima",
            periodo: {
              preset: "personalizado",
              personalizado: { desde: "2026-07-01", hasta: "2026-09-21" },
            },
          },
        },
      },
    );
    await user.click(screen.getByRole("button", { name: "Abrir detalle" }));
    const dialogo = await screen.findByRole("dialog", { name: /Ventas/ });
    const boton = await within(dialogo).findByRole("button", {
      name: /^Excel · .* pedidos \(demo\)$/,
    });
    const total = Number(
      boton.textContent?.match(/Excel · ([\d,.]+) pedidos/)?.[1].replace(/[,.]/g, ""),
    );
    expect(total).toBeGreaterThan(500);

    await user.click(boton);
    await waitFor(() => expect(exportTable).toHaveBeenCalledTimes(1));

    const request = exportTable.mock.calls[0][0];
    expect(request.filas).toHaveLength(total);
    expect(new Set(request.filas.map((fila) => fila[0])).size).toBe(total);
    expect(paginas).toEqual(
      Array.from({ length: Math.ceil(total / 500) }, (_, index) => index + 1),
    );
    expect(request.filtros).toMatch(/Zona: Lima/);
    expect(request.periodo).toMatch(/1 jul – 21 set 2026/);
    expect(request.origen).toBe("demo");
    expect(tableFileName(request)).toMatch(/_DEMO\.xlsx$/);
    const hoja = Object.values(buildTableWorkbook(request).Sheets)[0];
    expect(String(hoja.B6?.v)).toMatch(/^DATOS DEMO/);
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringMatching(/_DEMO\.xlsx$/),
      expect.anything(),
    );
  });
});
