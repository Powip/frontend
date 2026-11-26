import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WhatsAppNotificationsSection from "@/app/operaciones/guias/_components/WhatsAppNotificationsSection";
import { PublicTrackingPage } from "@/components/public-tracking/PublicTrackingPage";
import { Button } from "@/components/ui/button";
import { parseWhatsAppLastNotice } from "@/features/whatsapp/utils/last-notice.util";
import {
  INTEGRATIONS_FIXTURE_NOW,
  lastNoticeDtoFixtures,
  notificationsFeedFixture,
  orderThreadsFixture,
  publicTrackingAgencyIncidentFixture,
  publicTrackingFixture,
  publicTrackingIncompleteFixture,
} from "@/mocks/whatsapp/whatsapp-integrations.fixtures";
import { OrderWhatsAppMessages, OrderWhatsAppMessagesView } from "../OrderWhatsAppMessages";
import { getWhatsAppConversationsByOrder } from "@/features/whatsapp/api/threads.api";

jest.mock("@/features/whatsapp/api/threads.api", () => ({
  getWhatsAppConversationsByOrder: jest.fn(),
}));
const byOrderMock = getWhatsAppConversationsByOrder as jest.MockedFunction<
  typeof getWhatsAppConversationsByOrder
>;
import { WhatsAppLastNoticeIndicator } from "../WhatsAppLastNoticeIndicator";
import {
  WhatsAppNotificationsButton,
  WhatsAppNotificationsList,
} from "../WhatsAppNotificationsPanel";

describe("Mensajes de WhatsApp en la ficha del pedido", () => {
  it("no aparece sin pedido real y con pedido lee su conversación (C-22.7)", async () => {
    byOrderMock.mockResolvedValueOnce(orderThreadsFixture);
    const { container, rerender } = render(<OrderWhatsAppMessages orderId={null} />);
    expect(container).toBeEmptyDOMElement();
    expect(byOrderMock).not.toHaveBeenCalled();
    rerender(<OrderWhatsAppMessages orderId="order-1" />);
    await waitFor(() => expect(byOrderMock).toHaveBeenCalledWith("order-1", expect.any(Map)));
    expect((await screen.findAllByRole("link", { name: /Abrir conversación/ })).length).toBe(
      orderThreadsFixture.length,
    );
    expect(screen.queryByText(/Pendiente de integración/)).not.toBeInTheDocument();
  });

  it("pedido sin avisos muestra vacío y un fallo deja reintentar", async () => {
    byOrderMock.mockResolvedValueOnce([]);
    const { unmount } = render(<OrderWhatsAppMessages orderId="order-2" />);
    expect(
      await screen.findByText("Aún no se enviaron avisos por WhatsApp para este pedido."),
    ).toBeInTheDocument();
    unmount();
    byOrderMock.mockRejectedValueOnce(new Error("Sin conexión"));
    render(<OrderWhatsAppMessages orderId="order-3" />);
    expect(await screen.findByText(/No se pudieron cargar los mensajes de WhatsApp/)).toBeInTheDocument();
  });

  it("distingue vacío, error y contenido con acceso a la conversación real", () => {
    const { rerender } = render(
      <OrderWhatsAppMessagesView threads={{ kind: "ready", data: [] }} />,
    );
    expect(
      screen.getByText("Aún no se enviaron avisos por WhatsApp para este pedido."),
    ).toBeInTheDocument();
    rerender(<OrderWhatsAppMessagesView threads={{ kind: "error", message: "Falló." }} />);
    expect(screen.getByText("No se pudieron cargar los mensajes de WhatsApp")).toBeInTheDocument();
    rerender(
      <OrderWhatsAppMessagesView
        threads={{ kind: "ready", data: orderThreadsFixture }}
        now={INTEGRATIONS_FIXTURE_NOW}
      />,
    );
    expect(
      screen.getByRole("link", { name: /Abrir conversación con \+51 922 333 444/ }),
    ).toHaveAttribute("href", "/configuracion/whatsapp?tab=conversaciones&thread=cv-jorge");
    expect(screen.getByText("Evidencia de despacho · 08:10")).toBeInTheDocument();
    expect(screen.getByText("Foto de entrega · Moto propia · 12:40")).toBeInTheDocument();
  });
});

describe("Indicador del último aviso", () => {
  it("solo interpreta estados válidos y no traduce ausencia en fallo", () => {
    expect(parseWhatsAppLastNotice(undefined)).toBeNull();
    expect(parseWhatsAppLastNotice(null)).toBeNull();
    expect(parseWhatsAppLastNotice(lastNoticeDtoFixtures.invalidStatus)).toBeNull();
    expect(parseWhatsAppLastNotice(lastNoticeDtoFixtures.invalidDate)).toBeNull();
    expect(parseWhatsAppLastNotice(lastNoticeDtoFixtures.failed)).toMatchObject({
      status: "failed",
      reason: "El número no tiene WhatsApp",
    });
  });

  it("no cambia el botón sin dato y suma el estado al nombre accesible con dato", async () => {
    const user = userEvent.setup({ delay: null });
    const onClick = jest.fn();
    const { rerender } = render(
      <Button title="WhatsApp" className="relative" onClick={onClick}>
        WhatsApp
        <WhatsAppLastNoticeIndicator notice={parseWhatsAppLastNotice(undefined)} />
      </Button>,
    );
    expect(screen.queryByTestId("whatsapp-last-notice")).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAccessibleName("WhatsApp");
    rerender(
      <Button title="WhatsApp" className="relative" onClick={onClick}>
        WhatsApp
        <WhatsAppLastNoticeIndicator notice={parseWhatsAppLastNotice(lastNoticeDtoFixtures.read)} />
      </Button>,
    );
    expect(screen.getByRole("button")).toHaveAccessibleName(
      "WhatsApp , Último aviso pedido_en_camino: Leído · 08/10/2026 10:15",
    );
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("Sección de Guías", () => {
  it("ya no edita plantillas y lleva al módulo central", () => {
    render(<WhatsAppNotificationsSection />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a WhatsApp" })).toHaveAttribute(
      "href",
      "/configuracion/whatsapp?tab=programacion",
    );
  });
});

describe("Alertas de WhatsApp", () => {
  it("sin C-31 no muestra contadores y «Ver» solo lleva a pestañas válidas", () => {
    const { rerender } = render(
      <WhatsAppNotificationsList
        feed={{ kind: "pending-integration" }}
        now={INTEGRATIONS_FIXTURE_NOW}
      />,
    );
    expect(screen.getByText("Notificaciones pendientes de integración")).toBeInTheDocument();
    rerender(
      <WhatsAppNotificationsList
        feed={{ kind: "ready", data: notificationsFeedFixture }}
        now={INTEGRATIONS_FIXTURE_NOW}
      />,
    );
    expect(screen.getByRole("link", { name: "Ver en Conversaciones" })).toHaveAttribute(
      "href",
      "/configuracion/whatsapp?tab=conversaciones",
    );
    expect(screen.getByText("Sin pestaña relacionada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar todo como leído" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("el botón futuro solo muestra contador con dato de backend", () => {
    const { rerender } = render(
      <WhatsAppNotificationsButton
        feed={{ kind: "pending-integration" }}
        now={INTEGRATIONS_FIXTURE_NOW}
      />,
    );
    expect(screen.getByRole("button", { name: "Alertas de WhatsApp" })).toBeInTheDocument();
    rerender(
      <WhatsAppNotificationsButton
        feed={{ kind: "ready", data: notificationsFeedFixture }}
        now={INTEGRATIONS_FIXTURE_NOW}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Alertas de WhatsApp, 2 sin leer" }),
    ).toBeInTheDocument();
  });
});

describe("Página pública de rastreo", () => {
  it("sin integración no muestra datos ni afirma un pedido", () => {
    render(<PublicTrackingPage state={{ kind: "pending-integration" }} />);
    expect(
      screen.getByRole("heading", { name: "Seguimiento no disponible todavía" }),
    ).toBeInTheDocument();
  });

  it("enlace inválido o vencido usa el mismo mensaje", () => {
    render(<PublicTrackingPage state={{ kind: "not-found" }} />);
    expect(
      screen.getByText("El enlace no es válido o ya venció. Pide a la tienda un enlace nuevo."),
    ).toBeInTheDocument();
  });

  it("muestra estado, envío, evidencia por tipo y comprobante sin datos privados", () => {
    render(<PublicTrackingPage state={{ kind: "ready", data: publicTrackingFixture }} />);
    expect(screen.getByRole("heading", { name: "Pedido ORD-149880 de Jorge" })).toBeInTheDocument();
    expect(screen.getByText("Foto del despacho · 07 oct")).toBeInTheDocument();
    expect(
      screen.getByText("Se tomó al enviar el pedido; no confirma la entrega."),
    ).toBeInTheDocument();
    expect(screen.getByText("Foto de entrega · 08 oct")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Descargar boleta \(PDF\)/ })).toHaveAttribute(
      "href",
      "https://example.com/boleta.pdf",
    );
    expect(document.body.textContent).not.toMatch(/\+51|DNI|\d{9}/);
    expect(screen.getByText("A domicilio · Miraflores")).toBeInTheDocument();
  });

  it("muestra agencia e incidencia, y tolera datos incompletos", () => {
    const { rerender } = render(
      <PublicTrackingPage state={{ kind: "ready", data: publicTrackingAgencyIncidentFixture }} />,
    );
    expect(
      screen.getByText("La agencia cerró temprano por feriado; puedes recogerlo mañana."),
    ).toBeInTheDocument();
    expect(screen.getByText("Shalom Arequipa Centro")).toBeInTheDocument();
    expect(screen.queryByText(/Comprobante/)).not.toBeInTheDocument();
    rerender(
      <PublicTrackingPage state={{ kind: "ready", data: publicTrackingIncompleteFixture }} />,
    );
    expect(screen.getByText("En preparación")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Envío" })).not.toBeInTheDocument();
    expect(within(document.body).queryByText(/Seguimiento$/)).not.toBeInTheDocument();
  });
});
