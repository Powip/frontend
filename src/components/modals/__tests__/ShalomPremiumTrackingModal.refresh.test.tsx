import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { OrderHeader } from "@/interfaces/IOrder";

jest.mock("lucide-react", () => new Proxy({}, {
  get: (_target, prop) => prop === "__esModule" ? true : () => null,
}));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "token", company: { id: "company-1" } } }),
}));
jest.mock("@/app/centro-envios/components/shipmentUtils", () => ({
  getPendingPayment: () => 0,
}));
jest.mock("@/services/shalomService", () => ({
  trackShalomShipment: jest.fn(),
  generateShalomTicketPdf: jest.fn().mockRejectedValue(new Error("sin pdf")),
}));

import { trackShalomShipment } from "@/services/shalomService";
import ShalomPremiumTrackingModal from "../ShalomPremiumTrackingModal";

const mockTrack = trackShalomShipment as jest.Mock;

const order = {
  id: "order-1",
  orderNumber: "ORD-1",
  courier: "Shalom",
  externalTrackingNumber: "12345678",
  shippingCode: "AB12",
  customer: { fullName: "Cliente" },
  items: [],
} as unknown as OrderHeader;

function renderModal() {
  return render(<ShalomPremiumTrackingModal open onClose={() => {}} order={order} />);
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  global.URL.createObjectURL = jest.fn(() => "blob:x");
});

it("muestra la hora de actualización cuando el backend manda syncedAt", async () => {
  mockTrack.mockResolvedValue({
    syncedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    fromCache: true,
    statuses: { data: { registrado: { fecha: "01/11" } } },
  });
  renderModal();
  expect(await screen.findByTestId("shalom-synced-at")).toHaveTextContent(/Actualizado hace 5 min/);
});

it("sin syncedAt (backend viejo) no muestra la hora", async () => {
  mockTrack.mockResolvedValue({ statuses: { data: { registrado: { fecha: "01/11" } } } });
  renderModal();
  await waitFor(() => expect(mockTrack).toHaveBeenCalled());
  await screen.findByText("01/11");
  expect(screen.queryByTestId("shalom-synced-at")).toBeNull();
});

it("la carga inicial no fuerza refresh", async () => {
  mockTrack.mockResolvedValue({ statuses: { data: {} } });
  renderModal();
  await waitFor(() => expect(mockTrack).toHaveBeenCalledTimes(1));
  expect(mockTrack).toHaveBeenCalledWith("token", "company-1", "12345678", "AB12", undefined);
});

it("«Actualizar estado» manda refresh:true y actualiza estado y hora", async () => {
  mockTrack.mockResolvedValueOnce({
    syncedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    statuses: { data: { registrado: { fecha: "01/11" } } },
  });
  renderModal();
  expect(await screen.findByTestId("shalom-synced-at")).toHaveTextContent(/hace 30 min/);

  mockTrack.mockResolvedValueOnce({
    syncedAt: new Date().toISOString(),
    fromCache: false,
    statuses: { data: { registrado: { fecha: "01/11" }, transito: { fecha: "02/11" } } },
  });
  fireEvent.click(screen.getByRole("button", { name: /Actualizar estado/i }));

  await waitFor(() => expect(mockTrack).toHaveBeenCalledTimes(2));
  expect(mockTrack).toHaveBeenLastCalledWith("token", "company-1", "12345678", "AB12", { refresh: true });
  await waitFor(() =>
    expect(screen.getByTestId("shalom-synced-at")).toHaveTextContent(/hace un momento/),
  );
  expect(screen.getByText("02/11")).toBeInTheDocument();
});
