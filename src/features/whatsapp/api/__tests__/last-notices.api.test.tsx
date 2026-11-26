import { render, screen, waitFor } from "@testing-library/react";
import axiosAuth from "@/lib/axiosAuth";
import { WhatsAppLastNoticeIndicator } from "@/components/whatsapp/WhatsAppLastNoticeIndicator";
import { listWhatsAppLastNotices, resetWhatsAppLastNoticesCache } from "../last-notices.api";

jest.mock("@/lib/axiosAuth", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock("@/lib/api", () => ({ API: { integrations: "http://int" } }));

const post = jest.mocked(axiosAuth.post);

beforeEach(() => {
  post.mockReset();
  resetWhatsAppLastNoticesCache();
});

describe("último aviso por pedido (C-29)", () => {
  it("convierte la respuesta y descarta estados desconocidos", async () => {
    post.mockResolvedValueOnce({
      data: {
        items: [
          { orderId: "o-1", status: "read", templateName: "pedido_en_camino", at: "2026-11-23T15:00:00.000Z", reason: null },
          { orderId: "o-2", status: "rarito", templateName: null, at: "2026-11-23T15:00:00.000Z", reason: null },
        ],
      },
    } as never);
    const result = await listWhatsAppLastNotices(["o-1", "o-2"]);
    expect(post).toHaveBeenCalledWith("http://int/wa/orders/last-notices", { orderIds: ["o-1", "o-2"] });
    expect(result.get("o-1")?.status).toBe("read");
    expect(result.has("o-2")).toBe(false);
  });

  it("una lista de pedidos hace una sola llamada y pinta solo los que tienen aviso", async () => {
    post.mockResolvedValueOnce({
      data: {
        items: [{ orderId: "o-1", status: "failed", templateName: null, at: "2026-11-23T15:00:00.000Z", reason: "Número inválido" }],
      },
    } as never);
    render(
      <ul>
        {["o-1", "o-2", "o-3"].map((id) => (
          <li key={id}>
            <WhatsAppLastNoticeIndicator notice={null} orderId={id} />
          </li>
        ))}
      </ul>,
    );
    expect(await screen.findByTestId("whatsapp-last-notice")).toHaveTextContent(/Número inválido/);
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1]).toEqual({ orderIds: ["o-1", "o-2", "o-3"] });
    expect(screen.getAllByTestId("whatsapp-last-notice")).toHaveLength(1);
  });

  it("si la lista ya trae el aviso no llama al backend; si falla no muestra nada", async () => {
    render(
      <WhatsAppLastNoticeIndicator
        notice={{ status: "sent", templateName: null, at: new Date(), reason: null }}
        orderId="o-9"
      />,
    );
    expect(screen.getByTestId("whatsapp-last-notice")).toBeInTheDocument();
    post.mockRejectedValueOnce(new Error("403"));
    render(<WhatsAppLastNoticeIndicator notice={null} orderId="o-10" />);
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(screen.getAllByTestId("whatsapp-last-notice")).toHaveLength(1);
  });
});
