import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { ReenviarPdfWhatsAppButton } from "../ReenviarPdfWhatsAppButton";

const mutateAsync = jest.fn();
const availability = {
  data: { connected: true, businessPhoneNumber: "15551530890" },
  refetch: jest.fn(),
};
let activeDocument: Record<string, unknown> | null = null;

jest.mock("@/features/sunat/sunat-document/hooks/use-tax-document-whatsapp", () => ({
  useTaxDocumentWhatsAppAvailability: () => availability,
  useSendTaxDocumentWhatsApp: () => ({ mutateAsync, isPending: false }),
}));
jest.mock("@/features/sunat/sunat-document/hooks/use-active-tax-document-for-order", () => ({
  useActiveTaxDocumentForOrder: () => activeDocument,
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

const accepted = { id: "doc-1", cdrStatus: "ACCEPTED", series: "B002", correlative: "00000015" };

beforeEach(() => {
  mutateAsync.mockReset().mockResolvedValue({ to: "51987654321", deduplicated: false });
  availability.data = { connected: true, businessPhoneNumber: "15551530890" };
  activeDocument = accepted;
});

it("reenvía el PDF del comprobante aceptado al teléfono del pedido", async () => {
  render(<ReenviarPdfWhatsAppButton orderId="o1" phone="987 654 321" customerName="María" />);
  fireEvent.click(screen.getByRole("button", { name: "Reenviar PDF B002-00000015 por WhatsApp" }));
  await waitFor(() =>
    expect(mutateAsync).toHaveBeenCalledWith({
      sunatDocumentId: "doc-1",
      to: "987654321",
      customerName: "María",
    }),
  );
});

it("en el chat se ve con texto", () => {
  render(<ReenviarPdfWhatsAppButton orderId="o1" phone="987654321" size="sm" />);
  expect(screen.getByRole("button", { name: /Reenviar PDF/ })).toHaveTextContent("Reenviar PDF");
});

it("no aparece sin número propio", () => {
  availability.data = { connected: false, businessPhoneNumber: null };
  const { container } = render(<ReenviarPdfWhatsAppButton orderId="o1" phone="987654321" />);
  expect(container).toBeEmptyDOMElement();
});

it("no aparece si el comprobante sigue en proceso o no hay", () => {
  activeDocument = { ...accepted, cdrStatus: "PENDING" };
  const { container, rerender } = render(
    <ReenviarPdfWhatsAppButton orderId="o1" phone="987654321" />,
  );
  expect(container).toBeEmptyDOMElement();
  activeDocument = null;
  rerender(<ReenviarPdfWhatsAppButton orderId="o1" phone="987654321" />);
  expect(container).toBeEmptyDOMElement();
});
