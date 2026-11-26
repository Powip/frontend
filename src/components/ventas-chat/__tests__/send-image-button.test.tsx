import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { imageProblem, MAX_IMAGE_BYTES, SendImageButton } from "../SendImageButton";
import { sendImageMessage } from "@/services/crmService";

jest.mock("@/services/crmService", () => ({
  sendImageMessage: jest.fn(async () => ({ id: "m-img", conversationId: "c1", type: "image" })),
  crmError: (e: Error) => ({ message: e.message }),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

describe("SendImageButton", () => {
  beforeAll(() => {
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => "blob:test";
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => undefined;
  });

  it("acepta solo JPG, PNG o WebP de hasta 5 MB", () => {
    expect(imageProblem({ type: "image/png", size: 10 })).toBeNull();
    expect(imageProblem({ type: "image/gif", size: 10 })).toMatch(/JPG, PNG o WebP/);
    expect(imageProblem({ type: "image/jpeg", size: MAX_IMAGE_BYTES + 1 })).toMatch(/5 MB/);
  });

  it("muestra la vista previa y envía la foto con su pie", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SendImageButton conversationId="c1" />
      </QueryClientProvider>,
    );
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "polo.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByTestId("send-image-input"), { target: { files: [file] } });

    expect(await screen.findByAltText("polo.jpg")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Pie de foto"), { target: { value: "Polo Aura" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar foto" }));

    await waitFor(() => expect(sendImageMessage).toHaveBeenCalledWith("c1", file, "Polo Aura"));
  });

  it("queda deshabilitado con la ventana cerrada", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SendImageButton conversationId="c1" disabled />
      </QueryClientProvider>,
    );
    expect(screen.getByRole("button", { name: "Enviar foto" })).toBeDisabled();
  });
});
