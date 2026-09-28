import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTable, type DataTableColumn } from "../DataTable";
import { renderWithPanel } from "./render-with-panel";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), info: jest.fn() } }));

interface ExportRequestMinimo {
  columnas: { id: string }[];
  origen: string;
}

const exportTable = jest.fn<string, [ExportRequestMinimo]>(() => "archivo.xlsx");
jest.mock("@/features/panel-control/exportacion/services/export-table.service", () => ({
  exportTable: (request: ExportRequestMinimo) => exportTable(request),
}));

interface Fila {
  id: string;
  nombre: string;
  monto: number;
  margen: number;
}

const columnas: DataTableColumn<Fila>[] = [
  {
    id: "nombre",
    header: "Nombre",
    align: "left",
    cell: (fila) => fila.nombre,
    sortValue: (fila) => fila.nombre,
    exportValue: (fila) => fila.nombre,
  },
  {
    id: "monto",
    header: "Monto",
    cell: (fila) => String(fila.monto),
    sortValue: (fila) => fila.monto,
    exportValue: (fila) => fila.monto,
    exportFormat: "soles",
  },
  {
    id: "margen",
    header: "Margen",
    capability: "ver_costos",
    cell: (fila) => `${fila.margen}%`,
    exportValue: (fila) => fila.margen,
  },
];

const filas = (n: number): Fila[] =>
  Array.from({ length: n }, (_, index) => ({
    id: String(index),
    nombre: `Fila ${String.fromCharCode(65 + index)}`,
    monto: (index % 5) * 10 + index,
    margen: index,
  }));

const nombresVisibles = () =>
  within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0].textContent);

describe("DataTable", () => {
  beforeEach(() => exportTable.mockClear());

  it("ordena con teclado desde el encabezado y expone aria-sort", async () => {
    const user = userEvent.setup();
    renderWithPanel(
      <DataTable
        caption="Prueba"
        columns={columnas}
        rows={filas(5)}
        getRowKey={(fila) => fila.id}
      />,
    );
    const encabezado = screen.getByRole("columnheader", { name: /monto/i });
    expect(encabezado).toHaveAttribute("aria-sort", "none");
    within(encabezado).getByRole("button").focus();
    await user.keyboard("{Enter}");
    expect(encabezado).toHaveAttribute("aria-sort", "descending");
    expect(nombresVisibles()[0]).toBe("Fila E");
    await user.keyboard("{Enter}");
    expect(encabezado).toHaveAttribute("aria-sort", "ascending");
    expect(nombresVisibles()[0]).toBe("Fila A");
  });

  it("no ofrece orden con 3 filas ni buscador con 12", () => {
    const { unmount } = renderWithPanel(
      <DataTable
        caption="Prueba"
        columns={columnas}
        rows={filas(3)}
        getRowKey={(fila) => fila.id}
      />,
    );
    expect(screen.queryByRole("button", { name: /monto/i })).not.toBeInTheDocument();
    unmount();
    renderWithPanel(
      <DataTable
        caption="Prueba"
        columns={columnas}
        rows={filas(12)}
        getRowKey={(fila) => fila.id}
      />,
    );
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("busca cuando hay más de 12 filas", async () => {
    const user = userEvent.setup();
    renderWithPanel(
      <DataTable
        caption="Prueba"
        columns={columnas}
        rows={filas(13)}
        getRowKey={(fila) => fila.id}
      />,
    );
    await user.type(screen.getByRole("searchbox", { name: /buscar en prueba/i }), "fila c");
    expect(nombresVisibles()).toEqual(["Fila C"]);
  });

  it("oculta y no exporta columnas de costo a roles sin permiso", async () => {
    const user = userEvent.setup();
    renderWithPanel(
      <DataTable
        caption="Prueba"
        columns={columnas}
        rows={filas(4)}
        getRowKey={(fila) => fila.id}
        exportar={{ titulo: "Prueba", nombreBase: "prueba", origen: "demo" }}
      />,
      { role: "supervisora" },
    );
    expect(screen.queryByRole("columnheader", { name: /margen/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /excel \(demo\)/i }));
    const [request] = exportTable.mock.calls[0];
    expect(request.columnas.map((columna) => columna.id)).toEqual(["nombre", "monto"]);
    expect(request.origen).toBe("demo");
  });

  it("muestra la columna de costo al Dueño", () => {
    renderWithPanel(
      <DataTable
        caption="Prueba"
        columns={columnas}
        rows={filas(4)}
        getRowKey={(fila) => fila.id}
      />,
    );
    expect(screen.getByRole("columnheader", { name: /margen/i })).toBeInTheDocument();
  });
});
