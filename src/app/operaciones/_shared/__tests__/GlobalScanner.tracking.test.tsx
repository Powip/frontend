import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import axios from "@/lib/axiosAuth";
import { toast } from "sonner";
import { useBusinessOrders } from "@/hooks/useBusinessOrders";
import { GlobalScanner } from "../GlobalScanner";

jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { patch: jest.fn() } }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), warning: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { accessToken: "token" } }) }));
jest.mock("@/hooks/useBusinessOrders", () => ({ useBusinessOrders: jest.fn() }));
jest.mock("@/hooks/useUserAuditInfo", () => ({ useUserAuditInfo: () => () => ({ userId: "actor-id", sellerName: "Actor" }) }));
jest.mock("@/app/centro-envios/components/ScannerSheet", () => ({
  __esModule: true,
  default: ({ orders, onDispatch, onConfirmDelivery }: any) => {
    const [result, setResult] = jest.requireActual("react").useState("");
    const run = (action: any) => action(orders[0]).then(() => setResult("confirmed"), () => setResult("unconfirmed"));
    return <><button onClick={() => run(onDispatch)}>dispatch</button><button onClick={() => run(onConfirmDelivery)}>deliver</button><span>{result}</span></>;
  },
}));

const reload = jest.fn().mockResolvedValue(undefined);
const base = { id: "order-1", status: "PREPARADO", deliveryType: "DOMICILIO", unitAssignmentStatus: "NONE" };
const tracked = { ...base, hasTrackedUnits: true, unitCatalogValidated: true, unitAssignmentStatus: "CONFIRMED", stockVersion: 1, confirmedStockVersion: 1 };
function setup(order: Record<string, unknown>) {
  jest.mocked(useBusinessOrders).mockReturnValue({ orders: [order], loading: false, error: false, retry: reload, refetch: reload } as any);
  return render(<GlobalScanner open onOpenChange={jest.fn()} />);
}

describe("GlobalScanner: IMEI status routes and acknowledgement", () => {
  beforeEach(() => { jest.clearAllMocks(); process.env.NEXT_PUBLIC_API_VENTAS = "https://ventas.test"; });
  it("keeps the normal dispatch endpoint for NONE", async () => {
    jest.mocked(axios.patch).mockResolvedValue({ data: { ...base, status: "EN_ENVIO" } });
    setup(base);
    fireEvent.click(screen.getByText("dispatch"));
    expect(await screen.findByText("confirmed")).toBeInTheDocument();
    expect(axios.patch).toHaveBeenCalledWith("https://ventas.test/order-header/order-1", { status: "EN_ENVIO", userId: "actor-id", sellerName: "Actor" });
  });
  it("routes confirmed tracked dispatch through JWT status", async () => {
    jest.mocked(axios.patch).mockResolvedValue({ data: { ...tracked, status: "EN_ENVIO" } });
    setup(tracked);
    fireEvent.click(screen.getByText("dispatch"));
    expect(await screen.findByText("confirmed")).toBeInTheDocument();
    expect(axios.patch).toHaveBeenCalledWith("https://ventas.test/order-header/manual/order-1/status", expect.objectContaining({ status: "EN_ENVIO" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it("blocks a pending unit selection before dispatch", async () => {
    setup({ ...tracked, unitAssignmentStatus: "PENDING" });
    fireEvent.click(screen.getByText("dispatch"));
    expect(await screen.findByText("unconfirmed")).toBeInTheDocument();
    expect(axios.patch).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("pendiente"));
  });
  it("does not report a delivered order while its stock acknowledgement is pending", async () => {
    jest.mocked(axios.patch).mockResolvedValue({ data: { ...tracked, status: "EN_ENVIO", unitAssignmentStatus: "PENDING", stockVersion: 2 } });
    setup({ ...tracked, status: "EN_ENVIO" });
    fireEvent.click(screen.getByText("deliver"));
    expect(await screen.findByText("unconfirmed")).toBeInTheDocument();
    expect(axios.patch).toHaveBeenCalledWith("https://ventas.test/order-header/manual/order-1/status", expect.objectContaining({ status: "ENTREGADO" }));
    expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("pendiente de confirmación"));
    expect(reload).toHaveBeenCalledTimes(1);
  });
  it("lets the authenticated backend resolve historical UNKNOWN orders to NONE", async () => {
    jest.mocked(axios.patch).mockResolvedValue({ data: { ...base, status: "EN_ENVIO" } });
    setup({ ...base, unitAssignmentStatus: "PENDING_SELECTION", unitCatalogValidated: false });
    fireEvent.click(screen.getByText("dispatch"));
    await waitFor(() => expect(screen.getByText("confirmed")).toBeInTheDocument());
    expect(axios.patch).toHaveBeenCalledWith("https://ventas.test/order-header/manual/order-1/status", expect.anything());
  });
});
