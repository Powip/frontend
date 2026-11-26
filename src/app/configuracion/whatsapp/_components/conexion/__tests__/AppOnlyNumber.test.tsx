import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resolveEffectivePermissions } from "@/features/whatsapp/utils/whatsapp-permissions.util";
import {
  accountsFixture,
  assistedQueueFixture,
  CONNECTION_FIXTURE_NOW,
  connectedStatusFixture,
  connectionStoresFixture,
  liviiAccountFixture,
} from "@/mocks/whatsapp/whatsapp-connection.fixtures";
import { ConnectionView, type ConnectionViewProps } from "../ConnectionView";

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.releasePointerCapture = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const PENDING = { kind: "pending-integration" } as const;
const appAccount = {
  ...liviiAccountFixture,
  id: "cred-app",
  phone: "+51987000111",
  connectionType: "app_manual" as const,
  verifiedName: null,
  isPrimary: true,
};

function view(overrides: Partial<ConnectionViewProps> = {}) {
  return (
    <ConnectionView
      stores={connectionStoresFixture}
      storeId="store-livii"
      onStoreChange={jest.fn()}
      now={CONNECTION_FIXTURE_NOW}
      canManage
      effectivePermissions={resolveEffectivePermissions(["WA_CONNECTION"])}
      status={{
        kind: "ready",
        data: { ...connectedStatusFixture, connectionType: "app_manual" },
      }}
      account={{ kind: "ready", data: appAccount }}
      accounts={{ kind: "ready", data: [appAccount] }}
      templates={PENDING}
      testRun={null}
      contingency={PENDING}
      agents={PENDING}
      assistedQueue={{ kind: "ready", data: assistedQueueFixture }}
      pricing={PENDING}
      usage={PENDING}
      signupAvailable={false}
      mutations={{}}
      {...overrides}
    />
  );
}

const section = (name: string | RegExp) => screen.getByRole("region", { name });

describe("Tienda con «Solo app»", () => {
  it("muestra el tipo real en todas las tarjetas y sin acciones de Meta", () => {
    render(view());
    expect(screen.getByText("Solo app Business · envío manual")).toBeInTheDocument();
    expect(
      within(section("Tipo de conexión")).getByRole("listitem", {
        name: /Solo app WhatsApp Business/,
      }),
    ).toHaveAttribute("aria-current", "true");
    const number = section("Número conectado");
    expect(number).toHaveTextContent("+51987000111");
    expect(number).toHaveTextContent("Powip no envía ni recibe por este número");
    expect(within(number).queryByRole("button", { name: "Actualizar" })).not.toBeInTheDocument();
    expect(within(number).queryByText("Phone number ID")).not.toBeInTheDocument();
    expect(within(number).getByRole("button", { name: "Desconectar" })).toBeInTheDocument();
    expect(screen.getByText(/envíalos desde el WhatsApp de \+51987000111/i)).toBeInTheDocument();
  });

  it("conecta un número solo con la app, con tienda o vendedora", async () => {
    const user = userEvent.setup();
    const connectAppOnly = jest.fn().mockResolvedValue(undefined);
    render(view({ mutations: { connectAppOnly }, accounts: { kind: "ready", data: [] } }));

    await user.click(screen.getByRole("button", { name: "Agregar número solo app" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("No envía solo");
    expect(dialog).toHaveTextContent("No recibe mensajes en Powip");
    // La ayuda del tipo de número no puede prometer envío automático ni chats.
    expect(dialog).not.toHaveTextContent("avisos automáticos de esta tienda");
    expect(dialog).not.toHaveTextContent("chats quedan en cola");
    expect(dialog).toHaveTextContent("una persona los envía desde él");
    await user.type(within(dialog).getByLabelText(/Número de WhatsApp/), "987 000 111");
    await user.click(within(dialog).getByRole("button", { name: "Guardar número" }));

    expect(connectAppOnly).toHaveBeenCalledWith({
      storeId: "store-livii",
      phoneNumber: "987 000 111",
      role: "store",
      seller: null,
    });
  });

  it("avisa si los avisos de una tienda con API pasarán a ser manuales", async () => {
    const user = userEvent.setup();
    render(
      view({
        mutations: { connectAppOnly: jest.fn() },
        accounts: { kind: "ready", data: [accountsFixture[0]] },
      }),
    );

    await user.click(screen.getByRole("button", { name: "Agregar número solo app" }));

    expect(screen.getByRole("dialog")).toHaveTextContent("dejarán de salir solos");
  });

  it("no avisa si el principal ya es solo app o el número es de una vendedora", async () => {
    const user = userEvent.setup();
    const apiSecondary = { ...accountsFixture[0], id: "cred-api", isPrimary: false };
    render(
      view({
        mutations: { connectAppOnly: jest.fn() },
        accounts: { kind: "ready", data: [appAccount, apiSecondary] },
      }),
    );

    await user.click(screen.getByRole("button", { name: "Agregar número solo app" }));

    expect(screen.getByRole("dialog")).not.toHaveTextContent("dejarán de salir solos");
  });

  it("pregunta antes de mover un número que está en otra tienda", async () => {
    const user = userEvent.setup();
    const connectAppOnly = jest
      .fn()
      .mockRejectedValueOnce({
        response: {
          data: {
            code: "WHATSAPP.PHONE_REASSIGN_CONFIRMATION_REQUIRED",
            message: "Ese número está en otra tienda.",
            details: { reason: "other_store" },
          },
        },
      })
      .mockResolvedValue(undefined);
    render(view({ mutations: { connectAppOnly }, accounts: { kind: "ready", data: [] } }));

    await user.click(screen.getByRole("button", { name: "Agregar número solo app" }));
    await user.type(screen.getByLabelText(/Número de WhatsApp/), "987000111");
    await user.click(screen.getByRole("button", { name: "Guardar número" }));
    await user.click(await screen.findByRole("button", { name: "Sí, mover el número" }));

    expect(connectAppOnly).toHaveBeenLastCalledWith(
      expect.objectContaining({ confirmReassign: true }),
    );
  });
});
