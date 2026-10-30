import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AUTO_REPLY_SUGGESTED } from "@/features/whatsapp/constants/whatsapp-conversation-catalog";
import { autoReplySettingsFixture } from "@/mocks/whatsapp/whatsapp-conversation.fixtures";
import { AutoReplyDialog } from "../AutoReplyDialog";

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

function renderDialog(props: Partial<Parameters<typeof AutoReplyDialog>[0]> = {}) {
  const onClose = jest.fn();
  render(
    <AutoReplyDialog
      settings={{ kind: "pending-integration" }}
      businessName="LIVII Store"
      canPersist={false}
      onClose={onClose}
      {...props}
    />,
  );
  return { onClose };
}

describe("AutoReplyDialog", () => {
  it("sin backend carga los textos sugeridos y aclara que no están guardados", () => {
    renderDialog();
    expect(screen.getByRole("textbox", { name: "En horario de atención" })).toHaveValue(
      AUTO_REPLY_SUGGESTED.inHoursText,
    );
    expect(screen.getByRole("textbox", { name: "Fuera de horario" })).toHaveValue(
      AUTO_REPLY_SUGGESTED.outOfHoursText,
    );
    expect(
      screen.getByText(
        /Valores sugeridos para una configuración nueva. No es una configuración guardada/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/Muestra con datos de ejemplo/)).toBeInTheDocument();
  });

  it("con configuración guardada muestra sus textos sin el aviso de sugeridos", () => {
    renderDialog({ settings: { kind: "ready", data: autoReplySettingsFixture } });
    expect(screen.getByRole("textbox", { name: "En horario de atención" })).toHaveValue(
      autoReplySettingsFixture.inHoursText,
    );
    expect(screen.queryByText(/Valores sugeridos/)).not.toBeInTheDocument();
  });

  it("la vista previa reemplaza las variables con datos de ejemplo", () => {
    renderDialog();
    const preview = screen.getByRole("figure");
    expect(preview).toHaveTextContent("¡Hola Lucía!");
    expect(preview).toHaveTextContent("powip.lat/r/EJEMPLO");
  });

  it("valida variables no permitidas y textos vacíos", async () => {
    renderDialog();
    const inHours = screen.getByRole("textbox", { name: "En horario de atención" });
    fireEvent.change(inHours, { target: { value: "Hola {{orden}}" } });
    expect(await screen.findByText(/Quita: \{\{orden\}\}/)).toBeInTheDocument();
    fireEvent.change(inHours, { target: { value: "" } });
    expect(await screen.findByText("Escribe el mensaje.")).toBeInTheDocument();
  });

  it("inserta variables en la posición del cursor", async () => {
    const user = userEvent.setup({ delay: null });
    renderDialog({ settings: { kind: "ready", data: null } });
    const outOfHours = screen.getByRole("textbox", { name: "Fuera de horario" });
    fireEvent.change(outOfHours, { target: { value: "Hola " } });
    (outOfHours as HTMLTextAreaElement).setSelectionRange(5, 5);
    await user.click(
      screen.getByRole("button", { name: /insertar Nombre del cliente en Fuera de horario/ }),
    );
    expect(outOfHours).toHaveValue("Hola {{cliente}}");
  });

  it("guardar queda bloqueado y no cierra ni guarda", async () => {
    const user = userEvent.setup({ delay: null });
    const onSave = jest.fn();
    const { onClose } = renderDialog({ onSave });
    const save = screen.getByRole("button", { name: "Guardar" });
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveAccessibleDescription(/Pendiente de integración/);
    await user.click(save);
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("pide confirmar el descarte de cambios", async () => {
    const user = userEvent.setup({ delay: null });
    const { onClose } = renderDialog();
    await user.click(screen.getByRole("switch"));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Descartar cambios" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sin cambios cierra directamente", async () => {
    const user = userEvent.setup({ delay: null });
    const { onClose } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Cerrar ventana" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("muestra carga y error sin formulario", () => {
    renderDialog({ settings: { kind: "error", message: "El servicio no respondió." } });
    expect(screen.getByText("No se pudo cargar la respuesta automática")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
