import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "@/lib/axiosAuth";
import { toast } from "sonner";
import { generateQR } from "@/utils/printOrderLabel";
import { printShippingGuide } from "@/utils/printShippingGuide";
import GuideDetailsModal, { type OrderDetail, type ShippingGuide } from "../GuideDetailsModal";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/lib/axiosAuth", () => ({ __esModule: true, default: { get: jest.fn(), patch: jest.fn(), post: jest.fn() } }));
jest.mock("sonner", () => ({ toast: { error: jest.fn(), warning: jest.fn(), success: jest.fn() } }));
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
jest.mock("@/utils/printOrderLabel", () => ({ generateQR: jest.fn().mockResolvedValue("data:image/png;base64,qr"), generateBarcode: () => "" }));
jest.mock("@/utils/printShippingGuide", () => ({ printShippingGuide: jest.fn().mockResolvedValue(undefined) }));

const unitId = "00000000-0000-4000-8000-000000000001";
const code = "0" + "X".repeat(99);
const guide: ShippingGuide = { id: "guide-1", companyId: "company-1", guideNumber: "GUIA-001", storeId: "store-1", orderIds: ["order-1"], status: "CREADA", created_at: "2026-10-17T12:00:00Z", updated_at: "2026-10-17T12:00:00Z" };
const receipt = (): OrderDetail => ({ id: "order-1", orderId: "order-1", companyId: "company-1", orderNumber: "PED-001", status: "EN_ENVIO", grandTotal: 100,
  customer: { fullName: "Cliente privado", phoneNumber: "999999999", address: "Dirección" }, payments: [],
  unitCatalogValidated: true, unitAssignmentStatus: "CONFIRMED", stockVersion: 2, confirmedStockVersion: 2,
  items: [{ productName: "Equipo serial", sku: "E", quantity: 1, unitPrice: 100, trackingMode: "SERIAL", unitIds: [unitId], units: [{ id: unitId, code, status: "RESERVED" }] }],
});
const session = (company = "company-1", user = "user-1") => ({ accessToken: "token", company: { id: company, name: "Empresa", stores: [] }, user: { id: user } });
function setAuth(auth: ReturnType<typeof session> | null) {
  jest.mocked(useAuth).mockReturnValue({ auth } as ReturnType<typeof useAuth>);
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
function setup(data = receipt()) {
  jest.mocked(axios.get).mockImplementation(async (url) => ({ data: String(url).includes("shipping-guides") ? guide : data }));
  return render(<GuideDetailsModal open guideId="guide-1" onClose={jest.fn()} />);
}
function popup() {
  const html: string[] = [];
  const win = { document: { open: jest.fn(), write: jest.fn((value: string) => html.push(value)), close: jest.fn() }, focus: jest.fn(), print: jest.fn(), close: jest.fn(), closed: false, onload: null as null | (() => void) };
  win.document.open.mockImplementation(() => { win.onload = null; });
  jest.spyOn(window, "open").mockReturnValue(win as unknown as Window);
  return { html, win };
}
beforeEach(() => {
  jest.clearAllMocks(); setAuth(session());
  process.env.NEXT_PUBLIC_API_VENTAS = "https://ventas.test";
  process.env.NEXT_PUBLIC_API_COURIER = "https://courier.test";
  jest.mocked(generateQR).mockResolvedValue("data:image/png;base64,qr");
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe("GuideDetailsModal: lectura e impresión con IMEI/series", () => {
  it("keeps a one-cent debt key hidden while allowing new metadata to be saved without clearing the hidden key", async () => {
    const data = { ...receipt(), shippingKey: "SECRET-EXISTING", payments: [{ status: "PAID", amount: 99.99 }], totals: { grandTotal: 100, totalPaid: 99.99, pendingAmount: 0.01 } };
    jest.mocked(axios.patch).mockResolvedValue({ data: {} });
    setup(data);
    fireEvent.click(await screen.findByText("PED-001"));
    const keyInput = await screen.findByPlaceholderText("Registrar nueva clave (oculta)");
    expect(keyInput).toHaveAttribute("type", "password");
    expect(keyInput).toHaveValue("");
    expect(keyInput).toBeEnabled();
    expect(screen.queryByDisplayValue("SECRET-EXISTING")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar Tracking" }));
    await waitFor(() => expect(axios.patch).toHaveBeenCalledTimes(1));
    expect(jest.mocked(axios.patch).mock.calls[0][1]).not.toHaveProperty("shippingKey");
    fireEvent.change(keyInput, { target: { value: "NEW-SECRET" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar Tracking" }));
    await waitFor(() => expect(axios.patch).toHaveBeenCalledTimes(2));
    expect(jest.mocked(axios.patch).mock.calls[1][1]).toMatchObject({ shippingKey: "NEW-SECRET" });
  });
  it("lee comprobantes autenticados exactos y pasa snapshots confirmados a la guía", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Imprimir Guía" }));
    expect(axios.get).toHaveBeenCalledWith("https://ventas.test/order-header/manual/order-1/receipt", expect.objectContaining({ headers: { Authorization: "Bearer token" }, signal: expect.any(AbortSignal) }));
    expect(printShippingGuide).toHaveBeenCalledWith(guide, [receipt()], expect.objectContaining({ id: "company-1" }), expect.objectContaining({ isCurrent: expect.any(Function), signal: expect.any(AbortSignal) }));
  });
  it.each(["order", "company"])("descarta un comprobante con %s ajeno sin fallback público", async (field) => {
    setup({ ...receipt(), ...(field === "order" ? { orderId: "other-order" } : { companyId: "other-company" }) });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No se pudo cargar la información de la guía"));
    expect(screen.queryByRole("button", { name: "Imprimir Guía" })).not.toBeInTheDocument();
    expect(jest.mocked(axios.get).mock.calls.some(([url]) => String(url).includes("/order-header/order-1/receipt"))).toBe(false);
  });
  it("un error de autorización no reintenta el comprobante público", async () => {
    jest.mocked(axios.get).mockImplementation(async url => {
      if (String(url).includes("shipping-guides")) return { data: guide };
      throw { response: { status: 403 } };
    });
    render(<GuideDetailsModal open guideId="guide-1" onClose={jest.fn()} />);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(printShippingGuide).not.toHaveBeenCalled();
  });
  it.each(["company", "user", "guide", "close"])("descarta una lectura tardía al cambiar %s", async change => {
    const pending = deferred<{ data: OrderDetail }>();
    jest.mocked(axios.get).mockImplementation(async url => String(url).includes("shipping-guides") ? { data: guide } : pending.promise);
    const view = render(<GuideDetailsModal open guideId="guide-1" onClose={jest.fn()} />);
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    if (change === "company") setAuth(session("company-2"));
    if (change === "user") setAuth(session("company-1", "user-2"));
    jest.mocked(axios.get).mockImplementation(() => new Promise(() => undefined));
    view.rerender(<GuideDetailsModal open={change !== "close"} guideId={change === "guide" ? "guide-2" : "guide-1"} onClose={jest.fn()} />);
    await act(async () => pending.resolve({ data: receipt() }));
    expect(screen.queryByText("Cliente privado")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Imprimir Guía" })).not.toBeInTheDocument();
  });
  it("una vista pública conserva NONE y nunca imprime identidades privadas inyectadas", async () => {
    setAuth(null); setup();
    fireEvent.click(await screen.findByRole("button", { name: "Imprimir Guía" }));
    expect(axios.get).toHaveBeenCalledWith("https://ventas.test/order-header/order-1/receipt", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    const data = jest.mocked(printShippingGuide).mock.calls[0][1][0];
    expect(data.items[0].units).toBeUndefined();
    expect(data.items[0].unitIds).toBeUndefined();
  });
  it("la etiqueta de bulto incluye códigos completos por producto y escapa el texto", async () => {
    const data = receipt(); data.items[0].productName = '<script>alert("producto")</script>';
    data.customer.fullName = '<img src=x onerror="alert(1)">';
    const print = popup(); setup(data);
    fireEvent.click(await screen.findByRole("button", { name: "Imprimir etiqueta de envío" }));
    await waitFor(() => expect(print.html).toHaveLength(2));
    const doc = new DOMParser().parseFromString(print.html[1], "text/html");
    expect(doc.querySelector(".unit-code")?.textContent).toBe(`Serie: ${code}`);
    expect(doc.querySelector(".lc-unit-item")?.textContent).toContain(data.items[0].productName);
    expect(doc.querySelector("script,[onerror]")).toBeNull();
    expect(print.win.print).not.toHaveBeenCalled();
    await act(async () => print.win.onload?.());
    expect(print.win.print).toHaveBeenCalledTimes(1);
  });
  it("la etiqueta NONE conserva el diseño sin agregar un bloque de productos", async () => {
    const data = receipt(); data.items = [{ productName: "Accesorio", sku: "A", quantity: 1, unitPrice: 100, trackingMode: "NONE" }];
    const print = popup(); setup(data);
    fireEvent.click(await screen.findByRole("button", { name: "Imprimir etiqueta de envío" }));
    await waitFor(() => expect(print.html).toHaveLength(2));
    expect(print.html[1]).not.toContain('class="lc-row lc-unit-item"');
    expect(print.html[1]).not.toContain('class="unit-codes"');
    expect(print.html[1]).toContain("1 ítem");
    await act(async () => print.win.onload?.());
  });
  it("conserva el lote completo en orden y el aviso del pedido aún no confirmado", async () => {
    const second = { ...receipt(), id: "order-2", orderId: "order-2", orderNumber: "PED-002", unitAssignmentStatus: "PENDING" };
    jest.mocked(axios.get).mockImplementation(async url => ({ data: String(url).includes("shipping-guides") ? { ...guide, orderIds: ["order-1", "order-2"] } : String(url).includes("order-2") ? second : receipt() }));
    const print = popup();
    render(<GuideDetailsModal open guideId="guide-1" onClose={jest.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Imprimir etiqueta de envío" }));
    await waitFor(() => expect(print.html).toHaveLength(2));
    const doc = new DOMParser().parseFromString(print.html[1], "text/html");
    const labels = [...doc.querySelectorAll(".label-page")];
    expect(labels).toHaveLength(2);
    expect(labels[0].querySelector(".lc-order-number")?.textContent).toBe("PED-001");
    expect(labels[0].querySelector(".unit-code")?.textContent).toBe(`Serie: ${code}`);
    expect(labels[1].querySelector(".lc-order-number")?.textContent).toBe("PED-002");
    expect(labels[1].querySelector(".unit-code")).toBeNull();
    expect(labels[1].textContent).toContain("Códigos pendientes de confirmación");
    await act(async () => print.win.onload?.());
  });
  it("cierra la etiqueta mientras genera QR si cambia la sesión", async () => {
    const qr = deferred<string>(); jest.mocked(generateQR).mockReturnValue(qr.promise);
    const print = popup(), view = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Imprimir etiqueta de envío" }));
    setAuth(session("company-1", "user-2"));
    view.rerender(<GuideDetailsModal open guideId="guide-1" onClose={jest.fn()} />);
    expect(print.win.close).toHaveBeenCalled();
    await act(async () => qr.resolve("data:image/png;base64,qr"));
    expect(print.html).toHaveLength(1);
    expect(print.win.print).not.toHaveBeenCalled();
  });
  it("cierra la ventana ya cargada al cerrar el modal antes de imprimir", async () => {
    const print = popup(), view = setup();
    fireEvent.click(await screen.findByRole("button", { name: "Imprimir etiqueta de envío" }));
    await waitFor(() => expect(print.html).toHaveLength(2));
    const lateLoad = print.win.onload;
    view.rerender(<GuideDetailsModal open={false} guideId="guide-1" onClose={jest.fn()} />);
    await act(async () => lateLoad?.());
    expect(print.win.close).toHaveBeenCalled();
    expect(print.win.print).not.toHaveBeenCalled();
  });
});
