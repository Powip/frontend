/**
 * Tests: botón WhatsApp del documento Shalom (ShalomDocumentCard embebida en
 * CustomerServiceModal → Seguimiento, y ShalomDocumentModal independiente).
 * Ambos usan el mismo handler (useShalomDocumentViewer), así que cada caso
 * corre contra los dos.
 *
 * Verifica el contenido realmente compartido: el File que recibe
 * navigator.share, el PDF descargado y el texto que va en la URL de
 * WhatsApp — nunca una URL blob: ni el endpoint autenticado de Shalom.
 */

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock(
  "lucide-react",
  () =>
    new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === "__esModule") return true;
          return () => null;
        },
      },
    ),
);

jest.mock("sonner", () => ({
  toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { accessToken: "token" } }),
}));

jest.mock("@/services/shalomService", () => ({
  generateShalomTicketPdf: jest.fn(),
  generateShalomLabelPdf: jest.fn(),
}));

import { toast } from "sonner";
import type { OrderHeader } from "@/interfaces/IOrder";
import { generateShalomLabelPdf, generateShalomTicketPdf } from "@/services/shalomService";
import ShalomDocumentModal, { ShalomDocumentCard } from "../ShalomDocumentModal";

const mockTicket = generateShalomTicketPdf as jest.Mock;
const mockLabel = generateShalomLabelPdf as jest.Mock;
const mockToastError = toast.error as jest.Mock;
const mockToastInfo = toast.info as jest.Mock;

const BLOB_URL = "blob:http://localhost/pdf-1";
const TRACKING_URL = "https://www.powip.lat/rastreo/PED-100";
const PDF_BYTES = "%PDF-1.4 comprobante real";

function makeOrder(overrides: Partial<OrderHeader> = {}): OrderHeader {
  return {
    id: "order-1",
    orderNumber: "PED-100",
    courier: "Shalom",
    externalTrackingNumber: "12345678",
    shippingCode: "AB12",
    shalomRecipientPhone: null,
    customer: { fullName: "Ana Pérez", phoneNumber: "987 111 222" },
    ...overrides,
  } as unknown as OrderHeader;
}

type Variant = {
  name: string;
  renderWith: (order: OrderHeader) => ReturnType<typeof render>;
};

const variants: Variant[] = [
  {
    name: "ShalomDocumentCard (Seguimiento)",
    renderWith: (order) => render(<ShalomDocumentCard order={order} />),
  },
  {
    name: "ShalomDocumentModal",
    renderWith: (order) => render(<ShalomDocumentModal open order={order} onClose={jest.fn()} />),
  },
];

function readFileText(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function sentText(url: string): string {
  return new URL(url).searchParams.get("text") ?? "";
}

function sentPhone(url: string): string | null {
  return new URL(url).searchParams.get("phone");
}

function expectNoPrivateUrls(text: string) {
  expect(text).not.toContain("blob:");
  expect(text).not.toContain("ticket-pdf");
  expect(text).not.toContain("/shalom/label");
}

let openSpy: jest.SpyInstance;
let downloadedAnchors: HTMLAnchorElement[];

function setWebShare(canShare: boolean, share: jest.Mock) {
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
  Object.defineProperty(navigator, "canShare", {
    value: jest.fn(() => canShare),
    configurable: true,
  });
}

function clearWebShare() {
  delete (navigator as { share?: unknown }).share;
  delete (navigator as { canShare?: unknown }).canShare;
}

beforeAll(() => {
  URL.createObjectURL = jest.fn(() => BLOB_URL);
  URL.revokeObjectURL = jest.fn();
});

beforeEach(() => {
  jest.clearAllMocks();
  clearWebShare();
  mockTicket.mockResolvedValue(new Blob([PDF_BYTES], { type: "application/pdf" }));
  mockLabel.mockResolvedValue(new Blob(["%PDF rotulo"], { type: "application/pdf" }));
  openSpy = jest.spyOn(window, "open").mockReturnValue({ opener: {} } as unknown as Window);
  downloadedAnchors = [];
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloadedAnchors.push(this);
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  clearWebShare();
});

async function waitForPdf() {
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "WhatsApp" })).toBeEnabled();
  });
}

describe.each(variants)("$name — botón WhatsApp", ({ renderWith }) => {
  it("comparte el PDF real como archivo cuando el dispositivo lo permite", async () => {
    const share = jest.fn<Promise<void>, [ShareData]>(() => Promise.resolve());
    setWebShare(true, share);
    const user = userEvent.setup();
    renderWith(makeOrder());
    await waitForPdf();

    expect(screen.getByTestId("whatsapp-phone")).toHaveTextContent("+51 987 111 222");
    expect(screen.getByText(/Se compartirá el PDF del comprobante/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "WhatsApp" }));

    expect(share).toHaveBeenCalledTimes(1);
    const payload = share.mock.calls[0][0] as ShareData;
    const file = payload.files?.[0] as File;
    expect(payload.files).toHaveLength(1);
    expect(file.name).toBe("comprobante-AB12.pdf");
    expect(file.type).toBe("application/pdf");
    await expect(readFileText(file)).resolves.toBe(PDF_BYTES);
    expect(payload.text).toBe(
      `Hola Ana Pérez, te comparto el comprobante de envío con Shalom de tu pedido PED-100. Seguimiento: ${TRACKING_URL}`,
    );
    expectNoPrivateUrls(payload.text ?? "");
    expect(openSpy).not.toHaveBeenCalled();
    expect(downloadedAnchors).toHaveLength(0);
  });

  it("comparte el rótulo cuando esa pestaña está activa", async () => {
    const share = jest.fn<Promise<void>, [ShareData]>(() => Promise.resolve());
    setWebShare(true, share);
    const user = userEvent.setup();
    renderWith(makeOrder());
    await waitForPdf();

    await user.click(screen.getByRole("button", { name: "Rótulo de envío" }));
    await waitForPdf();
    await user.click(screen.getByRole("button", { name: "WhatsApp" }));

    const payload = share.mock.calls[0][0] as ShareData;
    const file = payload.files?.[0] as File;
    expect(file.name).toBe("rotulo-AB12.pdf");
    await expect(readFileText(file)).resolves.toBe("%PDF rotulo");
    expect(payload.text).toContain("te comparto el rótulo de envío");
  });

  it("sin Web Share de archivos: descarga el PDF y abre WhatsApp pidiendo adjuntarlo", async () => {
    const user = userEvent.setup();
    renderWith(makeOrder());
    await waitForPdf();

    await user.click(screen.getByRole("button", { name: "WhatsApp" }));

    expect(downloadedAnchors).toHaveLength(1);
    expect(downloadedAnchors[0].download).toBe("comprobante-AB12.pdf");
    expect(downloadedAnchors[0].href).toBe(BLOB_URL);

    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url, target] = openSpy.mock.calls[0];
    expect(target).toBe("_blank");
    expect(sentPhone(url)).toBe("51987111222");
    const text = sentText(url);
    expect(text).toBe(
      `Hola Ana Pérez, te comparto el comprobante de envío con Shalom de tu pedido PED-100. Seguimiento: ${TRACKING_URL}`,
    );
    expectNoPrivateUrls(text);
    expect(mockToastInfo).toHaveBeenCalledWith(
      "Se descargó comprobante-AB12.pdf. Adjúntalo en el chat de WhatsApp antes de enviar el mensaje.",
    );
  });

  it("si Web Share falla, ofrece descargar el PDF para adjuntarlo manualmente", async () => {
    const share = jest.fn<Promise<void>, [ShareData]>(() =>
      Promise.reject(new Error("share failed")),
    );
    setWebShare(true, share);
    const user = userEvent.setup();
    renderWith(makeOrder());
    await waitForPdf();

    await user.click(screen.getByRole("button", { name: "WhatsApp" }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledTimes(1));
    const [message, options] = mockToastError.mock.calls[0];
    expect(message).toBe(
      "No se pudo compartir el comprobante. Descárgalo y adjúntalo manualmente en WhatsApp.",
    );
    expect(options.action.label).toBe("Descargar PDF");
    act(() => options.action.onClick());
    expect(downloadedAnchors).toHaveLength(1);
    expect(downloadedAnchors[0].download).toBe("comprobante-AB12.pdf");
  });

  it("no muestra error si el usuario cancela el menú de compartir", async () => {
    const share = jest.fn<Promise<void>, [ShareData]>(() =>
      Promise.reject(new DOMException("cancelado", "AbortError")),
    );
    setWebShare(true, share);
    const user = userEvent.setup();
    renderWith(makeOrder());
    await waitForPdf();

    await user.click(screen.getByRole("button", { name: "WhatsApp" }));

    await waitFor(() => expect(share).toHaveBeenCalled());
    await act(async () => {});
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("avisa si el navegador bloquea la ventana de WhatsApp y permite reintentar", async () => {
    openSpy.mockReturnValue(null);
    const user = userEvent.setup();
    renderWith(makeOrder());
    await waitForPdf();

    await user.click(screen.getByRole("button", { name: "WhatsApp" }));

    expect(mockToastInfo).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledTimes(1);
    const [message, options] = mockToastError.mock.calls[0];
    expect(message).toMatch(/bloqueó la ventana de WhatsApp/);
    expect(options.action.label).toBe("Abrir WhatsApp");

    const blockedUrl = openSpy.mock.calls[0][0];
    options.action.onClick();
    expect(openSpy).toHaveBeenLastCalledWith(blockedUrl, "_blank", "noopener,noreferrer");
  });

  it("si el PDF no está disponible, avisa y envía solo el enlace de seguimiento", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockTicket.mockRejectedValue(new Error("Shalom caído"));
    const share = jest.fn<Promise<void>, [ShareData]>(() => Promise.resolve());
    setWebShare(true, share);
    const user = userEvent.setup();
    renderWith(makeOrder());

    const button = await screen.findByRole("button", { name: "Enviar enlace" });
    expect(
      screen.getByText(
        "El comprobante no está disponible: solo se enviará el enlace de seguimiento.",
      ),
    ).toBeInTheDocument();

    await user.click(button);

    expect(share).not.toHaveBeenCalled();
    expect(downloadedAnchors).toHaveLength(0);
    const [url] = openSpy.mock.calls[0];
    const text = sentText(url);
    expect(text).toBe(
      `Hola Ana Pérez, puedes seguir el envío de tu pedido PED-100 con Shalom aquí: ${TRACKING_URL}`,
    );
    expect(text).not.toMatch(/comprobante|rótulo|adjunt/i);
    expectNoPrivateUrls(text);
  });

  it("deshabilita el botón mientras el PDF se está cargando", async () => {
    mockTicket.mockReturnValue(new Promise(() => {}));
    renderWith(makeOrder());

    expect(await screen.findByRole("button", { name: "WhatsApp" })).toBeDisabled();
  });

  it("teléfono del cliente inválido: muestra el error y no cambia solo al del destinatario", async () => {
    const user = userEvent.setup();
    renderWith(
      makeOrder({
        customer: { fullName: "Ana Pérez", phoneNumber: "54325632" } as OrderHeader["customer"],
        shalomRecipientPhone: "987654321",
      }),
    );
    await waitForPdf();

    const expectedError =
      "El teléfono del cliente (54325632) no es un celular válido para WhatsApp: debe tener 9 dígitos y empezar con 9.";
    expect(screen.getByRole("alert")).toHaveTextContent(expectedError);
    expect(screen.getByRole("button", { name: "Cliente" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "WhatsApp" }));

    expect(mockToastError).toHaveBeenCalledWith(expectedError);
    expect(openSpy).not.toHaveBeenCalled();
    expect(downloadedAnchors).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Destinatario Shalom" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByTestId("whatsapp-phone")).toHaveTextContent("+51 987 654 321");

    await user.click(screen.getByRole("button", { name: "WhatsApp" }));

    const [url] = openSpy.mock.calls[0];
    expect(sentPhone(url)).toBe("51987654321");
    expect(sentText(url)).toMatch(/^Hola, te comparto el comprobante/);
  });

  it("sin teléfono registrado muestra un error claro", async () => {
    const user = userEvent.setup();
    renderWith(
      makeOrder({
        customer: { fullName: "Ana Pérez", phoneNumber: "" } as OrderHeader["customer"],
      }),
    );
    await waitForPdf();

    expect(screen.getByRole("alert")).toHaveTextContent("No hay teléfono del cliente registrado.");
    expect(screen.queryByRole("group", { name: "Teléfono para WhatsApp" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "WhatsApp" }));

    expect(mockToastError).toHaveBeenCalledWith("No hay teléfono del cliente registrado.");
    expect(openSpy).not.toHaveBeenCalled();
  });
});
