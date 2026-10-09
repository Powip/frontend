import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resolveEffectivePermissions } from "@/features/whatsapp/utils/whatsapp-permissions.util";
import {
  alertSettingsFixture,
  auditPageFixture,
  auditWithoutUsersFixture,
  mixedEffectivePermissionsFixture,
  optOutsPageFixture,
  permissionSettingsFixture,
  protectionSettingsFixture,
  recentAlertsFixture,
  SETTINGS_FIXTURE_NOW,
  settingsStoresFixture,
} from "@/mocks/whatsapp/whatsapp-settings.fixtures";
import { SettingsView, type SettingsViewProps } from "../SettingsView";

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

function baseProps(overrides: Partial<SettingsViewProps> = {}): SettingsViewProps {
  return {
    stores: settingsStoresFixture,
    storeContext: settingsStoresFixture[0],
    now: SETTINGS_FIXTURE_NOW,
    canManage: true,
    effectivePermissions: resolveEffectivePermissions(null),
    protection: PENDING,
    optOuts: PENDING,
    optOutSearch: "",
    onOptOutSearchChange: jest.fn(),
    alertSettings: PENDING,
    recentAlerts: PENDING,
    audit: PENDING,
    auditFilters: { entity: null, userId: null },
    onAuditFiltersChange: jest.fn(),
    permissionMatrix: PENDING,
    mutations: {},
    onOpenTab: jest.fn(),
    ...overrides,
  };
}

function withData(overrides: Partial<SettingsViewProps> = {}): SettingsViewProps {
  return baseProps({
    protection: { kind: "ready", data: protectionSettingsFixture },
    optOuts: { kind: "ready", data: optOutsPageFixture },
    alertSettings: { kind: "ready", data: alertSettingsFixture },
    recentAlerts: { kind: "ready", data: recentAlertsFixture },
    audit: { kind: "ready", data: auditPageFixture },
    permissionMatrix: { kind: "ready", data: permissionSettingsFixture },
    effectivePermissions: mixedEffectivePermissionsFixture,
    ...overrides,
  });
}

const section = (name: string) => screen.getByRole("region", { name });

describe("Sin backend", () => {
  it("usa sugeridos rotulados, sin registros ni permisos inventados", () => {
    render(<SettingsView {...baseProps()} />);
    expect(screen.getAllByText(/Valores sugeridos del documento/).length).toBe(3);
    expect(screen.getByText("Bajas pendientes de integración")).toBeInTheDocument();
    expect(screen.getByText("Alertas pendientes de integración")).toBeInTheDocument();
    expect(screen.getByText("Registro pendiente de integración")).toBeInTheDocument();
    const permissions = section("Permisos");
    expect(within(permissions).getAllByText("Sin confirmar")).toHaveLength(8);
    expect(within(permissions).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(permissions).getByText(/no está guardada ni se aplica/)).toBeInTheDocument();
  });
});

describe("Bajas", () => {
  it("el interruptor es un borrador revisable con guardado bloqueado y descarte confirmado", async () => {
    const user = userEvent.setup({ delay: null });
    render(<SettingsView {...baseProps()} />);
    const optOuts = section("Clientes que no quieren avisos");
    const toggle = within(optOuts).getByRole("switch");
    expect(toggle).toBeChecked();
    await user.click(toggle);
    const save = within(optOuts).getByRole("button", { name: "Guardar" });
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveAccessibleDescription(/Pendiente de integración.*permisos de WhatsApp/);
    await user.click(within(optOuts).getByRole("button", { name: "Descartar cambios" }));
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Descartar cambios" }));
    expect(within(optOuts).getByRole("switch")).toBeChecked();
  });

  it("un refetch no pisa el borrador y sin cambios toma lo nuevo", async () => {
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(<SettingsView {...withData()} />);
    const optOuts = section("Clientes que no quieren avisos");
    await user.click(within(optOuts).getByRole("switch"));
    rerender(
      <SettingsView
        {...withData({
          protection: { kind: "ready", data: { ...protectionSettingsFixture, version: 5 } },
        })}
      />,
    );
    expect(within(section("Clientes que no quieren avisos")).getByRole("switch")).not.toBeChecked();
    const foreign = section("Números extranjeros");
    expect(within(foreign).getByRole("switch")).not.toBeChecked();
    rerender(
      <SettingsView
        {...withData({
          protection: {
            kind: "ready",
            data: { ...protectionSettingsFixture, allowForeignOutbound: true, version: 6 },
          },
        })}
      />,
    );
    expect(within(section("Números extranjeros")).getByRole("switch")).toBeChecked();
  });

  it("muestra orígenes sin afirmar bloqueos que no informó Meta", () => {
    render(<SettingsView {...withData()} />);
    const table = within(section("Clientes que no quieren avisos")).getByRole("table");
    expect(within(table).getByText("Meta informó que bloqueó el número")).toBeInTheDocument();
    expect(within(table).getByText("Origen sin informar")).toBeInTheDocument();
    expect(within(table).getByText("Todas las tiendas")).toBeInTheDocument();
    expect(within(table).getAllByText(/bloque/i)).toHaveLength(1);
  });

  it("agregar número normaliza el teléfono, valida y no guarda", async () => {
    const user = userEvent.setup({ delay: null });
    const setItem = jest.spyOn(Storage.prototype, "setItem");
    render(<SettingsView {...baseProps()} />);
    await user.click(screen.getByRole("button", { name: "Agregar número" }));
    const dialog = screen.getByRole("dialog", { name: "Agregar número a bajas" });
    const phone = within(dialog).getByRole("textbox", { name: "Teléfono" });
    await user.click(phone);
    await user.paste("01 444 5566");
    await user.tab();
    expect(await within(dialog).findByText(/Escribe un celular de Perú/)).toBeInTheDocument();
    await user.clear(phone);
    await user.paste("987 654 321");
    expect(within(dialog).getByText("Se guardará como +51 987 654 321")).toBeInTheDocument();
    const add = within(dialog).getByRole("button", { name: "Agregar a bajas" });
    expect(add).toHaveAttribute("aria-disabled", "true");
    await user.click(add);
    expect(screen.getByRole("dialog", { name: "Agregar número a bajas" })).toBeInTheDocument();
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Descartar" }));
    expect(
      screen.queryByRole("dialog", { name: "Agregar número a bajas" }),
    ).not.toBeInTheDocument();
  });

  it("reactivar exige el pedido del comprador y queda bloqueado sin backend", async () => {
    const user = userEvent.setup({ delay: null });
    const reactivateOptOut = jest.fn().mockResolvedValue(undefined);
    render(
      <SettingsView
        {...withData({
          effectivePermissions: resolveEffectivePermissions(["WA_OPTOUTS"]),
          mutations: { reactivateOptOut },
        })}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Reactivar +51 955 444 333" }));
    const dialog = screen.getByRole("dialog", { name: "Reactivar avisos" });
    expect(dialog).toHaveTextContent(/quedará registrado quién lo hizo, cuándo y por qué/);
    await user.click(within(dialog).getByRole("button", { name: "Reactivar" }));
    expect(
      await within(dialog).findByText("Solo se reactiva si el comprador lo pidió."),
    ).toBeInTheDocument();
    expect(reactivateOptOut).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("textbox", { name: "Cómo lo pidió" }));
    await user.paste("Escribió al chat el 9 oct");
    await user.click(within(dialog).getByRole("button", { name: "Reactivar" }));
    expect(reactivateOptOut).toHaveBeenCalledWith({
      optOutId: "oo-1",
      note: "Escribió al chat el 9 oct",
    });
  });
});

describe("Alertas", () => {
  it("parte de los umbrales del documento y valida unidades y rangos", async () => {
    const user = userEvent.setup({ delay: null });
    render(<SettingsView {...baseProps()} />);
    const alerts = section("Alertas de salud");
    const inputs = within(alerts).getAllByRole("textbox");
    expect(inputs.map((input) => (input as HTMLInputElement).value)).toEqual(["5", "80", "30"]);
    fireEvent.change(inputs[0], { target: { value: "101" } });
    expect(
      await within(alerts).findByText("Escribe un número entero entre 1 y 100%."),
    ).toBeInTheDocument();
    fireEvent.change(inputs[2], { target: { value: "0" } });
    expect(
      await within(alerts).findByText("Escribe un número entero entre 1 y 1440 minutos."),
    ).toBeInTheDocument();
    const switches = within(alerts).getAllByRole("switch");
    await user.click(switches[4]);
    await waitFor(() =>
      expect(
        within(alerts).queryByText("Escribe un número entero entre 1 y 1440 minutos."),
      ).not.toBeInTheDocument(),
    );
    expect(within(alerts).getByRole("button", { name: "Guardar alertas" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(within(alerts).getByText(/esta pantalla no pausa nada/)).toBeInTheDocument();
    expect(within(alerts).getByText(/La campanita de POWIP todavía no existe/)).toBeInTheDocument();
  });

  it("«Ver» lleva solo a la pestaña relacionada", async () => {
    const user = userEvent.setup({ delay: null });
    const props = withData();
    render(<SettingsView {...props} />);
    const alerts = section("Alertas de salud");
    await user.click(within(alerts).getByRole("button", { name: "Ver en Conversaciones" }));
    expect(props.onOpenTab).toHaveBeenCalledWith("conversaciones");
    expect(within(alerts).getByText("Sin pestaña relacionada")).toBeInTheDocument();
  });
});

describe("Registro de cambios", () => {
  it("oculta secretos, muestra ausentes y no ofrece editar ni borrar", async () => {
    const user = userEvent.setup({ delay: null });
    render(<SettingsView {...withData()} />);
    const audit = section("Registro de cambios");
    const list = within(audit).getByRole("list", { name: "Cambios registrados" });
    const reconnect = within(list)
      .getAllByRole("listitem")
      .find((item) => item.textContent?.includes("reconectó")) as HTMLElement;
    expect(within(reconnect).getByText("Usuario sin informar")).toBeInTheDocument();
    await user.click(within(reconnect).getByRole("button", { name: "Ver antes y después" }));
    expect(reconnect.textContent).not.toMatch(/EAAG|otro-secreto/);
    expect(within(reconnect).getAllByText(/Oculto por seguridad/).length).toBeGreaterThan(0);
    expect(
      within(audit).queryByRole("button", { name: /Editar|Eliminar|Borrar/ }),
    ).not.toBeInTheDocument();
  });

  it("recorta valores largos y deja ver el completo", async () => {
    const user = userEvent.setup({ delay: null });
    render(<SettingsView {...withData()} />);
    const list = within(section("Registro de cambios")).getByRole("list", {
      name: "Cambios registrados",
    });
    const reactivation = within(list)
      .getAllByRole("listitem")
      .find((item) => item.textContent?.includes("reactivó")) as HTMLElement;
    await user.click(within(reactivation).getByRole("button", { name: "Ver antes y después" }));
    expect(within(reactivation).getAllByText("Sin dato").length).toBeGreaterThan(0);
    await user.click(within(reactivation).getByRole("button", { name: "Ver completo" }));
    expect(reactivation).toHaveTextContent("incluidos los envíos a provincia.");
  });

  it("sin la lista de usuarios de backend no inventa el filtro", () => {
    render(
      <SettingsView {...withData({ audit: { kind: "ready", data: auditWithoutUsersFixture } })} />,
    );
    const user = within(section("Registro de cambios")).getByRole("combobox", { name: "Usuario" });
    expect(user).toBeDisabled();
    expect(user).toHaveAccessibleDescription(/cuando POWIP informe quiénes hicieron cambios/);
  });
});

describe("Permisos", () => {
  it("separa permisos efectivos de la matriz y no aplica cambios locales", async () => {
    const user = userEvent.setup({ delay: null });
    render(<SettingsView {...withData()} />);
    const permissions = section("Permisos");
    expect(within(permissions).getAllByText("Permitido")).toHaveLength(3);
    expect(within(permissions).getAllByText("Sin confirmar")).toHaveLength(1);
    const admin = within(permissions).getByRole("checkbox", {
      name: "Ver conversaciones · Administrador: siempre permitido, no se puede quitar",
    });
    expect(admin).toBeChecked();
    expect(admin).toBeDisabled();
    await user.click(
      within(permissions).getByRole("checkbox", {
        name: "Crear y editar plantillas · Supervisor CC",
      }),
    );
    expect(within(permissions).getByText(/1 cambio sin guardar/)).toBeInTheDocument();
    expect(within(permissions).getAllByText("Permitido")).toHaveLength(3);
    expect(within(permissions).getByRole("button", { name: "Guardar permisos" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("sin permiso de configuración la matriz es de solo lectura", () => {
    render(<SettingsView {...withData({ canManage: false })} />);
    expect(within(section("Permisos")).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agregar número" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Reactivar/ })).not.toBeInTheDocument();
  });
});
