import { render, screen, within } from "@testing-library/react";
import { WHATSAPP_MESSAGE_STATUSES } from "@/features/whatsapp/enums/whatsapp.enums";
import {
  deliveredWithEvidenceFixture,
  notSentFixture,
  repliedConversationFixture,
  WHATSAPP_FIXTURE_NOW,
} from "@/mocks/whatsapp/whatsapp-message.fixtures";
import {
  templatePreviewValuesFixture,
  unsafeTemplateFixture,
} from "@/mocks/whatsapp/whatsapp-template.fixtures";
import { MessageStatusTicks } from "../MessageStatusTicks";
import { PendingIntegrationNotice } from "../PendingIntegrationNotice";
import { WhatsAppPhonePreview } from "../WhatsAppPhonePreview";
import { WhatsAppThread } from "../WhatsAppThread";

describe("MessageStatusTicks", () => {
  it("expone texto accesible aun sin etiqueta visible", () => {
    const { container } = render(
      <MessageStatusTicks status={WHATSAPP_MESSAGE_STATUSES.READ} showLabel={false} />,
    );
    expect(container).toHaveTextContent("Leído");
  });

  it("distingue fallido, omitido y asistido", () => {
    const { container: failed } = render(
      <MessageStatusTicks status={WHATSAPP_MESSAGE_STATUSES.FAILED} />,
    );
    const { container: skipped } = render(
      <MessageStatusTicks status={WHATSAPP_MESSAGE_STATUSES.SKIPPED} />,
    );
    const { container: assisted } = render(
      <MessageStatusTicks status={WHATSAPP_MESSAGE_STATUSES.ASSISTED} />,
    );
    expect(failed).toHaveTextContent("No enviado: Meta no pudo entregarlo");
    expect(skipped).toHaveTextContent("No enviado: POWIP no lo envió");
    expect(assisted).toHaveTextContent("Asistido: Enviado a mano · sin confirmación de entrega");
    expect(assisted).not.toHaveTextContent("Entregado");
    expect(assisted).not.toHaveTextContent("Leído");
  });
});

describe("WhatsAppPhonePreview", () => {
  it("reemplaza variables y no interpreta HTML del usuario", () => {
    const { container } = render(
      <WhatsAppPhonePreview
        businessName="LIVII Store"
        body={unsafeTemplateFixture.body}
        values={templatePreviewValuesFixture}
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByText(/<script>alert\("x"\)<\/script>/)).toBeInTheDocument();
    expect(screen.getByText("Carlos")).toBeInTheDocument();
    expect(screen.getByText("sí es negrita")).toHaveClass("font-bold");
  });

  it("muestra el marcador de las variables sin valor", () => {
    render(
      <WhatsAppPhonePreview businessName="LIVII Store" body="Recoge en {{agencia}}" values={{}} />,
    );
    expect(screen.getByTitle("Sin valor para {{agencia}}")).toHaveTextContent("{{agencia}}");
  });

  it("muestra encabezado de documento, pie y botones", () => {
    render(
      <WhatsAppPhonePreview
        businessName="LIVII Store"
        body="Hola"
        header={{ type: "document", fileName: "B001-000482.pdf" }}
        footer="Responde STOP para no recibir avisos"
        buttonText="Ver mi pedido"
        quickReplyText="Tengo una consulta"
      />,
    );
    expect(screen.getByRole("figure", { name: /LIVII Store/ })).toBeInTheDocument();
    expect(screen.getByText("B001-000482.pdf")).toBeInTheDocument();
    expect(screen.getByText("Responde STOP para no recibir avisos")).toBeInTheDocument();
    expect(screen.getByText("Ver mi pedido")).toBeInTheDocument();
    expect(screen.getByText("Tengo una consulta")).toBeInTheDocument();
  });
});

describe("WhatsAppThread", () => {
  it("ordena los mensajes y separa días en hora de Lima", () => {
    render(<WhatsAppThread messages={repliedConversationFixture} now={WHATSAPP_FIXTURE_NOW} />);
    const list = screen.getByRole("list", { name: "Mensajes de la conversación" });
    const items = within(list).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Ayer");
    expect(items[1]).toHaveTextContent("Plantilla · guia_creada");
    expect(items[2]).toHaveTextContent("Hoy");
    expect(screen.getByText("Respuesta automática")).toBeInTheDocument();
    expect(screen.getByText(/no voy a estar en casa el jueves/)).toBeInTheDocument();
  });

  it("muestra evidencia y documento", () => {
    render(<WhatsAppThread messages={deliveredWithEvidenceFixture} now={WHATSAPP_FIXTURE_NOW} />);
    expect(screen.getByText("Foto de entrega · Moto propia · 12:40")).toBeInTheDocument();
    expect(screen.getByText("B001-000482.pdf")).toBeInTheDocument();
    expect(screen.getByText("48 KB")).toBeInTheDocument();
  });

  it("no presenta un mensaje asistido como entregado o leído", () => {
    render(<WhatsAppThread messages={[notSentFixture[2]]} now={WHATSAPP_FIXTURE_NOW} />);
    const list = screen.getByRole("list", { name: "Mensajes de la conversación" });
    expect(list).toHaveTextContent("Asistido");
    expect(list).toHaveTextContent("sin confirmación de entrega");
    expect(list).not.toHaveTextContent("Entregado");
    expect(list).not.toHaveTextContent("Leído");
  });

  it("muestra el motivo de los no enviados", () => {
    render(<WhatsAppThread messages={notSentFixture.slice(0, 2)} now={WHATSAPP_FIXTURE_NOW} />);
    expect(screen.getByText("El número no tiene WhatsApp")).toBeInTheDocument();
    expect(
      screen.getByText("Falta el link de rastreo (el pedido aún no tiene guía)"),
    ).toBeInTheDocument();
  });

  it("muestra el estado vacío", () => {
    render(<WhatsAppThread messages={[]} emptyLabel="Sin mensajes" />);
    expect(screen.getByText("Sin mensajes")).toBeInTheDocument();
  });
});

describe("PendingIntegrationNotice", () => {
  it("se anuncia como nota y lista las secciones", () => {
    render(<PendingIntegrationNotice title="Pendiente" items={["Uno", "Dos"]} />);
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Pendiente");
    expect(within(note).getAllByRole("listitem")).toHaveLength(2);
  });
});
