import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ShalomDocumentOrder } from "../ShalomDocumentModal";

let mockCompanyId = "company-1";
let mockAccessToken = "token";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: mockAccessToken, company: { id: mockCompanyId }, user: { id: "user-1" } } }),
}));
jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));
jest.mock("@/services/shalomService", () => ({
  generateShalomTicketPdf: jest.fn(),
  generateShalomLabelPdf: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), info: jest.fn() } }));

import { generateShalomLabelPdf, generateShalomTicketPdf } from "@/services/shalomService";
import ShalomShippingLabelsModal from "../ShalomShippingLabelsModal";

const labelPdf = new Blob(["%PDF Shalom shipping label"], { type: "application/pdf" });
const firstOrder: ShalomDocumentOrder = {
  id: "order-1", orderNumber: "ORD-153892", courier: "Shalom",
  externalTrackingNumber: "101818469", shippingCode: "WJPH",
  customer: { fullName: "Cliente", phoneNumber: "999999999" },
};
const secondOrder: ShalomDocumentOrder = {
  ...firstOrder, id: "order-2", orderNumber: "ORD-153893",
  externalTrackingNumber: "101818470", shippingCode: "ABCD",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCompanyId = "company-1";
  mockAccessToken = "token";
  URL.createObjectURL = jest.fn(() => "blob:shalom-label");
  URL.revokeObjectURL = jest.fn();
  jest.mocked(generateShalomLabelPdf).mockResolvedValue(labelPdf);
});
afterEach(() => jest.restoreAllMocks());

it("opens the real Shalom shipping label first with company and authorization, and prints its PDF", async () => {
  const win = { focus: jest.fn(), print: jest.fn() };
  jest.spyOn(window, "open").mockReturnValue(win as unknown as Window);
  render(<ShalomShippingLabelsModal open onClose={jest.fn()} orders={[firstOrder]} />);

  await waitFor(() => expect(screen.getByRole("button", { name: "Imprimir" })).toBeEnabled());
  expect(generateShalomLabelPdf).toHaveBeenCalledWith("token", "101818469", "WJPH", "company-1");
  expect(generateShalomTicketPdf).not.toHaveBeenCalled();
  expect(document.querySelector("embed")).toHaveAttribute("src", "blob:shalom-label");

  fireEvent.click(screen.getByRole("button", { name: "Imprimir" }));
  expect(window.open).toHaveBeenCalledWith("blob:shalom-label", "_blank");
  expect(win.print).toHaveBeenCalledTimes(1);
});

it("selects each order by ID and discards a previous order's late response", async () => {
  const previous = deferred<Blob>();
  jest.mocked(generateShalomLabelPdf).mockReturnValueOnce(previous.promise).mockResolvedValueOnce(labelPdf);
  render(<ShalomShippingLabelsModal open onClose={jest.fn()} orders={[firstOrder, secondOrder]} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Pedido" }), { target: { value: "order-2" } });

  await waitFor(() => expect(screen.getByRole("button", { name: "Descargar" })).toBeEnabled());
  expect(generateShalomLabelPdf).toHaveBeenLastCalledWith("token", "101818470", "ABCD", "company-1");
  await act(async () => previous.resolve(new Blob(["%PDF old order"])));
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
});

it("does not load closed documents and resets the selected order when reopened", async () => {
  const props = { onClose: jest.fn(), orders: [firstOrder, secondOrder] };
  const view = render(<ShalomShippingLabelsModal {...props} open={false} />);
  expect(generateShalomLabelPdf).not.toHaveBeenCalled();
  view.rerender(<ShalomShippingLabelsModal {...props} open />);
  fireEvent.change(screen.getByRole("combobox", { name: "Pedido" }), { target: { value: "order-2" } });
  await waitFor(() => expect(generateShalomLabelPdf).toHaveBeenCalledTimes(2));
  view.rerender(<ShalomShippingLabelsModal {...props} open={false} />);
  view.rerender(<ShalomShippingLabelsModal {...props} open />);

  expect(screen.getByRole("combobox", { name: "Pedido" })).toHaveValue("order-1");
  await waitFor(() => expect(generateShalomLabelPdf).toHaveBeenCalledTimes(3));
  expect(generateShalomLabelPdf).toHaveBeenLastCalledWith("token", "101818469", "WJPH", "company-1");
});

it("explains missing Shalom credentials and disables PDF actions", () => {
  render(<ShalomShippingLabelsModal open onClose={jest.fn()} orders={[{ ...firstOrder, shippingCode: null }]} />);
  expect(screen.getByText("Falta el número o código de seguimiento de Shalom en este pedido.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Imprimir" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Descargar" })).toBeDisabled();
  expect(generateShalomLabelPdf).not.toHaveBeenCalled();
  expect(generateShalomTicketPdf).not.toHaveBeenCalled();
});

it("retries the label after a provider failure", async () => {
  jest.mocked(generateShalomLabelPdf).mockRejectedValueOnce(new Error("provider unavailable"));
  render(<ShalomShippingLabelsModal open onClose={jest.fn()} orders={[firstOrder]} />);
  fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Imprimir" })).toBeEnabled());
  expect(generateShalomLabelPdf).toHaveBeenCalledTimes(2);
  expect(generateShalomTicketPdf).not.toHaveBeenCalled();
});

it("discards a late response and clears the loaded PDF when the session changes", async () => {
  const previous = deferred<Blob>();
  const current = deferred<Blob>();
  jest.mocked(generateShalomLabelPdf).mockReturnValueOnce(previous.promise).mockReturnValueOnce(current.promise);
  const props = { open: true, onClose: jest.fn(), orders: [firstOrder] };
  const view = render(<ShalomShippingLabelsModal {...props} />);
  mockCompanyId = "company-2";
  mockAccessToken = "token-2";
  view.rerender(<ShalomShippingLabelsModal {...props} />);

  expect(screen.getByRole("button", { name: "Imprimir" })).toBeDisabled();
  expect(document.querySelector("embed")).toBeNull();
  await act(async () => previous.resolve(labelPdf));
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  await act(async () => current.resolve(labelPdf));
  await waitFor(() => expect(screen.getByRole("button", { name: "Imprimir" })).toBeEnabled());
  expect(generateShalomLabelPdf).toHaveBeenLastCalledWith("token-2", "101818469", "WJPH", "company-2");
});
