import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  approvedTemplateFixture,
  pendingWithApprovedVersionTemplateFixture,
  rejectedTemplateFixture,
} from "@/mocks/whatsapp/whatsapp-templates.fixtures";
import { TemplateEditorDialog, type TemplateEditorMode } from "../TemplateEditorDialog";
import { TemplatesTab } from "../TemplatesTab";

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

function renderEditor(
  mode: TemplateEditorMode = { kind: "new" },
  props: Partial<Parameters<typeof TemplateEditorDialog>[0]> = {},
) {
  const onClose = jest.fn();
  const onSaveDraft = jest.fn();
  const onSubmitForReview = jest.fn();
  render(
    <TemplateEditorDialog
      open
      mode={mode}
      businessName="LIVII Store"
      canManage
      canPersist={false}
      onClose={onClose}
      onSaveDraft={onSaveDraft}
      onSubmitForReview={onSubmitForReview}
      {...props}
    />,
  );
  return { onClose, onSaveDraft, onSubmitForReview, user: userEvent.setup({ delay: null }) };
}

const bodyField = () => screen.getByRole("textbox", { name: "Mensaje" }) as HTMLTextAreaElement;
const preview = () => screen.getByRole("figure", { name: /Vista previa del mensaje/ });
const chip = (label: string) =>
  screen.getByRole("button", { name: new RegExp(`^Insertar variable ${label}`) });

describe("TemplateEditorDialog · nueva plantilla", () => {
  it("muestra el nombre técnico en vivo", async () => {
    const { user } = renderEditor();
    await user.click(screen.getByRole("textbox", { name: "Nombre interno" }));
    await user.paste("Guía creada");
    expect(screen.getByText("guia_creada")).toBeInTheDocument();
  });

  it("inserta la variable en la posición del cursor y conserva foco y cursor", async () => {
    const { user } = renderEditor();
    const body = bodyField();
    await user.click(body);
    await user.paste("Hola , tu pedido llegó");
    body.setSelectionRange(5, 5);
    await user.click(chip("Nombre del cliente"));
    expect(body.value).toBe("Hola {{cliente}}, tu pedido llegó");
    expect(document.activeElement).toBe(body);
    expect(body.selectionStart).toBe(16);
    expect(body.selectionEnd).toBe(16);
    expect(within(preview()).getByText("Carlos")).toBeInTheDocument();
  });

  it("reemplaza la selección y funciona con teclado", async () => {
    const { user } = renderEditor();
    const body = bodyField();
    await user.click(body);
    await user.paste("Tu pedido XXX ya salió");
    body.setSelectionRange(10, 13);
    chip("N° de pedido").focus();
    await user.keyboard("{Enter}");
    expect(body.value).toBe("Tu pedido {{orden}} ya salió");
    expect(document.activeElement).toBe(body);
    expect(body.selectionStart).toBe(19);
  });

  it("identifica los valores de la vista previa como datos de muestra", () => {
    renderEditor();
    expect(screen.getByText("Datos de muestra")).toBeInTheDocument();
    expect(screen.getByText(/no con un pedido real/)).toBeInTheDocument();
  });

  it("configura A/B, inserta en la versión B y previsualiza ambas", async () => {
    const { user } = renderEditor();
    await user.click(bodyField());
    await user.paste("Versión A para ");
    await user.click(screen.getByRole("switch", { name: "Probar dos versiones (A/B)" }));
    const bodyB = screen.getByRole("textbox", {
      name: "Mensaje de la versión B",
    }) as HTMLTextAreaElement;
    await user.click(bodyB);
    await user.paste("Versión B para ");
    expect(screen.getByText(/Se inserta en: Mensaje de la versión B/)).toBeInTheDocument();
    await user.click(chip("Nombre del cliente"));
    expect(bodyB.value).toBe("Versión B para {{cliente}}");
    expect(bodyField().value).toBe("Versión A para ");

    await user.click(screen.getByRole("radio", { name: "Vista previa B" }));
    expect(preview()).toHaveTextContent("Versión B para Carlos");
    expect(screen.getByRole("heading", { name: /Vista previa · versión B/ })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Vista previa A" }));
    expect(preview()).toHaveTextContent("Versión A para");
    expect(preview()).not.toHaveTextContent("Versión B");
    expect(screen.getByRole("textbox", { name: /Elegir ganadora/ })).toHaveValue("200");
  });

  it("muestra los errores junto a cada campo", async () => {
    const { user } = renderEditor();
    const name = screen.getByRole("textbox", { name: "Nombre interno" });
    await user.click(name);
    await user.tab();
    expect(await screen.findByText("Escribe un nombre interno.")).toBeInTheDocument();
    expect(name).toHaveAttribute("aria-invalid", "true");

    await user.click(screen.getByRole("radio", { name: "Texto" }));
    const header = screen.getByRole("textbox", { name: "Texto del encabezado" });
    await user.click(header);
    await user.paste("x".repeat(61));
    await user.tab();
    expect(await screen.findByText("Máximo 60 caracteres.")).toBeInTheDocument();

    const button = screen.getByRole("textbox", { name: "Texto del botón de enlace" });
    await user.clear(button);
    await user.tab();
    expect(await screen.findByText("Escribe el texto del botón.")).toBeInTheDocument();
  });

  it("habilita el encabezado PDF solo para Comprobante emitido", async () => {
    const { user } = renderEditor();
    expect(screen.getByRole("radio", { name: "Documento PDF" })).toBeDisabled();

    await user.click(screen.getByRole("combobox", { name: "Se usa en" }));
    await user.click(await screen.findByRole("option", { name: "Comprobante emitido" }));
    const documentOption = screen.getByRole("radio", { name: "Documento PDF" });
    expect(documentOption).toBeEnabled();
    await user.click(documentOption);
    expect(within(preview()).getByText("B001-000482.pdf")).toBeInTheDocument();
    expect(chip("Serie y número SUNAT")).toBeInTheDocument();

    await user.click(screen.getByRole("combobox", { name: "Se usa en" }));
    await user.click(await screen.findByRole("option", { name: "Guía creada" }));
    expect(screen.getByRole("radio", { name: "Ninguno" })).toBeChecked();
    expect(screen.queryByRole("button", { name: /Serie y número SUNAT/ })).not.toBeInTheDocument();
  });

  it("advierte lenguaje promocional en Utilidad sin bloquear", async () => {
    const { user } = renderEditor();
    await user.click(bodyField());
    await user.paste("Aprovecha la oferta");
    expect(screen.getByText(/Meta suele rechazar plantillas de Utilidad/)).toBeInTheDocument();
    expect(screen.getByText(/«oferta»/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Marketing" }));
    expect(
      screen.queryByText(/Meta suele rechazar plantillas de Utilidad/),
    ).not.toBeInTheDocument();
  });

  it("aplica el texto sugerido del uso elegido", async () => {
    const { user } = renderEditor();
    await user.click(
      screen.getByRole("button", { name: /Usar texto sugerido para «Pedido en camino»/ }),
    );
    expect(bodyField().value).toMatch(/^Hola \{\{cliente\}\}, tu pedido/);
    expect(screen.getByRole("textbox", { name: "Texto del encabezado" })).toHaveValue(
      "📦 Tu pedido va en camino",
    );
  });
});

describe("TemplateEditorDialog · sin backend", () => {
  it("guardar y enviar quedan deshabilitados con explicación y no guardan nada", async () => {
    const setItem = jest.spyOn(Storage.prototype, "setItem");
    const { user, onClose, onSaveDraft, onSubmitForReview } = renderEditor();
    await user.click(screen.getByRole("textbox", { name: "Nombre interno" }));
    await user.paste("Pedido en camino");
    await user.type(bodyField(), "Hola");

    const save = screen.getByRole("button", { name: "Guardar borrador" });
    const submit = screen.getByRole("button", { name: "Enviar a revisión de Meta" });
    for (const button of [save, submit]) {
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAccessibleDescription(
        /estarán disponibles cuando se conecte el servicio/,
      );
      await user.click(button);
    }
    expect(onSaveDraft).not.toHaveBeenCalled();
    expect(onSubmitForReview).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Nueva plantilla" })).toBeInTheDocument();
    expect(screen.queryByText(/guardad[ao]|enviada a revisión/i)).not.toBeInTheDocument();
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });
});

describe("TemplateEditorDialog · descarte", () => {
  it("cierra sin preguntar si no hay cambios", async () => {
    const { user, onClose } = renderEditor();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("pide confirmación al cerrar con cambios", async () => {
    const { user, onClose } = renderEditor();
    await user.type(bodyField(), "Hola");
    await user.click(screen.getByRole("button", { name: "Cerrar ventana" }));
    const confirm = await screen.findByRole("alertdialog", { name: "¿Descartar los cambios?" });
    await user.click(within(confirm).getByRole("button", { name: "Seguir editando" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(bodyField().value).toBe("Hola");

    await user.keyboard("{Escape}");
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Descartar cambios",
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("al reabrir no conserva datos de la sesión anterior", async () => {
    const user = userEvent.setup({ delay: null });
    render(<TemplatesTab canManage businessName="LIVII Store" />);
    await user.click(screen.getByRole("button", { name: "Nueva plantilla" }));
    await user.click(screen.getByRole("textbox", { name: "Nombre interno" }));
    await user.paste("Borrador viejo");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    const confirmDiscard = await screen.findByRole("alertdialog");
    await user.click(within(confirmDiscard).getByRole("button", { name: "Descartar cambios" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("note")).toHaveTextContent(
      "Listado de plantillas pendiente de integración",
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Nueva plantilla" }));
    expect(screen.getByRole("textbox", { name: "Nombre interno" })).toHaveValue("");
    expect(screen.queryByDisplayValue("Borrador viejo")).not.toBeInTheDocument();
  });
});

describe("TemplateEditorDialog · estados de Meta", () => {
  it("una plantilla en revisión es de solo lectura y muestra la versión aprobada en uso", () => {
    renderEditor({ kind: "edit", template: pendingWithApprovedVersionTemplateFixture });
    expect(screen.getByRole("dialog", { name: "Ver plantilla" })).toBeInTheDocument();
    expect(screen.getByText(/Meta está revisando esta plantilla/)).toBeInTheDocument();
    expect(screen.getByText("Ver la versión aprobada que se sigue enviando")).toBeInTheDocument();
    expect(bodyField()).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Guardar borrador" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument();
  });

  it("una aprobada se reenvía a revisión y una rechazada muestra el motivo de Meta", () => {
    const { unmount } = render(
      <TemplateEditorDialog
        open
        mode={{ kind: "edit", template: approvedTemplateFixture }}
        businessName="LIVII Store"
        canManage
        canPersist={false}
        onClose={jest.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Guardar y reenviar a revisión" }),
    ).toBeInTheDocument();
    expect(bodyField().value).toBe(approvedTemplateFixture.body);
    unmount();

    renderEditor({ kind: "edit", template: rejectedTemplateFixture });
    expect(screen.getByText(rejectedTemplateFixture.metaReason ?? "")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar a revisión de Meta" })).toBeInTheDocument();
  });

  it("al duplicar propone un nombre nuevo y explica que es otra plantilla", () => {
    renderEditor({ kind: "duplicate", template: approvedTemplateFixture });
    expect(screen.getByRole("dialog", { name: "Duplicar plantilla" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nombre interno" })).toHaveValue(
      "Guia creada copia",
    );
    expect(screen.getByText(/Meta la revisa desde cero/)).toBeInTheDocument();
  });

  it("sin permisos se ve en solo lectura", () => {
    renderEditor({ kind: "edit", template: approvedTemplateFixture }, { canManage: false });
    expect(
      screen.getByText("Solo un administrador puede crear o editar plantillas."),
    ).toBeInTheDocument();
    expect(bodyField()).toBeDisabled();
    expect(chip("Nombre del cliente")).toBeDisabled();
  });
});
