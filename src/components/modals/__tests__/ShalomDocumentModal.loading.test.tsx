import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { OrderHeader } from "@/interfaces/IOrder";

let mockAccessToken: string | null = "token";
let mockCompanyId: string | null = "company-1";

jest.mock("lucide-react", () => new Proxy({}, {
  get: (_target, prop) => prop === "__esModule" ? true : () => null,
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), info: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: mockAccessToken, company: mockCompanyId ? { id: mockCompanyId } : null } }),
}));
jest.mock("@/services/shalomService", () => ({
  generateShalomTicketPdf: jest.fn(),
  generateShalomLabelPdf: jest.fn(),
}));

import { generateShalomTicketPdf } from "@/services/shalomService";
import ShalomDocumentModal, { ShalomDocumentCard, useShalomDocumentViewer } from "../ShalomDocumentModal";

const mockTicket = generateShalomTicketPdf as jest.Mock;

function order(overrides: Partial<OrderHeader> = {}): OrderHeader {
  return {
    id: "order-1",
    orderNumber: "ORD-150212",
    courier: "Shalom",
    externalTrackingNumber: "12345678",
    shippingCode: "AB12",
    customer: { fullName: "Cliente", phoneNumber: "987111222" },
    ...overrides,
  } as OrderHeader;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAccessToken = "token";
  mockCompanyId = "company-1";
  URL.createObjectURL = jest.fn(() => "blob:document");
  URL.revokeObjectURL = jest.fn();
  mockTicket.mockResolvedValue(new Blob(["%PDF-1.4"], { type: "application/pdf" }));
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

it("loads the document when tracking credentials arrive for the same open order", async () => {
  const initial = order({ externalTrackingNumber: null, shippingCode: null });
  const { result, rerender } = renderHook(({ currentOrder }) => useShalomDocumentViewer(currentOrder), {
    initialProps: { currentOrder: initial },
  });
  expect(mockTicket).not.toHaveBeenCalled();

  rerender({ currentOrder: order() });

  await waitFor(() => expect(result.current.current.url).toBe("blob:document"));
  expect(mockTicket).toHaveBeenCalledWith("token", "12345678", "AB12", "company-1");
});

it("loads the document when the session token becomes available", async () => {
  mockAccessToken = null;
  const { result, rerender } = renderHook(() => useShalomDocumentViewer(order()));
  expect(mockTicket).not.toHaveBeenCalled();
  expect(result.current.shareMode).toBe("loading");

  mockAccessToken = "restored-token";
  rerender();

  await waitFor(() => expect(result.current.current.url).toBe("blob:document"));
  expect(mockTicket).toHaveBeenCalledWith("restored-token", "12345678", "AB12", "company-1");
});

it("waits for the current company before loading its Shalom document", async () => {
  mockCompanyId = null;
  const { result, rerender } = renderHook(() => useShalomDocumentViewer(order()));
  expect(mockTicket).not.toHaveBeenCalled();
  expect(result.current.shareMode).toBe("loading");

  mockCompanyId = "company-2";
  rerender();

  await waitFor(() => expect(result.current.current.url).toBe("blob:document"));
  expect(mockTicket).toHaveBeenCalledWith("token", "12345678", "AB12", "company-2");
});

it("keeps the selected order document when an earlier request finishes later", async () => {
  const previous = deferred<Blob>();
  const next = new Blob(["%PDF second order"], { type: "application/pdf" });
  mockTicket.mockReturnValueOnce(previous.promise).mockResolvedValueOnce(next);
  const { result, rerender } = renderHook(({ currentOrder }) => useShalomDocumentViewer(currentOrder), {
    initialProps: { currentOrder: order() },
  });

  rerender({ currentOrder: order({ id: "order-2", externalTrackingNumber: "87654321", shippingCode: "CD34" }) });
  await waitFor(() => expect(result.current.current.blob === next).toBe(true));

  await act(async () => previous.resolve(new Blob(["%PDF first order"], { type: "application/pdf" })));

  expect(result.current.current.blob === next).toBe(true);
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
});

it("ignores a previous order error after the selected order document loaded", async () => {
  const previous = deferred<Blob>();
  const next = new Blob(["%PDF second order"], { type: "application/pdf" });
  mockTicket.mockReturnValueOnce(previous.promise).mockResolvedValueOnce(next);
  const { result, rerender } = renderHook(({ currentOrder }) => useShalomDocumentViewer(currentOrder), {
    initialProps: { currentOrder: order() },
  });

  rerender({ currentOrder: order({ id: "order-2", externalTrackingNumber: "87654321", shippingCode: "CD34" }) });
  await waitFor(() => expect(result.current.current.blob === next).toBe(true));

  await act(async () => previous.reject(new Error("provider unavailable")));

  expect(result.current.current.blob === next).toBe(true);
  expect(result.current.current.error).toBe(false);
});

it.each(["card", "modal"])("allows retrying a failed document in the %s without closing it", async (variant) => {
  mockTicket.mockRejectedValueOnce({ response: { status: 503 } });
  if (variant === "card") render(<ShalomDocumentCard order={order()} />);
  else render(<ShalomDocumentModal order={order()} open onClose={jest.fn()} />);

  await waitFor(() => expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled());
  expect(screen.getByText(/No se pudo cargar el comprobante/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

  await waitFor(() => expect(screen.getByRole("button", { name: "Descargar" })).toBeEnabled());
  expect(mockTicket).toHaveBeenCalledTimes(2);
});
