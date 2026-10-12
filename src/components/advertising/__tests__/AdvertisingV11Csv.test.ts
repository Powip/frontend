import type { MetaCatalogRow } from "@/services/advertisingMetaService";
import {
  advertisingCsvCell,
  advertisingMetaTableCsv,
  advertisingMetaTableValues,
} from "../advertising-meta-table-model";

const row = {
  id: "123",
  accountId: "account",
  name: "=SUM(A1:A2)",
  currency: "PEN",
  insights: {
    results: { type: "messages", label: "Conversaciones", value: "8" },
    costPerResult: "12.5",
    ctr: "1.25",
    frequency: "3.2",
    frequencyApproximate: false,
    spend: "100",
    impressions: "2000",
    inlineLinkClicks: "25",
    reach: "625",
  },
} as MetaCatalogRow;
it("usa métricas de enlace y frecuencia del periodo entregadas por el servidor", () => {
  const values = advertisingMetaTableValues(row, "messages", null);
  expect(values.ctr).toBe("1.25 %");
  expect(values.frequency).toBe("3.2");
  expect(values.recommendation).toBe("Revisar frecuencia");
  expect(values.cpe).toBe("Pendiente");
});
it("CSV exporta las columnas visibles y evita ejecución de fórmulas", () => {
  const values = advertisingMetaTableValues(row, "messages", null);
  const basic = advertisingMetaTableCsv([{ row, values }], false);
  expect(basic).toContain('"\'=SUM(A1:A2)"');
  expect(basic).toContain('"CTR de enlace"');
  expect(basic).toContain('"Gasto"');
  expect(basic).not.toContain('"Impresiones"');
  expect(advertisingMetaTableCsv([{ row, values }], true)).toContain('"Impresiones"');
  for (const more of [true, false]) {
    const lines = advertisingMetaTableCsv(
      [{ row: { ...row, name: "Nombre" }, values }],
      more,
    ).split("\r\n");
    expect(lines[0].match(/"(?:[^"]|"")*"/g) ?? []).toHaveLength(
      (lines[1].match(/"(?:[^"]|"")*"/g) ?? []).length,
    );
    expect((lines[1].match(/"(?:[^"]|"")*"/g) ?? [])[10]).toBe(`"${values.availability}"`);
  }
  expect(advertisingCsvCell('"nombre"')).toBe('"""nombre"""');
});

it("mantiene un resultado sin medir como no disponible aunque la cobertura esté completa", () => {
  const unknown = {
    ...row,
    insights: {
      ...row.insights,
      results: { type: "other", label: "Otros resultados", value: null },
      coverage: { status: "complete" },
    },
  } as MetaCatalogRow;
  expect(advertisingMetaTableValues(unknown, "messages", null).availability).toBe("No disponible");
});
