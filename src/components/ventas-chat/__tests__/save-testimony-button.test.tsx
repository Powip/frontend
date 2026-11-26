import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SaveTestimonyButton, { canSaveAsTestimony } from "../SaveTestimonyButton";
import { listChatTestimonies, saveChatTestimony } from "@/services/crmContentService";
import type { Message } from "@/types/crm";

jest.mock("@/services/crmContentService", () => ({
  listChatTestimonies: jest.fn(async () => []),
  saveChatTestimony: jest.fn(async () => ({ id: "mat1", status: "pending" })),
  listSheets: jest.fn(async () => [
    { id: "s1", name: "Polo Aura", active: true },
    { id: "s2", name: "Viejo", active: false },
  ]),
  crmContentError: (e: Error) => ({ message: e.message }),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const photo = {
  id: "m1",
  conversationId: "c1",
  direction: "in",
  type: "image",
  mediaMime: "image/jpeg",
  mediaName: "foto-cliente.jpg",
} as unknown as Message;

const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

describe("SaveTestimonyButton", () => {
  it("solo aparece en fotos que mandó el cliente", () => {
    expect(canSaveAsTestimony({ direction: "in", mediaMime: "image/png" })).toBe(true);
    expect(canSaveAsTestimony({ direction: "out", mediaMime: "image/png" })).toBe(false);
    expect(canSaveAsTestimony({ direction: "in", mediaMime: "application/pdf" })).toBe(false);
    expect(canSaveAsTestimony({ direction: "in", mediaMime: null })).toBe(false);
  });

  it("guarda la foto con producto y título", async () => {
    wrap(<SaveTestimonyButton message={photo} />);
    fireEvent.click(await screen.findByRole("button", { name: /Guardar como testimonio/ }));
    expect(screen.getByLabelText("Título")).toHaveValue("foto-cliente");
    await screen.findByRole("option", { name: "Polo Aura" });
    expect(screen.queryByRole("option", { name: "Viejo" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Producto"), { target: { value: "s1" } });
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: " Clienta feliz " } });
    fireEvent.click(screen.getByRole("button", { name: /^Guardar$/ }));
    await waitFor(() => expect(saveChatTestimony).toHaveBeenCalledWith("c1", "m1", { sheetId: "s1", title: "Clienta feliz" }));
  });

  it("muestra el estado si la foto ya es testimonio", async () => {
    (listChatTestimonies as jest.Mock).mockResolvedValueOnce([{ messageId: "m1", materialId: "mat1", status: "pending" }]);
    wrap(<SaveTestimonyButton message={photo} />);
    expect(await screen.findByText("Testimonio por aprobar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Guardar como testimonio/ })).toBeNull();
  });
});
