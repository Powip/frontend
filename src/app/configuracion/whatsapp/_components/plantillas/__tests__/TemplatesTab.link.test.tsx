import { pendingNewTemplateFixture } from "@/mocks/whatsapp/whatsapp-templates.fixtures";
import { buildApprovedNotice } from "../TemplatesTab";

describe("aviso de aprobación", () => {
  it("no existe sin una plantilla aprobada real", () => {
    expect(
      buildApprovedNotice(null, {
        canActivateRule: true,
        onActivateRule: jest.fn(),
        onDismiss: jest.fn(),
      }),
    ).toBeNull();
  });

  it("«Activar en una regla» delega la navegación con la plantilla", () => {
    const onActivateRule = jest.fn();
    const notice = buildApprovedNotice(pendingNewTemplateFixture, {
      canActivateRule: true,
      onActivateRule,
      onDismiss: jest.fn(),
    });
    expect(notice?.templateName).toBe("saldo_pendiente");
    expect(notice?.canActivateRule).toBe(true);
    notice?.onActivateRule();
    expect(onActivateRule).toHaveBeenCalledWith(pendingNewTemplateFixture);
  });

  it("sin permiso o sin navegación no ofrece activar", () => {
    expect(
      buildApprovedNotice(pendingNewTemplateFixture, {
        canActivateRule: false,
        onActivateRule: jest.fn(),
        onDismiss: jest.fn(),
      })?.canActivateRule,
    ).toBe(false);
    expect(
      buildApprovedNotice(pendingNewTemplateFixture, {
        canActivateRule: true,
        onDismiss: jest.fn(),
      })?.canActivateRule,
    ).toBe(false);
  });
});
