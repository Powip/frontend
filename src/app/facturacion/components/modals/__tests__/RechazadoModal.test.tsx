import { render, screen } from "@testing-library/react";
import RechazadoModal from "@/app/facturacion/components/modals/RechazadoModal";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";

const DESCRIPCION_1033 =
  '1033 - El comprobante fue registrado previamente con otros datos - Detalle: value=\'ticket: 8c31b772-c24f-4565-8b14-f389eeb3e4e7, error: INFO: (nodo: "/Invoice/cbc:ID" valor: "B001-1501")\'';

function buildRow(sunat: {
  sunatCode: string | null;
  sunatDescription: string | null;
}): TaxDocumentRow {
  return {
    sale: {
      orderNumber: "ORD-156099",
      grandTotal: 169,
      customer: { fullName: "CLIENTE DE PRUEBA" },
    },
    taxDocument: {
      id: "doc-1",
      series: "B001",
      correlative: "00001501",
      cdrStatus: "REJECTED",
      observations: null,
      ...sunat,
    },
  } as unknown as TaxDocumentRow;
}

function renderModal(row: TaxDocumentRow) {
  render(<RechazadoModal isOpen onClose={jest.fn()} row={row} onReintentar={jest.fn()} />);
}

describe("RechazadoModal: solución sugerida", () => {
  it("para el 1033 explica que el número ya existe en SUNAT, no que el comprobante es válido", () => {
    renderModal(
      buildRow({ sunatCode: "soap-env:Client.1033", sunatDescription: DESCRIPCION_1033 }),
    );

    expect(screen.getByText(/solución sugerida/i)).toBeInTheDocument();
    expect(screen.getByText(/otro sistema/i)).toBeInTheDocument();
    expect(screen.queryByText(/comprobante válido/i)).not.toBeInTheDocument();
  });

  it("no muestra ninguna solución para un error que no está en el catálogo", () => {
    renderModal(
      buildRow({
        sunatCode: "soap-env:Client.4321",
        sunatDescription: "4321 - Error desconocido 100",
      }),
    );

    expect(screen.queryByText(/solución sugerida/i)).not.toBeInTheDocument();
    expect(screen.getByText(/4321 - Error desconocido 100/)).toBeInTheDocument();
  });

  it("para un código del catálogo (2335) sigue mostrando su solución", () => {
    renderModal(buildRow({ sunatCode: "2335", sunatDescription: "El RUC del receptor no existe" }));

    expect(screen.getByText(/re-verificar el ruc/i)).toBeInTheDocument();
  });
});
