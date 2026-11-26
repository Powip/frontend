import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resolveEffectivePermissions } from "@/features/whatsapp/utils/whatsapp-permissions.util";
import {
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
const api = {
  ...liviiAccountFixture,
  id: "cred-api",
  phone: "+51987000111",
  connectionType: "api" as const,
  isPrimary: true,
};
const second = { ...api, id: "cred-2", phone: "+51987000222", isPrimary: false };

function view(overrides: Partial<ConnectionViewProps> = {}) {
  return (
    <ConnectionView
      stores={connectionStoresFixture}
      storeId="store-livii"
      onStoreChange={jest.fn()}
      now={CONNECTION_FIXTURE_NOW}
      canManage
      effectivePermissions={resolveEffectivePermissions(["WA_CONNECTION"])}
      status={{ kind: "ready", data: { ...connectedStatusFixture, connectionType: "api" } }}
      account={{ kind: "ready", data: api }}
      accounts={{ kind: "ready", data: [api] }}
      templates={PENDING}
      testRun={null}
      contingency={PENDING}
      agents={PENDING}
      assistedQueue={PENDING}
      pricing={PENDING}
      usage={PENDING}
      signupAvailable
      mutations={{}}
      {...overrides}
    />
  );
}

const types = () => within(screen.getByRole("region", { name: "Tipo de conexión" }));
const card = (name: RegExp) => types().getByRole("button", { name });
const APP = /Solo app WhatsApp Business/;
const COEX = /API \+ app WhatsApp Business/;

describe("Cambiar el modo desde las tarjetas", () => {
  it("avisa antes de pasar a «Solo app» y la marca sigue al modo guardado", async () => {
    const user = userEvent.setup();
    const switchToApp = jest.fn().mockResolvedValue(undefined);
    render(view({ mutations: { switchToApp } }));

    await user.click(card(APP));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("deja de enviar solo y de recibir mensajes");
    expect(switchToApp).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Sí, cambiar" }));

    expect(switchToApp).toHaveBeenCalledWith("cred-api");
    // El estado del servidor sigue diciendo «api»: la marca no se adelanta.
    expect(card(APP)).toHaveAttribute("aria-pressed", "false");
  });

  it("cancelar no cambia nada", async () => {
    const user = userEvent.setup();
    const switchToApp = jest.fn();
    render(view({ mutations: { switchToApp } }));

    await user.click(card(APP));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(switchToApp).not.toHaveBeenCalled();
  });

  it("muestra el error si no se guardó", async () => {
    const user = userEvent.setup();
    render(view({ mutations: { switchToApp: jest.fn().mockRejectedValue(new Error("falló")) } }));

    await user.click(card(APP));
    await user.click(screen.getByRole("button", { name: "Sí, cambiar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("falló");
  });

  it("abre la reconexión del mismo número y no toca vendedora ni principal", async () => {
    const user = userEvent.setup();
    const startSignup = jest.fn().mockResolvedValue(undefined);
    render(view({ mutations: { startSignup } }));

    await user.click(card(COEX));
    await user.click(screen.getByRole("button", { name: "Sí, volver a conectar" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Volver a conectar +51987000111");
    await user.click(within(dialog).getByRole("button", { name: "Continuar con Facebook" }));

    expect(startSignup).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "coex",
        expectedPhoneNumber: "+51987000111",
        keepRole: true,
      }),
    );
  });

  it("con varios números pregunta cuál", async () => {
    const user = userEvent.setup();
    const switchToApp = jest.fn().mockResolvedValue(undefined);
    render(view({ mutations: { switchToApp }, accounts: { kind: "ready", data: [api, second] } }));

    await user.click(card(APP));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: "Seguir" })).toBeDisabled();
    await user.click(within(dialog).getByRole("radio", { name: /\+51987000222/ }));
    await user.click(within(dialog).getByRole("button", { name: "Seguir" }));
    await user.click(screen.getByRole("button", { name: "Sí, cambiar" }));

    expect(switchToApp).toHaveBeenCalledWith("cred-2");
  });

  it("sin número no cambia nada y manda abajo", async () => {
    const user = userEvent.setup();
    render(view({ accounts: { kind: "ready", data: [] } }));

    await user.click(card(APP));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(types().getByRole("status")).toHaveTextContent("Elige cómo conectarlo abajo");
  });

  it("sin permiso las tarjetas no se pueden tocar", () => {
    render(view({ effectivePermissions: resolveEffectivePermissions([]) }));
    expect(card(APP)).toBeDisabled();
  });
});
