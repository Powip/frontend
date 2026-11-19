import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotaCreditoModal from "@/app/facturacion/components/modals/NotaCreditoModal";
import { NotasTab } from "@/app/facturacion/components/tabs/NotasTab";
import type { Order } from "@/features/sales/models/order";
import { useCreateSunatDocuments } from "@/features/sunat/sunat-document/hooks/use-create-sunat-documents";
import type { SunatDocument } from "@/features/sunat/sunat-document/models/sunat-document.model";
import { useSunatDocumentSequences } from "@/features/sunat/sunat-document-sequence/hooks/use-sunat-document-sequences";
import type { SunatProfile } from "@/features/sunat/sunat-profile/models/sunat-profile";

jest.mock("@/features/sunat/sunat-document-sequence/hooks/use-sunat-document-sequences");
jest.mock("@/features/sunat/sunat-document/hooks/use-create-sunat-documents");
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const factura = {
  id: "inv-1",
  orderId: "order-1",
  companyId: "c1",
  rucIssuer: "20111111111",
  taxDocumentType: "01",
  series: "F002",
  correlative: "00000012",
  issueDate: "2026-11-19",
  cdrStatus: "ACCEPTED",
  sunatCode: "0",
  sunatDescription: null,
  observations: null,
  signedXmlStoragePath: null,
  cdrStoragePath: null,
  digestValue: null,
  referenceDocumentId: null,
  createdAt: "2026-11-19T10:00:00Z",
  updatedAt: "2026-11-19T10:00:00Z",
  taxDocumentPayload: {
    customer: {
      name: "DRASANVI PERU S.A.C.",
      identityDocumentType: "6",
      identityDocumentNumber: "20100070970",
    },
    totals: {
      currency: "PEN",
      subtotal: 100,
      discountTotal: 0,
      shippingTotal: 0,
      taxTotal: 18,
      grandTotal: 118,
    },
    items: [
      {
        sku: "A",
        productName: "Chompa",
        quantity: 1,
        unitPrice: 100,
        subtotal: 100,
        discountAmount: 0,
        unitCode: "NIU",
        taxType: "10",
      },
    ],
  },
} as SunatDocument;

const nota = {
  ...factura,
  id: "nc-1",
  taxDocumentType: "07",
  series: "FC01",
  correlative: "00000001",
  referenceDocumentId: "inv-1",
  taxDocumentPayload: {
    ...factura.taxDocumentPayload,
    discrepancyResponse: { reasonCode: "06", reasonDescription: "Devolución total" },
  },
} as SunatDocument;

const profile = { id: "p1", ruc: "20111111111", isActive: true } as SunatProfile;
const sale = { id: "order-1", customer: { fullName: "DRASANVI PERU S.A.C." } } as unknown as Order;

describe("NotasTab con notas reales", () => {
  it("muestra número, comprobante original, motivo con código y estado de SUNAT", () => {
    render(
      <NotasTab
        notas={[nota]}
        documents={[factura, nota]}
        hasAceptados
        onNuevaNota={jest.fn()}
        onImprimir={jest.fn()}
      />,
    );

    expect(screen.getByText("FC01-00000001")).toBeInTheDocument();
    expect(screen.getByText("F002-00000012")).toBeInTheDocument();
    expect(screen.getByText("06 · Devolución total")).toBeInTheDocument();
    expect(screen.getByText("Aceptado")).toBeInTheDocument();
    expect(screen.getByText("19/11/2026")).toBeInTheDocument();
  });

  it("imprime el PDF real de la nota aceptada", async () => {
    const onImprimir = jest.fn().mockResolvedValue(undefined);
    render(
      <NotasTab
        notas={[nota]}
        documents={[factura, nota]}
        hasAceptados
        onNuevaNota={jest.fn()}
        onImprimir={onImprimir}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /imprimir pdf/i }));
    await waitFor(() => expect(onImprimir).toHaveBeenCalledWith(nota));
  });

  it("no deja imprimir mientras la nota sigue en envío a SUNAT", () => {
    const pendiente = { ...nota, cdrStatus: "PENDING" } as SunatDocument;
    render(
      <NotasTab
        notas={[pendiente]}
        documents={[factura, pendiente]}
        hasAceptados
        onNuevaNota={jest.fn()}
        onImprimir={jest.fn()}
      />,
    );

    expect(screen.getByText("Enviando a SUNAT")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /imprimir pdf/i })).toBeDisabled();
  });
});

describe("NotaCreditoModal emite al backend", () => {
  const mutateAsync = jest.fn();

  beforeEach(() => {
    mutateAsync.mockReset().mockResolvedValue({ documents: [nota], errors: [] });
    jest
      .mocked(useCreateSunatDocuments)
      .mockReturnValue({ mutateAsync, isPending: false } as never);
    jest.mocked(useSunatDocumentSequences).mockReturnValue({
      data: [
        {
          companyId: "c1",
          rucIssuer: "20111111111",
          taxDocumentType: "07",
          series: "FC01",
          nextCorrelative: 1,
          isDefault: true,
        },
      ],
      isLoading: false,
    } as never);
  });

  function renderModal(documents: SunatDocument[] = [factura]) {
    const onEmitida = jest.fn();
    const onClose = jest.fn();
    render(
      <NotaCreditoModal
        isOpen
        onClose={onClose}
        aceptados={[{ sale, taxDocument: factura }]}
        documents={documents}
        profiles={[profile]}
        onEmitida={onEmitida}
      />,
    );
    return { onEmitida, onClose };
  }

  it("envía una nota 07 ligada a la factura, con serie FC01 y motivo 06", async () => {
    const { onEmitida, onClose } = renderModal();

    await userEvent.click(screen.getByRole("button", { name: /emitir nota de crédito/i }));

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    const [{ documents }] = mutateAsync.mock.calls[0];
    expect(documents[0]).toMatchObject({
      orderId: "order-1",
      taxDocumentType: "07",
      series: "FC01",
      referenceDocumentId: "inv-1",
      reason: { code: "06", description: "Devolución total" },
      totals: { grandTotal: 118 },
    });
    expect(onEmitida).toHaveBeenCalledWith(nota);
    expect(onClose).toHaveBeenCalled();
  });

  it("no envía devolución total si la factura ya tiene una nota", async () => {
    renderModal([
      factura,
      {
        ...nota,
        taxDocumentPayload: {
          ...nota.taxDocumentPayload,
          totals: { ...nota.taxDocumentPayload.totals, grandTotal: 18 },
        },
      } as SunatDocument,
    ]);

    await userEvent.click(screen.getByRole("button", { name: /emitir nota de crédito/i }));

    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("no envía si el RUC no tiene serie de nota con prefijo F", async () => {
    jest.mocked(useSunatDocumentSequences).mockReturnValue({ data: [], isLoading: false } as never);
    renderModal();

    expect(screen.getByText(/falta una serie FC01/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /emitir nota de crédito/i }));
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
