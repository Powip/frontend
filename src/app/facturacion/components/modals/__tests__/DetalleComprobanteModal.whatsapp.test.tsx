import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import DetalleComprobanteModal from "@/app/facturacion/components/modals/DetalleComprobanteModal";
import { useSunatDocumentPdf } from "@/features/sunat/sunat-document/hooks/use-sunat-document-pdf";
import {
  useSendTaxDocumentWhatsApp,
  useTaxDocumentWhatsAppAvailability,
} from "@/features/sunat/sunat-document/hooks/use-tax-document-whatsapp";
import type { TaxDocumentRow } from "@/features/sunat/sunat-document/types/tax-document-row";

jest.mock("@/features/sunat/sunat-document/hooks/use-sunat-document-pdf");
jest.mock("@/features/sunat/sunat-document/hooks/use-tax-document-whatsapp");
const downloadFileMock = jest.fn();
jest.mock("@/utils/http/download-file", () => ({
  downloadFile: (...args: unknown[]) => downloadFileMock(...args),
}));
const pdfFile = { blob: new Blob(["%PDF"]), filename: "B002-00000015.pdf" };
const downloadPdfMock = jest.fn();
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const sendMock = jest.fn();
const openMock = jest.fn();

function buildRow(): TaxDocumentRow {
  return {
    sale: {
      id: "sale-1",
      orderNumber: "ORD-1",
      grandTotal: 150,
      createdAt: "2026-11-25T10:00:00.000Z",
      customer: { fullName: "María López", phoneNumber: "987 654 321", documentNumber: "" },
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
        totals: { currency: "PEN", grandTotal: 150 },
      },
    },
  } as unknown as TaxDocumentRow;
}

function renderModal() {
  render(
    <DetalleComprobanteModal
      isOpen
      onClose={jest.fn()}
      row={buildRow()}
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
  downloadPdfMock.mockReset().mockResolvedValue(pdfFile);
  downloadFileMock.mockReset();
  (useSunatDocumentPdf as jest.Mock).mockReturnValue({ mutateAsync: downloadPdfMock });
  (useSendTaxDocumentWhatsApp as jest.Mock).mockReturnValue({
    mutateAsync: sendMock,
    isPending: false,
  });
});

describe("DetalleComprobanteModal: WhatsApp", () => {
  it("con número propio conectado envía el PDF por Powip y no abre wa.me", async () => {
    mockAvailability(true);
    sendMock.mockResolvedValue({
      messageId: "wamid.1",
      mode: "document",
      to: "51987654321",
      documentNumber: "B002-00000015",
      deduplicated: false,
    });
    renderModal();

    expect(screen.getByTestId("aviso-whatsapp")).toHaveTextContent(
      "Powip enviará el PDF al cliente desde tu número +15551530890",
    );
    await userEvent.click(screen.getByRole("button", { name: /enviar pdf por whatsapp/i }));

    expect(sendMock).toHaveBeenCalledWith({
      sunatDocumentId: "doc-1",
      to: "987654321",
      customerName: "María López",
    });
    expect(openMock).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("PDF enviado por WhatsApp a +51987654321"),
    );
  });

  it("sin número propio descarga el PDF, abre el chat con el texto y pide adjuntarlo", async () => {
    mockAvailability(false);
    renderModal();

    expect(screen.getByTestId("aviso-whatsapp")).toHaveTextContent(
      "tu empresa no tiene un número de WhatsApp Business conectado. Se descargará el PDF",
    );
    await userEvent.click(screen.getByRole("button", { name: /^whatsapp$/i }));

    expect(sendMock).not.toHaveBeenCalled();
    expect(openMock).toHaveBeenCalledWith(
      expect.stringContaining("https://wa.me/987654321?text="),
      "_blank",
      "noopener,noreferrer",
    );
    expect(decodeURIComponent(openMock.mock.calls[0][0])).toContain("Boleta N° B002-00000015");
    await waitFor(() => expect(downloadFileMock).toHaveBeenCalledWith(pdfFile));
    expect(toast.info).toHaveBeenCalledWith(expect.stringContaining("Adjunta el PDF"));
  });

  it("sin número propio, si la descarga falla igual abre el chat y lo dice", async () => {
    mockAvailability(false);
    downloadPdfMock.mockRejectedValue(new Error("boom"));
    renderModal();

    await userEvent.click(screen.getByRole("button", { name: /^whatsapp$/i }));

    expect(openMock).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("no se pudo descargar el PDF"),
      ),
    );
  });

  it("un doble clic manda una sola petición", async () => {
    mockAvailability(true);
    let resolveSend: (value: unknown) => void = () => {};
    sendMock.mockImplementation(() => new Promise((resolve) => (resolveSend = resolve)));
    renderModal();

    const button = screen.getByRole("button", { name: /enviar pdf por whatsapp/i });
    await userEvent.dblClick(button);

    expect(sendMock).toHaveBeenCalledTimes(1);
    resolveSend({ messageId: "w", mode: "document", to: "51987654321", deduplicated: false });
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
  });

  it("si el número se desconectó, descarga el PDF y abre el chat", async () => {
    mockAvailability(true);
    sendMock.mockRejectedValue({
      response: { status: 409, data: { code: "WHATSAPP.OWN_NUMBER_NOT_CONNECTED" } },
    });
    renderModal();

    await userEvent.click(screen.getByRole("button", { name: /enviar pdf por whatsapp/i }));

    await waitFor(() => expect(openMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(downloadFileMock).toHaveBeenCalledWith(pdfFile));
    expect(toast.info).toHaveBeenCalled();
  });

  it("fuera de 24 h sin plantilla aprobada explica el motivo", async () => {
    mockAvailability(true);
    sendMock.mockRejectedValue({
      response: { status: 422, data: { code: "WHATSAPP.TAX_DOCUMENT_TEMPLATE_NOT_APPROVED" } },
    });
    renderModal();

    await userEvent.click(screen.getByRole("button", { name: /enviar pdf por whatsapp/i }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("comprobante_pdf")),
    );
    expect(openMock).not.toHaveBeenCalled();
  });

  it("deshabilita el botón mientras envía", () => {
    mockAvailability(true);
    (useSendTaxDocumentWhatsApp as jest.Mock).mockReturnValue({
      mutateAsync: sendMock,
      isPending: true,
    });
    renderModal();

    expect(screen.getByTestId("compartir-whatsapp")).toBeDisabled();
  });
});
