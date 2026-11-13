import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "@/lib/axiosAuth";
import GuideDetailsModal, { type OrderDetail, type ShippingGuide } from "../GuideDetailsModal";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), patch: jest.fn(), post: jest.fn() } }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), warning: jest.fn(), success: jest.fn(), info: jest.fn() } }));
jest.mock("@/hooks/useInvalidateBusinessData", () => ({ useInvalidateBusinessData: () => jest.fn() }));
jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock("@/components/modals/PaymentVerificationModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/shalom/SendToShalomModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/aliclik/SendToAliclikGuideModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/eva/SendToEvaGuideModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/modals/ShalomShippingLabelsModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/utils/printOrderLabel", () => ({ generateQR: jest.fn().mockResolvedValue("data:image/png;base64,qr"), generateBarcode: () => "" }));
jest.mock("@/utils/printShippingGuide", () => ({ printShippingGuide: jest.fn().mockResolvedValue(undefined) }));

const guide: ShippingGuide = { id: "guide-1", companyId: "company-1", guideNumber: "GUIA-001", storeId: "store-1", orderIds: ["order-1"], status: "CREADA", created_at: "2026-11-12T23:11:37Z", updated_at: "2026-11-12T23:11:37Z" };
const receipt = (payments: OrderDetail["payments"]): OrderDetail => ({
  id: "order-1", orderId: "order-1", companyId: "company-1", orderNumber: "PED-001", status: "EN_ENVIO", grandTotal: 179,
  customer: { fullName: "Cliente", phoneNumber: "999999999", address: "Dirección" }, payments,
  unitCatalogValidated: true, unitAssignmentStatus: "CONFIRMED", stockVersion: 2, confirmedStockVersion: 2,
  items: [{ productName: "Producto", sku: "P", quantity: 1, unitPrice: 179, trackingMode: "NONE" }],
} as unknown as OrderDetail);

function setup(data: OrderDetail) {
  jest.mocked(axios.get).mockImplementation(async (url) => ({ data: String(url).includes("shipping-guides") ? guide : data }));
  return render(<GuideDetailsModal open guideId="guide-1" onClose={jest.fn()} />);
}
const valueOf = (label: string) => screen.getByText(label).parentElement;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({ auth: { accessToken: "token", company: { id: "company-1", name: "Empresa", stores: [] }, user: { id: "user-1" } } } as unknown as ReturnType<typeof useAuth>);
  process.env.NEXT_PUBLIC_API_VENTAS = "https://ventas.test";
  process.env.NEXT_PUBLIC_API_COURIER = "https://courier.test";
  Object.assign(navigator, { clipboard: { writeText: jest.fn().mockResolvedValue(undefined) } });
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("GuideDetailsModal: cobranza con adelantos por aprobar", () => {
  it("muestra el adelanto sin aprobar aparte, sin bajar la cobranza total", async () => {
    setup(receipt([{ amount: 20, status: "PENDING" }]));
    await screen.findByText("PED-001");

    expect(valueOf("Cobranza Total")).toHaveTextContent("S/179.00");
    expect(valueOf("Pend. Aprobación")).toHaveTextContent("S/20.00");
    expect(valueOf("Pendiente Pago")).toHaveTextContent("S/159.00");
  });

  it("con el adelanto aprobado baja la cobranza y no muestra 'Pend. Aprobación'", async () => {
    setup(receipt([{ amount: 20, status: "PAID" }]));
    await screen.findByText("PED-001");

    expect(valueOf("Cobranza Total")).toHaveTextContent("S/159.00");
    expect(screen.queryByText("Pend. Aprobación")).not.toBeInTheDocument();
  });

  it("el texto copiado informa adelanto aprobado y por cobrar sin restar el pendiente", async () => {
    setup(receipt([{ amount: 20, status: "PAID" }, { amount: 10, status: "PENDING" }]));
    await screen.findByText("PED-001");

    fireEvent.click(screen.getByText("Seleccionar todos").previousElementSibling as HTMLElement);
    fireEvent.click(screen.getByRole("button", { name: /Copiar/ }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
    const text = jest.mocked(navigator.clipboard.writeText).mock.calls[0][0];
    expect(text).toContain("Total: S/ 179.00");
    expect(text).toContain("Adelanto: S/ 20.00");
    expect(text).toContain("Por Cobrar: S/ 159.00");
  });
});
