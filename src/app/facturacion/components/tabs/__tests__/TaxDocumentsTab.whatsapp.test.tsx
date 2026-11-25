import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { TaxDocumentsTab } from "@/app/facturacion/components/tabs/TaxDocumentsTab";
import {
  useSendTaxDocumentWhatsApp,
  useTaxDocumentWhatsAppAvailability,
} from "@/features/sunat/sunat-document/hooks/use-tax-document-whatsapp";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";
import { computeTaxDocumentKpis } from "@/features/sunat/sunat-document/utils/tax-document-kpis";

jest.mock("@/app/facturacion/components/modals/DetalleComprobanteModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/app/facturacion/components/modals/EmitirComprobanteModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/app/facturacion/components/modals/LoteEmisionModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/app/facturacion/components/modals/RechazadoModal", () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock("@/components/pdf/PdfPreviewDialog", () => ({
  PdfPreviewDialog: () => null,
}));
jest.mock("@/features/sunat/sunat-document/hooks/use-sunat-document-pdf", () => ({
  useSunatDocumentPdf: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock("@/features/sunat/sunat-document/hooks/use-sunat-documents-bulk-pdf", () => ({
  useSunatDocumentsBulkPdf: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}));
jest.mock("@/features/sunat/sunat-document/hooks/use-sunat-documents-bulk-pdf-zip", () => ({
  useSunatDocumentsBulkPdfZip: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}));
jest.mock("@/features/sunat/sunat-profile/hooks/use-sunat-profiles", () => ({
  useSunatProfiles: () => ({ data: [] }),
}));
jest.mock("@/features/sunat/sunat-issuer-access/hooks/use-sunat-issuer-access-blocks", () => ({
  useSunatIssuerAccessBlocks: () => ({ data: [] }),
}));
jest.mock("@/features/sunat/sunat-document/hooks/use-tax-document-whatsapp");
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const sendMock = jest.fn();
const openMock = jest.fn();

function buildRow(): TaxDocumentRow {
  return {
    sale: {
      id: "sale-1",
      orderNumber: "ORD-000005",
      grandTotal: 98,
      createdAt: "2026-11-25T10:00:00.000Z",
      customer: {
        fullName: "María López",
        phoneNumber: "987 654 321",
        documentNumber: "",
      },
    },
    taxDocument: {
      id: "doc-1",
      series: "B002",
      correlative: "00000015",
      cdrStatus: "ACCEPTED",
      taxDocumentType: "03",
      issueDate: "2026-11-25T10:00:00.000Z",
      sunatDescription: null,
      taxDocumentPayload: {
        items: [],
        totals: { currency: "PEN", grandTotal: 98 },
      },
    },
  } as unknown as TaxDocumentRow;
}

function renderTab() {
  const rows = [buildRow()];

  render(
    <TaxDocumentsTab
      comprobantes={
        {
          rows,
          loading: false,
          kpis: computeTaxDocumentKpis(rows),
          selectedIds: new Set<string>(),
          selectedRows: [],
          refreshListDocuments: jest.fn(),
          toggleSelected: jest.fn(),
          clearSelection: jest.fn(),
        } as never
      }
      onGenerarNota={jest.fn()}
    />,
  );
}

function mockAvailability(connected: boolean) {
  (useTaxDocumentWhatsAppAvailability as jest.Mock).mockReturnValue({
    data: { connected, businessPhoneNumber: connected ? "15551530890" : null },
    isLoading: false,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  window.open = openMock;
  (useSendTaxDocumentWhatsApp as jest.Mock).mockReturnValue({
    mutateAsync: sendMock,
    isPending: false,
  });
});

describe("TaxDocumentsTab: ícono WhatsApp de la fila", () => {
  it("con número propio conectado envía el PDF por Powip y no abre wa.me", async () => {
    mockAvailability(true);
    sendMock.mockResolvedValue({
      messageId: "wamid.1",
      mode: "document",
      to: "51987654321",
      deduplicated: false,
    });

    renderTab();
    await userEvent.click(screen.getByTestId("fila-whatsapp-sale-1"));

    await waitFor(() =>
      expect(sendMock).toHaveBeenCalledWith({
        sunatDocumentId: "doc-1",
        to: "987654321",
        customerName: "María López",
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("PDF enviado por WhatsApp a +51987654321");
    expect(openMock).not.toHaveBeenCalled();
  });

  it("sin número propio abre wa.me con el texto y avisa que no va el PDF", async () => {
    mockAvailability(false);

    renderTab();
    const button = screen.getByTestId("fila-whatsapp-sale-1");
    expect(button).toHaveAttribute("title", expect.stringContaining("sin PDF"));
    await userEvent.click(button);

    expect(sendMock).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("sin el PDF"));
    expect(openMock).toHaveBeenCalledWith(
      expect.stringContaining("https://api.whatsapp.com/send?phone=51987654321"),
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("doble clic manda una sola petición", async () => {
    mockAvailability(true);
    let resolveSend: (value: unknown) => void = () => undefined;
    sendMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve;
      }),
    );

    renderTab();
    const button = screen.getByTestId("fila-whatsapp-sale-1");
    await userEvent.dblClick(button);

    expect(sendMock).toHaveBeenCalledTimes(1);
    resolveSend({
      messageId: "wamid.1",
      mode: "document",
      to: "51987654321",
      deduplicated: false,
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("repetido dentro de 2 minutos muestra que ya se envió", async () => {
    mockAvailability(true);
    sendMock.mockResolvedValue({
      messageId: "wamid.1",
      mode: "document",
      to: "51987654321",
      deduplicated: true,
    });

    renderTab();
    await userEvent.click(screen.getByTestId("fila-whatsapp-sale-1"));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "Este comprobante ya se envió por WhatsApp hace un momento",
      ),
    );
  });

  it("409 OWN_NUMBER_NOT_CONNECTED cae a wa.me con aviso", async () => {
    mockAvailability(true);
    sendMock.mockRejectedValue({
      response: {
        status: 409,
        data: { code: "WHATSAPP.OWN_NUMBER_NOT_CONNECTED" },
      },
    });

    renderTab();
    await userEvent.click(screen.getByTestId("fila-whatsapp-sale-1"));

    await waitFor(() => expect(toast.info).toHaveBeenCalled());
    expect(openMock).toHaveBeenCalledTimes(1);
  });

  it("422 plantilla no aprobada muestra el error de comprobante_pdf", async () => {
    mockAvailability(true);
    sendMock.mockRejectedValue({
      response: {
        status: 422,
        data: { code: "WHATSAPP.TAX_DOCUMENT_TEMPLATE_NOT_APPROVED" },
      },
    });

    renderTab();
    await userEvent.click(screen.getByTestId("fila-whatsapp-sale-1"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("comprobante_pdf")),
    );
    expect(openMock).not.toHaveBeenCalled();
  });
});
