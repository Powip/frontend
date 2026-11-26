import { render, screen, waitFor } from "@testing-library/react";
import { canBeReceipt, isWhatsAppMedia, USE_AS_RECEIPT_EVENT, WhatsAppMedia } from "../WhatsAppMedia";
import type { Message } from "@/types/crm";

jest.mock("@/services/crmService", () => ({
  getMessageMedia: jest.fn(async () => new Blob(["x"], { type: "image/jpeg" })),
}));

const msg = (over: Partial<Message>): Message =>
  ({
    id: "m1",
    conversationId: "c1",
    direction: "in",
    type: "image",
    body: null,
    mediaMime: "image/jpeg",
    mediaName: null,
    mediaUrl: "/crm/conversations/c1/messages/m1/media",
    ...over,
  }) as Message;

describe("WhatsApp media", () => {
  beforeAll(() => {
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => "blob:test";
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => undefined;
  });

  it("detecta adjuntos y comprobantes válidos", () => {
    expect(isWhatsAppMedia(msg({}))).toBe(true);
    expect(isWhatsAppMedia(msg({ mediaMime: null }))).toBe(false);
    expect(isWhatsAppMedia(msg({ type: "sticker" }))).toBe(false);
    expect(canBeReceipt(msg({}))).toBe(true);
    expect(canBeReceipt(msg({ mediaMime: "application/pdf" }))).toBe(true);
    expect(canBeReceipt(msg({ mediaMime: "audio/ogg" }))).toBe(false);
    expect(canBeReceipt(msg({ direction: "out" }))).toBe(false);
  });

  it("imagen: miniatura y botón que lanza el evento con el id del mensaje", async () => {
    const seen: string[] = [];
    const on = (e: Event) => seen.push((e as CustomEvent).detail.messageId);
    window.addEventListener(USE_AS_RECEIPT_EVENT, on);
    render(<WhatsAppMedia message={msg({})} />);
    await waitFor(() => expect(screen.getByTestId("wa-image")).toBeTruthy());
    screen.getByText("Usar como comprobante de pago").click();
    expect(seen).toEqual(["m1"]);
    window.removeEventListener(USE_AS_RECEIPT_EVENT, on);
  });

  it("documento como enlace y audio con reproductor", async () => {
    const { unmount } = render(
      <WhatsAppMedia message={msg({ type: "document", mediaMime: "application/pdf", mediaName: "voucher.pdf" })} />,
    );
    await waitFor(() => expect(screen.getByTestId("wa-document").textContent).toContain("voucher.pdf"));
    unmount();
    render(<WhatsAppMedia message={msg({ type: "audio", mediaMime: "audio/ogg" })} />);
    await waitFor(() => expect(screen.getByTestId("wa-audio")).toBeTruthy());
    expect(screen.queryByText("Usar como comprobante de pago")).toBeNull();
  });
});
