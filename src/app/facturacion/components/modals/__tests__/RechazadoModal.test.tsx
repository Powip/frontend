import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RechazadoModal from "@/app/facturacion/components/modals/RechazadoModal";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";
import { useReleaseSunatIssuerAccessBlock } from "@/features/sunat/sunat-issuer-access/hooks/use-release-sunat-issuer-access-block";
import { useSunatIssuerAccessBlocks } from "@/features/sunat/sunat-issuer-access/hooks/use-sunat-issuer-access-blocks";

jest.mock("@/features/sunat/sunat-issuer-access/hooks/use-sunat-issuer-access-blocks");
jest.mock("@/features/sunat/sunat-issuer-access/hooks/use-release-sunat-issuer-access-block");

const releaseMutate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useSunatIssuerAccessBlocks as jest.Mock).mockReturnValue({ data: [] });
  (useReleaseSunatIssuerAccessBlock as jest.Mock).mockReturnValue({
    mutate: releaseMutate,
    isPending: false,
  });
});

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

describe("RechazadoModal: SUNAT no autorizó al emisor", () => {
  const invoiceBlock = {
    sunatProfileId: "profile-1",
    rucIssuer: "20123456789",
    razonSocial: "EMPRESA UNO S.A.C.",
    solUser: "FACTURA1",
    taxDocumentType: "01",
    category: "AUTHORIZATION",
    sunatCode: "0111",
    sunatMessage: "No tiene el perfil para enviar comprobantes electronicos",
    heldDocuments: 2,
  };

  function invoiceRow(cdrStatus: "PENDING" | "RETRY_EXCEEDED"): TaxDocumentRow {
    return {
      sale: {
        orderNumber: "ORD-200",
        grandTotal: 236,
        customer: { fullName: "CLIENTE EMPRESA S.A.C." },
      },
      taxDocument: {
        id: "doc-2",
        rucIssuer: "20123456789",
        taxDocumentType: "01",
        series: "F001",
        correlative: "00000007",
        cdrStatus,
        observations: null,
        sunatCode: "0111",
        sunatDescription: "No tiene el perfil para enviar comprobantes electronicos",
      },
    } as unknown as TaxDocumentRow;
  }

  it("factura en espera: explica la causa, el usuario SOL y los pasos, y no ofrece corregir el comprobante", async () => {
    (useSunatIssuerAccessBlocks as jest.Mock).mockReturnValue({ data: [invoiceBlock] });
    renderModal(invoiceRow("PENDING"));

    expect(screen.getByText("SUNAT no autorizó el envío")).toBeInTheDocument();
    expect(
      screen.getByText(/no tiene permiso para enviar comprobantes electrónicos/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Código 0111 de SUNAT/)).toBeInTheDocument();
    expect(screen.getByText("FACTURA1")).toBeInTheDocument();
    expect(screen.getByText(/se corrige en SUNAT, no en Powip/)).toBeInTheDocument();
    expect(screen.getByText(/usuario principal del RUC/)).toBeInTheDocument();
    expect(screen.getByText(/en espera con su número F001-00000007/)).toBeInTheDocument();
    expect(screen.queryByText("Comprobante Rechazado")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Corregir y reintentar/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Ya lo corregí en SUNAT/ }));

    expect(releaseMutate).toHaveBeenCalledWith({
      sunatProfileId: "profile-1",
      taxDocumentType: "01",
    });
  });

  it("factura que ya falló antes (reintentos agotados con 0111): explica lo mismo y avisa que se emite con número nuevo", async () => {
    const onReintentar = jest.fn();
    const row = invoiceRow("RETRY_EXCEEDED");
    render(<RechazadoModal isOpen onClose={jest.fn()} row={row} onReintentar={onReintentar} />);

    expect(screen.getByText("SUNAT no autorizó el envío")).toBeInTheDocument();
    expect(screen.getByText(/usará un número nuevo/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Corregir y reintentar/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Ya lo corregí — volver a emitir/ }));

    expect(onReintentar).toHaveBeenCalledWith(row);
    expect(releaseMutate).not.toHaveBeenCalled();
  });

  it("una boleta pendiente del mismo RUC no se trata como bloqueada: el bloqueo es solo de facturas", () => {
    (useSunatIssuerAccessBlocks as jest.Mock).mockReturnValue({ data: [invoiceBlock] });
    const receipt = invoiceRow("PENDING");
    (receipt.taxDocument as { taxDocumentType: string }).taxDocumentType = "03";
    (receipt.taxDocument as { sunatCode: string | null }).sunatCode = null;
    renderModal(receipt);

    expect(screen.queryByText("SUNAT no autorizó el envío")).not.toBeInTheDocument();
  });
});
