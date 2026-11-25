import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  listWhatsAppNotifications,
  markAllWhatsAppNotificationsRead,
  markWhatsAppNotificationRead,
} from "@/features/whatsapp/api/settings-ops.api";
import {
  relatedTabFromLink,
  toWhatsAppNotificationsFeed,
  WhatsAppNotificationsBell,
} from "../WhatsAppNotificationsBell";

jest.mock("@/features/whatsapp/api/settings-ops.api", () => ({
  listWhatsAppNotifications: jest.fn(),
  markAllWhatsAppNotificationsRead: jest.fn(),
  markWhatsAppNotificationRead: jest.fn(),
}));

const listMock = listWhatsAppNotifications as jest.MockedFunction<typeof listWhatsAppNotifications>;
const markAllMock = markAllWhatsAppNotificationsRead as jest.MockedFunction<
  typeof markAllWhatsAppNotificationsRead
>;
const markOneMock = markWhatsAppNotificationRead as jest.MockedFunction<
  typeof markWhatsAppNotificationRead
>;

const createdAt = new Date("2026-11-24T15:00:00.000Z");
const apiFeed = {
  items: [
    {
      id: "n1",
      type: "quality",
      title: "Meta bajó el límite de mensajes del número",
      body: "Revisa la calidad en Conexión.",
      link: "/configuracion/whatsapp?tab=conexion",
      storeId: null,
      read: false,
      createdAt,
    },
    {
      id: "n2",
      type: "template",
      title: "Plantilla rechazada",
      body: null,
      link: null,
      storeId: null,
      read: true,
      createdAt,
    },
  ],
  unreadCount: 1,
};

function renderBell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <WhatsAppNotificationsBell />
    </QueryClientProvider>,
  );
}

describe("campanita de alertas de WhatsApp (X5, C-31)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("lee la pestaña del enlace de la alerta", () => {
    expect(relatedTabFromLink("/configuracion/whatsapp?tab=conexion")).toBe("conexion");
    expect(relatedTabFromLink(null)).toBeNull();
    expect(relatedTabFromLink("/otra-ruta")).toBeNull();
  });

  it("convierte la respuesta del backend al formato de la lista", () => {
    const feed = toWhatsAppNotificationsFeed(apiFeed);
    expect(feed.unreadTotal).toBe(1);
    expect(feed.items[0]).toMatchObject({
      id: "n1",
      message: "Meta bajó el límite de mensajes del número. Revisa la calidad en Conexión.",
      relatedTab: "conexion",
      readAt: null,
    });
    expect(feed.items[1]).toMatchObject({ message: "Plantilla rechazada", relatedTab: null });
    expect(feed.items[1].readAt).toEqual(createdAt);
  });

  it("muestra el contador del backend y marca como leído al abrir y con «Marcar todo»", async () => {
    listMock.mockResolvedValue(apiFeed);
    markOneMock.mockResolvedValue();
    markAllMock.mockResolvedValue();
    const user = userEvent.setup();
    renderBell();

    const bell = await screen.findByRole("button", { name: "Alertas de WhatsApp, 1 sin leer" });
    await user.click(bell);
    expect(await screen.findByText(/Meta bajó el límite/)).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: /Ver en/ }));
    await waitFor(() => expect(markOneMock).toHaveBeenCalledWith("n1"));

    await user.click(screen.getByRole("button", { name: "Marcar todo como leído" }));
    await waitFor(() => expect(markAllMock).toHaveBeenCalled());
  });

  it("si el backend falla muestra el error, sin contador inventado", async () => {
    listMock.mockRejectedValue(new Error("Sin conexión"));
    const user = userEvent.setup();
    renderBell();
    const bell = await screen.findByRole("button", { name: "Alertas de WhatsApp" });
    await user.click(bell);
    expect(await screen.findByText("No se pudieron cargar las alertas")).toBeInTheDocument();
  });
});
