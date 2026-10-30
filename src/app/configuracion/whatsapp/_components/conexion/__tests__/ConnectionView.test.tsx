import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resolveEffectivePermissions } from "@/features/whatsapp/utils/whatsapp-permissions.util";
import {
  accountsFixture,
  assistedQueueFixture,
  CONNECTION_FIXTURE_NOW,
  connectedStatusFixture,
  connectionStoresFixture,
  contingencyFixture,
  liviiAccountFixture,
  partialAccountFixture,
  pricingFixture,
  redQualityAccountFixture,
  stalePricingFixture,
  testRunFixtures,
  usageFixture,
} from "@/mocks/whatsapp/whatsapp-connection.fixtures";
import { conversationAgentsFixture } from "@/mocks/whatsapp/whatsapp-conversation.fixtures";
import { schedulingTemplatesFixture } from "@/mocks/whatsapp/whatsapp-scheduling.fixtures";
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

function props(overrides: Partial<ConnectionViewProps> = {}): ConnectionViewProps {
  return {
    stores: connectionStoresFixture,
    storeId: "store-livii",
    onStoreChange: jest.fn(),
    now: CONNECTION_FIXTURE_NOW,
    canManage: true,
    effectivePermissions: resolveEffectivePermissions(null),
    status: PENDING,
    account: PENDING,
    accounts: PENDING,
    templates: PENDING,
    testRun: null,
    contingency: PENDING,
    agents: PENDING,
    assistedQueue: PENDING,
    pricing: PENDING,
    usage: PENDING,
    signupAvailable: false,
    mutations: {},
    ...overrides,
  };
}

function connected(overrides: Partial<ConnectionViewProps> = {}) {
  return props({
    status: { kind: "ready", data: connectedStatusFixture },
    account: { kind: "ready", data: liviiAccountFixture },
    accounts: { kind: "ready", data: accountsFixture },
    templates: { kind: "ready", data: schedulingTemplatesFixture },
    contingency: { kind: "ready", data: contingencyFixture },
    agents: { kind: "ready", data: conversationAgentsFixture },
    assistedQueue: { kind: "ready", data: assistedQueueFixture },
    pricing: { kind: "ready", data: pricingFixture },
    usage: { kind: "ready", data: usageFixture },
    ...overrides,
  });
}

const section = (name: string) => screen.getByRole("region", { name });

describe("Conexión sin backend", () => {
  it("no da por desconectada ni conectada a la tienda y bloquea acciones", () => {
    render(<ConnectionView {...props()} />);
    expect(screen.getByText("Estado de conexión pendiente de integración")).toBeInTheDocument();
    expect(within(section("Tipo de conexión")).queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByText(/Desconectado|Sin conectar/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar prueba" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(within(section("Costo de los mensajes")).queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("Tipo de conexión", () => {
  it("separa la selección local del tipo real y pide confirmación", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ConnectionView {...connected()} />);
    const types = section("Tipo de conexión");
    expect(within(types).getByRole("radio", { name: /API oficial de WhatsApp/ })).toBeChecked();
    await user.click(within(types).getByRole("radio", { name: /API \+ app WhatsApp Business/ }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent(/volver a conectar el número con Meta/);
    expect(within(dialog).getByRole("button", { name: "Cambiar" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(within(types).getByRole("radio", { name: /API oficial de WhatsApp/ })).toBeChecked();
    expect(screen.getByText("Conectado · API oficial")).toBeInTheDocument();
  });
});

describe("Número conectado", () => {
  it("muestra los datos de Meta y copia IDs", () => {
    render(<ConnectionView {...connected()} />);
    const number = section("Número conectado");
    expect(within(number).getByText("LIVII Store")).toBeInTheDocument();
    expect(within(number).getByText("Alta")).toBeInTheDocument();
    expect(within(number).getByText("310 559 812 447 021")).toBeInTheDocument();
    expect(
      within(number).getByRole("progressbar", { name: "Uso del límite diario" }),
    ).toHaveAttribute("aria-valuenow", "31");
    expect(within(number).getByText("Activo · último evento hace 2 min")).toBeInTheDocument();
  });

  it("los datos faltantes dicen «Sin dato» y no se convierten en cero", () => {
    render(
      <ConnectionView
        {...connected({ account: { kind: "ready", data: partialAccountFixture } })}
      />,
    );
    const number = section("Número conectado");
    expect(within(number).getByText("Sin dato de Meta")).toBeInTheDocument();
    expect(within(number).getByText("Sin dato de uso")).toBeInTheDocument();
    expect(within(number).getByText("Meta no informó cuándo se reinicia")).toBeInTheDocument();
    expect(within(number).queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("con el reinicio vencido no inventa uno nuevo", () => {
    render(
      <ConnectionView
        {...connected({ account: { kind: "ready", data: redQualityAccountFixture } })}
      />,
    );
    expect(screen.getByText("Reinicio pendiente de confirmar por Meta")).toBeInTheDocument();
    expect(screen.getByText("Baja")).toBeInTheDocument();
  });

  it("desconectar pide confirmación con su efecto y queda bloqueado", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ConnectionView {...connected()} />);
    await user.click(
      within(section("Número conectado")).getByRole("button", { name: "Desconectar" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "¿Desconectar el número de LIVII?",
    });
    expect(dialog).toHaveTextContent(/plantillas y el historial se conservan/);
    const confirm = within(dialog).getByRole("button", { name: "Desconectar" });
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    await user.click(confirm);
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});

describe("Mensaje de prueba", () => {
  it("con una prueba en curso no permite otra", () => {
    render(<ConnectionView {...connected({ testRun: testRunFixtures.queued })} />);
    const test = section("Enviar mensaje de prueba");
    expect(within(test).getByRole("button", { name: "Enviar prueba" })).toHaveAccessibleDescription(
      /Pendiente de integración/,
    );
    expect(within(test).getByRole("list", { name: "Estados de la prueba" })).toHaveTextContent(
      "Enviado · sin confirmar",
    );
  });

  it("termina en entregado aunque Leído no llegue", () => {
    render(<ConnectionView {...connected({ testRun: testRunFixtures.deliveredWithoutRead })} />);
    expect(screen.getByText(/«Leído» puede no aparecer.*la prueba terminó/)).toBeInTheDocument();
  });

  it("muestra el fallo informado", () => {
    render(<ConnectionView {...connected({ testRun: testRunFixtures.failed })} />);
    expect(within(section("Enviar mensaje de prueba")).getByRole("alert")).toHaveTextContent(
      "El número no tiene WhatsApp.",
    );
  });
});

describe("Números por tienda y Embedded Signup", () => {
  it("abre la conexión sin formularios propios de credenciales ni SMS y la bloquea sin configuración", async () => {
    const user = userEvent.setup({ delay: null });
    const view = connected();
    render(<ConnectionView {...view} />);
    const stores = section("Números por tienda");
    await user.click(within(stores).getByRole("button", { name: "Ver detalle de NOVA Home" }));
    expect(view.onStoreChange).toHaveBeenCalledWith("store-nova");
    await user.click(within(stores).getByRole("button", { name: "Conectar número de KUNCA" }));
    const dialog = screen.getByRole("dialog", { name: "Conectar número de KUNCA" });
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
    expect(dialog).toHaveTextContent(/ocurren en la ventana de Meta, no en POWIP/);
    const start = within(dialog).getByRole("button", { name: "Continuar con Facebook" });
    expect(start).toHaveAttribute("aria-disabled", "true");
    expect(start).toHaveAccessibleDescription(/Falta configurar la app de Meta/);
    await user.click(start);
    expect(within(dialog).queryByText(/Completa los pasos/)).not.toBeInTheDocument();
  });

  it("solo muestra conectado cuando POWIP lo confirma", async () => {
    const user = userEvent.setup({ delay: null });
    const startSignup = jest.fn().mockRejectedValue(new Error("Cerraste la ventana de Meta."));
    render(
      <ConnectionView
        {...connected({
          signupAvailable: true,
          effectivePermissions: resolveEffectivePermissions(["WA_CONNECTION"]),
          mutations: { startSignup },
        })}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Conectar número de KUNCA" }));
    await user.click(screen.getByRole("button", { name: "Continuar con Facebook" }));
    expect(startSignup).toHaveBeenCalledWith({ storeId: "store-kunca", mode: "api" });
    expect(await screen.findByRole("alert")).toHaveTextContent("Cerraste la ventana de Meta.");
    expect(screen.queryByText(/POWIP confirmó la conexión/)).not.toBeInTheDocument();
  });
});

describe("Contingencia y bandeja asistida", () => {
  it("abrir WhatsApp no marca enviado ni baja el contador", async () => {
    const user = userEvent.setup({ delay: null });
    const markAssistedOpened = jest.fn().mockResolvedValue(undefined);
    render(<ConnectionView {...connected({ mutations: { markAssistedOpened } })} />);
    const inbox = section("Bandeja de envío asistido");
    const link = within(inbox).getAllByRole("link", { name: /Abrir en WhatsApp/ })[0];
    expect(link).toHaveAttribute("href", "https://wa.me/51987111222?text=Hola%20Carlos");
    expect(link).toHaveAttribute("target", "_blank");
    link.addEventListener("click", (event) => event.preventDefault());
    await user.click(link);
    expect(markAssistedOpened).toHaveBeenCalledWith("as-1");
    expect(within(inbox).getByText("7 por enviar")).toBeInTheDocument();
    expect(within(inbox).getAllByText("Por enviar")).toHaveLength(2);
    expect(within(inbox).getAllByRole("button", { name: "Ya lo envié" })[0]).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("sin enlace de backend no ofrece abrir WhatsApp", () => {
    render(<ConnectionView {...connected()} />);
    const inbox = section("Bandeja de envío asistido");
    expect(
      within(inbox).getByRole("button", { name: "Abrir en WhatsApp" }),
    ).toHaveAccessibleDescription("POWIP no generó el enlace de WhatsApp para este aviso.");
  });

  it("muestra la contingencia activa y valida motivos excluyentes", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ConnectionView {...connected()} />);
    const contingency = section("Número de contingencia");
    expect(contingency).toHaveTextContent(/Contingencia activa desde 08\/10\/2026 10:15/);
    await user.click(
      within(contingency).getByRole("checkbox", { name: "Solo cuando yo la active (manual)" }),
    );
    expect(
      await within(contingency).findByText(
        "«Solo cuando yo la active» no se combina con los demás motivos.",
      ),
    ).toBeInTheDocument();
    expect(
      within(contingency).getByRole("button", { name: "Guardar contingencia" }),
    ).toHaveAttribute("aria-disabled", "true");
  });
});

describe("Costos", () => {
  it("muestra fuente y vigencia, y avisa si no están verificadas", () => {
    const { rerender } = render(<ConnectionView {...connected()} />);
    const cost = section("Costo de los mensajes");
    expect(cost).toHaveTextContent(
      /vigentes desde 01\/10\/2026 · fuente: Fuente de ejemplo para Storybook/,
    );
    expect(within(cost).queryByText(/no verificadas/)).not.toBeInTheDocument();
    rerender(
      <ConnectionView {...connected({ pricing: { kind: "ready", data: stalePricingFixture } })} />,
    );
    expect(
      within(section("Costo de los mensajes")).getByText(/no verificadas recientemente/),
    ).toBeInTheDocument();
  });
});
