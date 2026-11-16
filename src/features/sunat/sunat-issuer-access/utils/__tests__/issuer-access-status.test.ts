import type { SunatDocument } from "../../../sunat-document/models/sunat-document.model";
import type { TaxDocumentRow } from "../../../sunat-document/types/tax-document-row";
import type { SunatIssuerAccessBlock } from "../../models/sunat-issuer-access-block";
import {
  findAcceptedTypesOfIssuer,
  findBlockForDocument,
  getIssuerAccessState,
} from "../issuer-access-status";

const RUC = "20123456789";
const OTHER_RUC = "20987654321";

const invoiceBlock = {
  rucIssuer: RUC,
  taxDocumentType: "01",
  sunatCode: "0111",
} as SunatIssuerAccessBlock;

function document(overrides: Partial<SunatDocument>): SunatDocument {
  return {
    id: "doc",
    rucIssuer: RUC,
    taxDocumentType: "01",
    series: "F001",
    correlative: "00000001",
    cdrStatus: "PENDING",
    sunatCode: null,
    createdAt: "2026-11-16T10:00:00Z",
    ...overrides,
  } as SunatDocument;
}

const row = (taxDocument: SunatDocument): TaxDocumentRow =>
  ({ sale: { id: taxDocument.id }, taxDocument }) as unknown as TaxDocumentRow;

describe("findBlockForDocument", () => {
  it("el bloqueo aplica solo al mismo RUC y al mismo tipo de comprobante", () => {
    expect(findBlockForDocument([invoiceBlock], document({}))).toBe(invoiceBlock);
    expect(
      findBlockForDocument([invoiceBlock], document({ taxDocumentType: "03" })),
    ).toBeUndefined();
    expect(
      findBlockForDocument([invoiceBlock], document({ rucIssuer: OTHER_RUC })),
    ).toBeUndefined();
    expect(findBlockForDocument([invoiceBlock], undefined)).toBeUndefined();
  });
});

describe("getIssuerAccessState", () => {
  it("factura pendiente de un RUC bloqueado para facturas: en espera", () => {
    expect(getIssuerAccessState([invoiceBlock], document({}))).toBe("WAITING");
  });

  it("boleta pendiente del mismo RUC: se está procesando normal", () => {
    expect(getIssuerAccessState([invoiceBlock], document({ taxDocumentType: "03" }))).toBeNull();
  });

  it("comprobante que ya había fallado por permisos (antes de la espera): falló por el emisor", () => {
    expect(
      getIssuerAccessState([], document({ cdrStatus: "RETRY_EXCEEDED", sunatCode: "0111" })),
    ).toBe("FAILED");
  });

  it("reintentos agotados por otra causa (sin código de permisos) no se confunde", () => {
    expect(
      getIssuerAccessState([], document({ cdrStatus: "RETRY_EXCEEDED", sunatCode: null })),
    ).toBeNull();
  });

  it("un rechazo de contenido no es un problema del emisor", () => {
    expect(
      getIssuerAccessState([invoiceBlock], document({ cdrStatus: "REJECTED", sunatCode: "2800" })),
    ).toBeNull();
  });
});

describe("findAcceptedTypesOfIssuer", () => {
  it("dice qué otros tipos SÍ acepta SUNAT para ese RUC, con el último número aceptado", () => {
    const rows = [
      row(
        document({
          id: "b1",
          taxDocumentType: "03",
          series: "B001",
          correlative: "00000011",
          cdrStatus: "ACCEPTED",
          createdAt: "2026-11-15T10:00:00Z",
        }),
      ),
      row(
        document({
          id: "b2",
          taxDocumentType: "03",
          series: "B001",
          correlative: "00000012",
          cdrStatus: "ACCEPTED",
          createdAt: "2026-11-16T09:00:00Z",
        }),
      ),
      row(document({ id: "f1" })),
    ];

    expect(findAcceptedTypesOfIssuer(rows, invoiceBlock)).toEqual([
      { taxDocumentType: "03", lastNumber: "B001-00000012" },
    ]);
  });

  it("no cuenta boletas de otro RUC ni boletas que no fueron aceptadas", () => {
    const rows = [
      row(
        document({ id: "b1", rucIssuer: OTHER_RUC, taxDocumentType: "03", cdrStatus: "ACCEPTED" }),
      ),
      row(document({ id: "b2", taxDocumentType: "03", cdrStatus: "REJECTED" })),
    ];

    expect(findAcceptedTypesOfIssuer(rows, invoiceBlock)).toEqual([]);
  });
});
