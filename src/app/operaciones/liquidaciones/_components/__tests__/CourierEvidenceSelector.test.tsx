import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CourierEvidenceSelector } from "../CourierEvidenceSelector";
import * as api from "@/services/courierPaymentEvidenceService";
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { user: { id: "user" } } }),
}));
jest.mock("@/services/courierPaymentEvidenceService", () => ({
  getOrderCourierPaymentEvidence: jest.fn(),
}));
it("labels provider reports as unverified, links photos without loading them and blocks already linked reports", async () => {
  jest.mocked(api.getOrderCourierPaymentEvidence).mockResolvedValue({
    orderId: "order",
    payments: [],
    evidence: [
      {
        id: "linked",
        orderId: "order",
        provider: "EVA",
        providerStatus: "ENTREGADO",
        trackingId: "t1",
        reportedAmount: "30",
        photos: ["https://evidence.example/receipt.jpg", "javascript:alert(1)"],
        occurredAt: "2026-11-02",
        createdAt: "2026-11-02",
        verificationStatus: "PENDING_REVIEW",
      },
      {
        id: "pending",
        orderId: "order",
        provider: "EVA",
        providerStatus: "ENTREGADO",
        trackingId: "t2",
        reportedAmount: null,
        photos: [],
        occurredAt: "2026-11-02",
        createdAt: "2026-11-02",
        verificationStatus: "PENDING_REVIEW",
      },
    ],
  });
  const selected = jest.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CourierEvidenceSelector
        companyId="company"
        orderId="order"
        linkedIds={["linked"]}
        selectedId=""
        disabled={false}
        onSelect={selected}
      />
    </QueryClientProvider>,
  );
  expect(
    await screen.findByRole("radio", { name: /Vinculado a un cobro confirmado/ }),
  ).toBeDisabled();
  expect(screen.getByRole("link", { name: "Abrir evidencia 1" })).toHaveAttribute(
    "href",
    "https://evidence.example/receipt.jpg",
  );
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(selected).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("radio", { name: /No informado · Por verificar/ }));
  expect(selected).toHaveBeenCalledWith("pending");
});
