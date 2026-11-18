import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RechazadoModal from "@/app/facturacion/components/modals/RechazadoModal";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";
import { useReleaseSunatIssuerAccessBlock } from "@/features/sunat/sunat-issuer-access/hooks/use-release-sunat-issuer-access-block";
import { useSunatIssuerAccessBlocks } from "@/features/sunat/sunat-issuer-access/hooks/use-sunat-issuer-access-blocks";
import { useSunatProfiles } from "@/features/sunat/sunat-profile/hooks/use-sunat-profiles";
import { useUpdateSunatProfileEstablishmentCode } from "@/features/sunat/sunat-profile/hooks/use-update-sunat-profile-establishment-code";

jest.mock("@/features/sunat/sunat-issuer-access/hooks/use-sunat-issuer-access-blocks");
jest.mock("@/features/sunat/sunat-issuer-access/hooks/use-release-sunat-issuer-access-block");
jest.mock("@/features/sunat/sunat-profile/hooks/use-sunat-profiles");
jest.mock("@/features/sunat/sunat-profile/hooks/use-update-sunat-profile-establishment-code");

const releaseMutate = jest.fn();
const updateMutate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useSunatIssuerAccessBlocks as jest.Mock).mockReturnValue({ data: [] });
  (useReleaseSunatIssuerAccessBlock as jest.Mock).mockReturnValue({
    mutate: releaseMutate,
    isPending: false,
  });
  (useSunatProfiles as jest.Mock).mockReturnValue({
    isLoading: false,
    data: [{ id: "profile-1", ruc: "20123456789", establishmentCode: "" }],
  });
  (useUpdateSunatProfileEstablishmentCode as jest.Mock).mockReturnValue({
    mutate: updateMutate,
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
      rucIssuer: "20123456789",
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

  it("para el 3030 (código solo en el detalle) muestra el mensaje claro, la solución y el detalle decodificado", () => {
    renderModal(
      buildRow({
        sunatCode: null,
        sunatDescription:
          'El XML no contiene el tag o no existe informaci&#243;n del c&#243;digo de local anexo del emisor - Detalle: xxx.xxx.xxx value=\'ticket: 202622558884729 error: INFO: 3030 (nodo: "cac:RegistrationAddress/cbc:AddressTypeCode" valor: "")\'',
      }),
    );

    expect(screen.getByText("Falta el código de local anexo del emisor")).toBeInTheDocument();
    expect(screen.getByText(/usa 0000 si es la casa matriz/)).toBeInTheDocument();
    expect(
      screen.getByText(/Detalle de SUNAT:.*no existe información del código/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/&#243;/)).not.toBeInTheDocument();
  });

  it("3030: deja corregir el código de establecimiento en el mismo modal y guarda 0000 con el emisor", async () => {
    renderModal(
      buildRow({
        sunatCode: null,
        sunatDescription:
          'valor: error: INFO: 3030 (nodo: "cac:RegistrationAddress/cbc:AddressTypeCode")',
      }),
    );

    const input = screen.getByLabelText(/código de establecimiento del emisor/i);
    expect(input).toHaveValue("0000");

    await userEvent.click(screen.getByRole("button", { name: /Guardar código y volver a emitir/ }));

    expect(updateMutate).toHaveBeenCalledWith(
      { id: "profile-1", establishmentCode: "0000" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("3030: no deja guardar un código de menos de 4 dígitos", async () => {
    renderModal(
      buildRow({
        sunatCode: null,
        sunatDescription: 'error: INFO: 3030 (nodo: "cac:RegistrationAddress/cbc:AddressTypeCode")',
      }),
    );

    const input = screen.getByLabelText(/código de establecimiento del emisor/i);
    await userEvent.clear(input);
    await userEvent.type(input, "7");
    await userEvent.click(screen.getByRole("button", { name: /Guardar código y volver a emitir/ }));

    expect(screen.getByText(/debe tener 4 dígitos/i)).toBeInTheDocument();
    expect(updateMutate).not.toHaveBeenCalled();
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
