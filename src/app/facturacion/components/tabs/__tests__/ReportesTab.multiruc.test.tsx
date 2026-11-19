import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as XLSX from "xlsx";
import { ReportesTab } from "@/app/facturacion/components/tabs/ReportesTab";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";

jest.mock("xlsx", () => ({
  utils: {
    aoa_to_sheet: jest.fn(() => ({})),
    book_new: jest.fn(() => ({})),
    book_append_sheet: jest.fn(),
  },
  writeFile: jest.fn(),
}));
jest.mock("@/features/sunat/sunat-document/hooks/use-sunat-document-pdf", () => ({
  useSunatDocumentPdf: () => ({ mutate: jest.fn(), isPending: false, variables: undefined }),
}));
// FEAT-24 H12: las guías del reporte son las GRE reales de ms-sunat (ya no un prop del mock).
jest.mock("@/features/sunat/despatch-advice/hooks/use-despatch-advices", () => ({
  useDespatchAdvicesReport: () => ({ data: [], isError: false, refetch: jest.fn() }),
}));

const A = { ruc: "20111111111", razonSocial: "PRINCIPAL S.A.C." };
const B = { ruc: "20222222222", razonSocial: "SEGUNDA E.I.R.L." };

function row(id: string, ruc: string, series: string, correlative: string): TaxDocumentRow {
  return {
    sale: {
      id,
      grandTotal: 118,
      createdAt: "2026-11-15T10:00:00",
      customer: { fullName: `Cliente ${id}`, documentNumber: "45332211" },
    },
    taxDocument: {
      id: `doc-${id}`,
      rucIssuer: ruc,
      taxDocumentType: "03",
      series,
      correlative,
      cdrStatus: "ACCEPTED",
    },
  } as unknown as TaxDocumentRow;
}

// Two RUC can legitimately share series and number.
const rows = [row("1", A.ruc, "B001", "00000123"), row("2", B.ruc, "B001", "00000123")];

/** Rows (header first) handed to the Excel writer for the "Registro de Ventas" report. */
async function exportVentas(): Promise<(string | number)[][]> {
  await userEvent.click(screen.getAllByRole("button", { name: /Excel/i })[0]);

  return (XLSX.utils.aoa_to_sheet as jest.Mock).mock.calls.at(-1)[0];
}

describe("ReportesTab — multi-RUC", () => {
  beforeEach(() => jest.clearAllMocks());

  it("con varios RUC cada fila indica su RUC emisor, para distinguir números iguales", async () => {
    render(<ReportesTab comprobanteRows={rows} notas={[]} showIssuerColumn />);

    const [header, ...body] = await exportVentas();

    expect(header[0]).toBe("RUC Emisor");
    expect(body.map((line) => line[0])).toEqual([A.ruc, B.ruc]);
    expect(screen.getByText(/Incluyen todos tus RUC/)).toBeInTheDocument();
  });

  it("con un RUC elegido el reporte solo trae sus comprobantes y lo dice en el archivo", async () => {
    render(
      <ReportesTab comprobanteRows={rows} notas={[]} issuer={B} showIssuerColumn />,
    );

    const [, ...body] = await exportVentas();

    expect(body).toHaveLength(1);
    expect(body[0][0]).toBe(B.ruc);
    expect((XLSX.writeFile as jest.Mock).mock.calls.at(-1)[1]).toBe(
      "powip_registro_ventas_20222222222.xlsx",
    );
    expect(screen.getByText("SEGUNDA E.I.R.L.")).toBeInTheDocument();
  });

  it("con un solo RUC el reporte queda igual que antes, sin columna de emisor", async () => {
    render(<ReportesTab comprobanteRows={[rows[0]]} notas={[]} />);

    const [header] = await exportVentas();

    expect(header[0]).toBe("Fecha");
    expect((XLSX.writeFile as jest.Mock).mock.calls.at(-1)[1]).toBe("powip_registro_ventas.xlsx");
  });
});
