import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resolveEffectivePermissions } from "@/features/whatsapp/utils/whatsapp-permissions.util";
import {
  alertSettingsFixture,
  auditPageFixture,
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
  it("usa sugeridos rotulados y no muestra alertas, registro ni permisos", () => {
    render(<SettingsView {...baseProps()} />);
    expect(screen.getAllByText(/Valores sugeridos del documento/).length).toBeGreaterThan(0);
    expect(screen.getByText("Bajas pendientes de integración")).toBeInTheDocument();
    // Alertas, registro de cambios y permisos vuelven cuando POWIP los guarde.
    expect(screen.queryByText("Alertas pendientes de integración")).not.toBeInTheDocument();
    expect(screen.queryByText("Registro pendiente de integración")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Permisos" })).not.toBeInTheDocument();
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

