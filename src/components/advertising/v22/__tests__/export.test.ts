import { exportAdsWorkbook } from "../shared";
import ExcelJS from "exceljs";
jest.mock("uuid", () => ({ v4: () => "f1111111-1111-4111-8111-111111111111" }));

describe("native Excel export", () => {
  it("writes a readable XLSX workbook with only the current export rows and safe text", async () => {
    let captured: Blob | undefined;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: (blob: Blob) => {
        captured = blob;
        return "blob:export";
      },
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: jest.fn() });
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await exportAdsWorkbook("POWIP_Anuncios_2026-10-01_2026-10-16", [
      {
        name: "Conjuntos",
        rows: [
          {
            Nombre: "=1+1",
            Tienda: "Tienda elegida",
            Gasto: 125.5,
            Estado: "Pausado",
            "Publicidad / margen": Infinity,
          },
        ],
      },
    ]);
    expect(captured?.type).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const data = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(captured!);
    });
    expect([...new Uint8Array(data).slice(0, 2)]).toEqual([80, 75]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(data);
    const sheet = workbook.getWorksheet("Conjuntos")!;
    expect(sheet.rowCount).toBe(2);
    expect(sheet.getCell("A2").value).toBe("'=1+1");
    expect(sheet.getCell("B2").value).toBe("Tienda elegida");
    expect(sheet.getCell("C2").value).toBe(125.5);
    expect(sheet.getCell("E2").value).toBe("Sin margen");
    expect(sheet.columns.map((column) => column.header)).not.toContain("Ganancia");
    click.mockRestore();
  });
});
