jest.setTimeout(30_000);
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SettlementDetailDialog } from "../SettlementDetailDialog";
import * as api from "@/services/courierSettlementsService";
jest.mock("@/services/courierSettlementsService", () => ({
  ...jest.requireActual("@/services/courierSettlementsService"),
  getCourierSettlement: jest.fn(),
  getCourierCollection: jest.fn(),
  reviewCourierSettlement: jest.fn(),
  uploadSettlementProof: jest.fn(),
  getSettlementProofUrl: jest.fn(),
}));
const service = jest.mocked(api);
const proof: api.SettlementProof = {
  id: "proof1",
  resourceType: "settlements",
  resourceId: "s1",
  fileName: "bank.pdf",
  mimeType: "application/pdf",
  size: 1024,
  createdAt: "2026-11-02",
  createdBy: "user",
};
const detail = (overrides: Partial<api.SettlementDetail> = {}): api.SettlementDetail => ({
  id: "s1",
  companyId: "company",
  courierId: "courier1",
  courierName: "Courier Uno",
  currency: "PEN",
  amountExpected: 100,
  amountDeposited: 40,
  amountAllocated: 40,
  unallocatedAmount: 0,
  difference: -60,
  status: "PENDIENTE_REVISION",
  method: "transferencia",
  date: "2026-11-02",
  operationNumber: "op-1",
  notes: null,
  createdBy: "user",
  createdAt: "2026-11-02",
  reviewedBy: null,
  reviewedAt: null,
  reviewNotes: null,
  version: 1,
  allocations: [
    {
      collectionId: "c1",
      orderId: "o1",
      orderNumber: "ORD-1",
      customerName: "Ana",
      storeId: "store",
      amount: 40,
      amountExpected: 100,
    },
  ],
  proofs: [],
  events: [],
  ...overrides,
});
function view(canReview = true) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <SettlementDetailDialog
        companyId="company"
        actorId="user"
        kind="settlements"
        id="s1"
        canReview={canReview}
        canUpload={true}
        onClose={jest.fn()}
        onChanged={async () => {}}
      />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  service.getCourierSettlement.mockResolvedValue(detail());
});

it("requires a saved proof and review note, then sends the received version without changing client payments", async () => {
  const user = userEvent.setup({ delay: null });
  service.uploadSettlementProof.mockImplementation(async () => {
    service.getCourierSettlement.mockResolvedValue(detail({ proofs: [proof], version: 2 }));
    return proof;
  });
  service.reviewCourierSettlement.mockImplementation(async () => {
    const accepted = detail({
      status: "CON_DIFERENCIA",
      version: 3,
      proofs: [proof],
      reviewedBy: "user",
      reviewedAt: "2026-11-02",
      reviewNotes: "Depósito parcial verificado",
    });
    service.getCourierSettlement.mockResolvedValue(accepted);
    return accepted;
  });
  view();
  await user.type(
    await screen.findByLabelText("Resultado de la verificación"),
    "Depósito parcial verificado",
  );
  expect(screen.getByRole("button", { name: "Aceptar depósito verificado" })).toBeDisabled();
  expect(service.reviewCourierSettlement).not.toHaveBeenCalled();
  await user.upload(
    screen.getByLabelText("Adjuntar comprobante real"),
    new File(["pdf"], "bank.pdf", { type: "application/pdf" }),
  );
  await user.click(screen.getByRole("button", { name: "Guardar comprobante" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Aceptar depósito verificado" })).toBeEnabled(),
  );
  await user.click(screen.getByRole("button", { name: "Aceptar depósito verificado" }));
  await waitFor(() =>
    expect(service.reviewCourierSettlement).toHaveBeenCalledWith("company", "s1", {
      accept: true,
      version: 2,
      notes: "Depósito parcial verificado",
    }),
  );
  expect(await screen.findByText(/Courier Uno · Aceptada con diferencia/)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Aceptar depósito verificado" }),
  ).not.toBeInTheDocument();
  expect(screen.getByText(/Los pagos del cliente se verifican por separado/)).toBeInTheDocument();
});

it("does not fetch private proof URLs until the user requests access", async () => {
  service.getCourierSettlement.mockResolvedValue(detail({ proofs: [proof] }));
  service.getSettlementProofUrl.mockResolvedValue({
    url: "https://storage.example/signed-proof",
    expiresIn: 300,
  });
  view(false);
  expect(await screen.findByText("bank.pdf · 1 KB")).toBeInTheDocument();
  expect(service.getSettlementProofUrl).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: "Aceptar depósito verificado" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Preparar enlace privado" }));
  expect(await screen.findByRole("link", { name: "Abrir comprobante" })).toHaveAttribute(
    "href",
    "https://storage.example/signed-proof",
  );
});

it("allows a documented rejection without claiming collection or settlement success", async () => {
  service.reviewCourierSettlement.mockResolvedValue(detail({ status: "RECHAZADA" }));
  view();
  fireEvent.change(await screen.findByLabelText("Resultado de la verificación"), {
    target: { value: "Comprobante no corresponde" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Rechazar depósito" }));
  await waitFor(() =>
    expect(service.reviewCourierSettlement).toHaveBeenCalledWith("company", "s1", {
      accept: false,
      version: 1,
      notes: "Comprobante no corresponde",
    }),
  );
});
