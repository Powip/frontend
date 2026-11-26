import { render, screen } from "@testing-library/react";
import { toWhatsAppRule } from "@/features/whatsapp/mappers/to-whatsapp-rules.mapper";
import { ActivateRuleDialog } from "../ActivateRuleDialog";
import { RuleCard } from "../RuleCard";

const dto = {
  id: "r1",
  key: "pedido_en_camino" as const,
  label: "Pedido en camino",
  triggerLabel: null,
  templateId: null,
  active: false,
  blockedReason: null,
  when: { mode: "now" as const, minutes: null, time: null, hours: null },
  allowedWhenModes: ["now" as const],
  reminder: null,
  scope: {
    dateMode: "from_today" as const,
    from: null,
    to: null,
    maxOrderAgeDays: 30,
    storeIds: [],
    salesChannels: [],
    shippingTypes: [],
    courierIds: [],
  },
  stats: null,
  activatedAt: null,
  version: 1,
};

it("conserva que el aviso se envía a mano", () => {
  expect(toWhatsAppRule({ ...dto, manualSend: true } as never).manualSend).toBe(true);
  expect(toWhatsAppRule(dto as never).manualSend).toBe(false);
});

describe("tarjeta del aviso en una tienda «Solo app»", () => {
  beforeAll(() => {
    global.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  const card = (manualSend: boolean) =>
    render(
      <RuleCard
        rule={toWhatsAppRule({ ...dto, templateId: "t1", manualSend } as never)}
        templates={{
          kind: "ready",
          data: [{ id: "t1", name: "pedido_en_camino", status: "PENDING" } as never],
        }}
        catalogs={{ stores: [], salesChannels: [], shippingTypes: [], couriers: [] } as never}
        canManage
        canPersist
        persistenceNoteId="note"
        highlighted={false}
        preselectTemplateId={null}
        onRequestActivation={jest.fn()}
        onRequestDeactivation={jest.fn()}
        onPreviewTemplate={jest.fn()}
      />,
    );

  it("se puede activar aunque Meta no haya aprobado la plantilla y dice que es a mano", () => {
    card(true);
    expect(screen.getByRole("switch")).toBeEnabled();
    expect(screen.getByText(/Se envía a mano/)).toBeInTheDocument();
    expect(screen.queryByText(/Podrás activar este aviso/)).not.toBeInTheDocument();
  });

  it("con API sigue exigiendo la plantilla aprobada", () => {
    card(false);
    expect(screen.getByRole("switch")).toBeDisabled();
  });
});

describe("ventana de activar en una tienda «Solo app»", () => {
  const dialog = (manualSend: boolean) =>
    render(
      <ActivateRuleDialog
        request={
          {
            rule: toWhatsAppRule({ ...dto, manualSend } as never),
            mode: "activate",
            scopeSummary: "Todas las tiendas",
            hasUnsavedChanges: false,
          } as never
        }
        preview={{ kind: "pending-integration" }}
        canPersist
        onClose={jest.fn()}
      />,
    );

  it("no promete que los pedidos actuales se envían solos", () => {
    dialog(true);
    expect(
      screen.getByText("Quedan en la bandeja de envío asistido para enviarlos a mano."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Se envían respetando/)).not.toBeInTheDocument();
  });

  it("con API mantiene el texto de envío con horario", () => {
    dialog(false);
    expect(screen.getByText("Se envían respetando el horario permitido.")).toBeInTheDocument();
  });
});
