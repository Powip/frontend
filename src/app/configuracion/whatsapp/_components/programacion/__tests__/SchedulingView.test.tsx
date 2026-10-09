import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  campaignsFixture,
  getRulePreviewFixture,
  loadingCatalogsFixture,
  rulesDataFixture,
  SCHEDULING_FIXTURE_NOW,
  schedulingTemplatesFixture,
  scopeCatalogsFixture,
  sendingSettingsFixture,
  skippedNoticesFixture,
  upcomingQueueFixture,
} from "@/mocks/whatsapp/whatsapp-scheduling.fixtures";
import { SchedulingView, type SchedulingViewProps } from "../SchedulingView";

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

function baseProps(overrides: Partial<SchedulingViewProps> = {}): SchedulingViewProps {
  return {
    rules: PENDING,
    templates: PENDING,
    settings: PENDING,
    skipped: PENDING,
    queue: PENDING,
    campaigns: PENDING,
    catalogs: scopeCatalogsFixture,
    canManage: true,
    canPersist: { rules: false, settings: false, campaigns: false },
    businessName: "LIVII Store",
    link: { kind: "none" },
    onDismissLink: jest.fn(),
    getRulePreview: () => PENDING,
    getSegmentCount: () => PENDING,
    onCorrectOrder: jest.fn(),
    now: () => SCHEDULING_FIXTURE_NOW,
    ...overrides,
  };
}

function withData(overrides: Partial<SchedulingViewProps> = {}): SchedulingViewProps {
  return baseProps({
    rules: { kind: "ready", data: rulesDataFixture },
    templates: { kind: "ready", data: schedulingTemplatesFixture },
    settings: { kind: "ready", data: sendingSettingsFixture },
    skipped: { kind: "ready", data: skippedNoticesFixture },
    queue: { kind: "ready", data: upcomingQueueFixture },
    campaigns: { kind: "ready", data: campaignsFixture },
    getRulePreview: getRulePreviewFixture,
    ...overrides,
  });
}

function onlyRules(overrides: Partial<SchedulingViewProps> = {}): SchedulingViewProps {
  return baseProps({
    rules: { kind: "ready", data: rulesDataFixture },
    templates: { kind: "ready", data: schedulingTemplatesFixture },
    getRulePreview: getRulePreviewFixture,
    ...overrides,
  });
}

function withoutRules(overrides: Partial<SchedulingViewProps> = {}): SchedulingViewProps {
  return withData({ rules: PENDING, ...overrides });
}

const ruleCard = (label: string) => screen.getByRole("article", { name: label });

describe("Programación sin backend", () => {
  it("muestra pendientes sin confundirlos con listas vacías ni inventar números", () => {
    render(<SchedulingView {...baseProps()} />);
    expect(screen.getByText("Avisos automáticos pendientes de integración")).toBeInTheDocument();
    expect(
      screen.getByText(/Esto no significa que no haya avisos configurados/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/todavía no tiene avisos automáticos/)).not.toBeInTheDocument();
    expect(screen.queryByText(/activos?$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/en cola/)).not.toBeInTheDocument();
    expect(screen.getByText("Cola pendiente de integración")).toBeInTheDocument();
    expect(screen.getByText("Envíos programados pendientes de integración")).toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });

  it("usa los valores del documento como sugeridos, no como configuración guardada", () => {
    render(<SchedulingView {...baseProps()} />);
    expect(
      screen.getAllByText(/no (son|están) (la configuración guardada|guardados)/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Lunes" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Domingo" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByLabelText("Desde")).toHaveValue("08:00");
    expect(screen.getByLabelText("Hasta")).toHaveValue("21:00");
    expect(screen.getByLabelText("Máximo de avisos por pedido al día")).toHaveValue("3");
  });

  it("distingue reglas obligatorias de las configurables", () => {
    render(<SchedulingView {...baseProps()} />);
    expect(screen.getAllByText("Obligatoria")).toHaveLength(2);
    expect(screen.getByRole("switch", { name: /Avisar a la asesora/ })).toBeChecked();
  });
});

describe("Avisos automáticos", () => {
  it("muestra las nueve reglas, el resumen y los bloqueos que informa la plantilla", () => {
    render(<SchedulingView {...onlyRules()} />);
    expect(screen.getAllByRole("article")).toHaveLength(9);
    expect(screen.getByText("≈ S/ 220 al mes · lo cobra Meta")).toBeInTheDocument();
    expect(screen.getByText("4 activos")).toBeInTheDocument();
    expect(
      within(ruleCard("Saldo pendiente")).getByText(/Falta la fecha de entrega estimada/),
    ).toBeInTheDocument();
    expect(
      within(ruleCard("Encuesta post-entrega")).getByText(/está pausada en Meta/),
    ).toBeInTheDocument();
    expect(
      within(ruleCard("Disponible en agencia")).getByText(/se sigue enviando la versión aprobada/),
    ).toBeInTheDocument();
    expect(within(ruleCard("Guía creada")).getByText("38 hoy · ≈ S/ 52/mes")).toBeInTheDocument();
    expect(
      within(ruleCard("Pedido entregado")).getByText("30 min después · respeta horario"),
    ).toBeInTheDocument();
  });

  it("al encender una regla abre la vista previa y no la activa", async () => {
    const user = userEvent.setup({ delay: null });
    render(<SchedulingView {...onlyRules()} />);
    const toggle = within(ruleCard("Pedido en camino")).getByRole("switch", {
      name: "Activar aviso Pedido en camino",
    });
    await user.click(toggle);
    const dialog = await screen.findByRole("dialog", { name: "Activar: Pedido en camino" });
    expect(within(dialog).getByRole("radio", { name: /Solo pedidos nuevos/ })).toBeChecked();
    expect(
      within(dialog).getByRole("radio", { name: /También a los 128 pedidos actuales/ }),
    ).toBeEnabled();
    expect(dialog).toHaveTextContent("S/ 5.82");
    expect(dialog).toHaveTextContent("vuelve a calcular los pedidos");
    const activate = within(dialog).getByRole("button", { name: "Activar" });
    expect(activate).toHaveAttribute("aria-disabled", "true");
    expect(activate).toHaveAccessibleDescription(
      /El aviso sigue apagado y no se encoló ningún mensaje/,
    );
    await user.click(activate);
    expect(screen.getByRole("dialog", { name: "Activar: Pedido en camino" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByText(/encolados/)).not.toBeInTheDocument();
  });

  it("sin conteo real no muestra cero y deshabilita la opción de pedidos actuales", async () => {
    const user = userEvent.setup({ delay: null });
    render(<SchedulingView {...onlyRules({ getRulePreview: () => PENDING })} />);
    await user.click(within(ruleCard("Pedido en camino")).getByRole("switch"));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Conteo y costo pendientes de integración");
    expect(within(dialog).getByRole("radio", { name: /cantidad desconocida/ })).toBeDisabled();
    expect(dialog).not.toHaveTextContent(/\b0 pedidos/);
  });

  it("con cero coincidencias lo dice y no ofrece pedidos actuales", async () => {
    const user = userEvent.setup({ delay: null });
    render(<SchedulingView {...onlyRules()} />);
    await user.click(within(ruleCard("Comprobante emitido")).getByRole("switch"));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Hoy no hay pedidos que cumplan esta regla.");
    expect(
      within(dialog).getByRole("radio", { name: /no hay pedidos que cumplan/ }),
    ).toBeDisabled();
  });

  it("editar el alcance actualiza el resumen, valida fechas y pide confirmar el descarte", async () => {
    const user = userEvent.setup({ delay: null });
    render(<SchedulingView {...onlyRules()} />);
    const card = ruleCard("Guía creada");
    await user.click(within(card).getByText("A qué pedidos"));
    await user.click(within(card).getByRole("button", { name: "LIVII" }));
    expect(within(card).getByText(/^Resumen: LIVII · Todos los canales/)).toBeInTheDocument();

    await user.click(within(card).getByRole("radio", { name: "Entre dos fechas" }));
    await user.click(within(card).getByLabelText("Desde"));
    await user.paste("2026-10-10");
    await user.click(within(card).getByLabelText("Hasta (opcional)"));
    await user.paste("2026-10-01");
    await user.tab();
    expect(
      await within(card).findByText("La fecha final no puede ser anterior a la inicial."),
    ).toBeInTheDocument();

    const save = within(card).getByRole("button", { name: "Guardar cambios" });
    expect(save).toHaveAttribute("aria-disabled", "true");
    expect(save).toHaveAccessibleDescription(/estarán disponibles cuando se conecte el servicio/);

    await user.click(within(card).getByRole("button", { name: "Descartar cambios" }));
    const keepEditing = await screen.findByRole("alertdialog");
    await user.click(within(keepEditing).getByRole("button", { name: "Seguir editando" }));
    expect(within(card).getByRole("button", { name: "LIVII" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(within(card).getByRole("button", { name: "Descartar cambios" }));
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Descartar cambios" }));
    expect(within(card).getByRole("button", { name: "Todas" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("conserva el borrador si los catálogos se vuelven a cargar", async () => {
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(<SchedulingView {...onlyRules()} />);
    const card = ruleCard("Guía creada");
    await user.click(within(card).getByText("A qué pedidos"));
    await user.click(within(card).getByRole("button", { name: "Shalom" }));
    rerender(<SchedulingView {...onlyRules({ catalogs: loadingCatalogsFixture })} />);
    expect(within(card).getByText(/1 seleccionado; se conservan/)).toBeInTheDocument();
    rerender(<SchedulingView {...onlyRules()} />);
    expect(within(card).getByRole("button", { name: "Shalom" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(card).getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
  });

  it("marca valores guardados que ya no existen en el catálogo", async () => {
    const user = userEvent.setup({ delay: null });
    render(<SchedulingView {...onlyRules()} />);
    const card = ruleCard("Comprobante emitido");
    await user.click(within(card).getByText("A qué pedidos"));
    expect(
      within(card).getByRole("button", { name: "store-eliminada (no disponible)" }),
    ).toBeInTheDocument();
  });

  it("sin permisos la tarjeta es de solo lectura y el interruptor no responde", () => {
    render(<SchedulingView {...withData({ canManage: false })} />);
    expect(within(ruleCard("Pedido en camino")).getByRole("switch")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Programar envío" })).not.toBeInTheDocument();
  });
});

describe("Enlace desde Plantillas", () => {
  it("resalta la regla, preselecciona la plantilla sin guardar y lo explica", () => {
    render(
      <SchedulingView
        {...onlyRules({
          link: { kind: "rule", ruleKey: "pedido_en_camino", templateId: "tpl-guia" },
        })}
      />,
    );
    expect(screen.getByText(/Abrimos «Pedido en camino»/)).toBeInTheDocument();
    const card = ruleCard("Pedido en camino");
    expect(card.className).toMatch(/ring-2/);
    expect(
      within(card).getByText(
        /Plantilla preseleccionada desde Plantillas. Todavía no se guardó ni se activó/,
      ),
    ).toBeInTheDocument();
    expect(within(card).getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("explica si las reglas están pendientes, si no hay regla o si no existe", () => {
    const { rerender } = render(
      <SchedulingView
        {...baseProps({ link: { kind: "rule", ruleKey: "pedido_en_camino", templateId: "tpl-1" } })}
      />,
    );
    expect(
      screen.getByText(/están pendientes de integración: no se activó nada/),
    ).toBeInTheDocument();
    rerender(
      <SchedulingView
        {...baseProps({ link: { kind: "no-rule-for-template", templateId: "tpl-1" } })}
      />,
    );
    expect(screen.getByText(/no tiene un aviso automático asociado/)).toBeInTheDocument();
    rerender(
      <SchedulingView
        {...onlyRules({ link: { kind: "unknown-rule", requestedKey: "x", templateId: null } })}
      />,
    );
    expect(screen.getByText(/No encontramos el aviso automático indicado/)).toBeInTheDocument();
  });
});

describe("Horario, datos faltantes y cola", () => {
  it("valida horarios que cruzan medianoche, días y máximo", async () => {
    const user = userEvent.setup({ delay: null });
    render(<SchedulingView {...baseProps()} />);
    const from = screen.getByLabelText("Desde");
    const to = screen.getByLabelText("Hasta");
    await user.clear(from);
    await user.type(from, "22:00");
    await user.clear(to);
    await user.type(to, "06:00");
    await user.tab();
    expect(await screen.findByText(/no puede cruzar la medianoche/)).toBeInTheDocument();
    for (const day of ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]) {
      await user.click(screen.getByRole("button", { name: day }));
    }
    expect(await screen.findByText("Elige al menos un día.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar horario" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("muestra la configuración guardada y la cola que informa el backend", () => {
    render(<SchedulingView {...withoutRules()} />);
    const hours = screen.getByRole("region", { name: "Horario permitido" });
    expect(within(hours).getByLabelText("Desde")).toHaveValue("09:00");
    expect(within(hours).getByRole("button", { name: "Sábado" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByText("68 en cola")).toBeInTheDocument();
    const queue = screen.getByRole("list", { name: "Avisos en cola" });
    expect(within(queue).getAllByRole("listitem")).toHaveLength(4);
    expect(queue).toHaveTextContent("Pasa a mañana 08:00");
  });

  it("«Corregir» usa el pedido real y se deshabilita sin ID", async () => {
    const user = userEvent.setup({ delay: null });
    const onCorrectOrder = jest.fn();
    render(<SchedulingView {...withoutRules({ onCorrectOrder })} />);
    const skipped = screen.getByRole("list", { name: "Avisos que hoy no se enviaron" });
    await user.click(within(skipped).getByRole("button", { name: "Corregir pedido ORD-149958" }));
    expect(onCorrectOrder).toHaveBeenCalledWith("order-149958");
    expect(
      within(skipped).getByRole("button", { name: "Corregir pedido ORD-149941" }),
    ).toBeDisabled();
  });
});

describe("Envíos programados", () => {
  it("muestra estados, volúmenes reales y acciones bloqueadas", async () => {
    const user = userEvent.setup({ delay: null });
    render(<SchedulingView {...withoutRules()} />);
    const list = screen.getByRole("list", { name: "Envíos programados" });
    expect(list).toHaveTextContent("Programado");
    expect(list).toHaveTextContent("Activo");
    expect(list).toHaveTextContent("Pausado por calidad");
    expect(list).toHaveTextContent("Completado");
    expect(list).toHaveTextContent("42 pedidos hoy · se recalcula al enviar");
    expect(list).toHaveTextContent("Destinatarios: se calculan al enviar");
    expect(list).toHaveTextContent("118 enviados · 96 leídos");
    expect(list).toHaveTextContent("Resultados pendientes");
    expect(
      within(list).getByRole("button", { name: "Pausar Aviso de retraso por feriado" }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      within(list).getByRole("button", { name: "Reanudar Avisos de reparto en Lima" }),
    ).toHaveAttribute("aria-disabled", "true");
    await user.click(within(list).getAllByRole("button", { name: "Ver resultados" })[0]);
    expect(await screen.findByRole("dialog", { name: "Resultados del envío" })).toHaveTextContent(
      "115",
    );
  });

  it("el modal valida, deja recurrencia y fecha, no guarda y confirma el descarte", async () => {
    const user = userEvent.setup({ delay: null });
    render(<SchedulingView {...withoutRules()} />);
    await user.click(screen.getByRole("button", { name: "Programar envío" }));
    const dialog = await screen.findByRole("dialog", { name: "Programar envío" });
    expect(dialog).toHaveTextContent("Conteo de destinatarios pendiente de integración");
    await user.click(within(dialog).getByLabelText("Nombre del envío"));
    await user.paste("Aviso feriado");
    await user.click(within(dialog).getByLabelText("Fecha"));
    await user.paste("2026-10-01");
    await user.click(within(dialog).getByLabelText("Hora (Lima)"));
    await user.paste("09:00");
    await user.tab();
    expect(await within(dialog).findByText(/posteriores a ahora/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("radio", { name: "Se repite" }));
    expect(within(dialog).queryByLabelText("Fecha")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("combobox", { name: "Frecuencia" })).toBeInTheDocument();

    const save = within(dialog).getByRole("button", { name: "Programar" });
    expect(save).toHaveAttribute("aria-disabled", "true");
    await user.click(save);
    expect(screen.getByRole("dialog", { name: "Programar envío" })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Descartar cambios" }));
    expect(screen.queryByRole("dialog", { name: "Programar envío" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Programar envío" }));
    const reopened = await screen.findByRole("dialog", { name: "Programar envío" });
    expect(within(reopened).getByLabelText("Nombre del envío")).toHaveValue("");
  });

  it("al editar carga los valores del envío", async () => {
    const user = userEvent.setup({ delay: null });
    render(<SchedulingView {...withoutRules()} />);
    await user.click(
      screen.getByRole("button", { name: "Editar Recordatorio de recojo (+3 días en agencia)" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Editar envío programado" });
    expect(within(dialog).getByLabelText("Nombre del envío")).toHaveValue(
      "Recordatorio de recojo (+3 días en agencia)",
    );
    expect(within(dialog).getByRole("radio", { name: "Se repite" })).toBeChecked();
    expect(within(dialog).getByLabelText("Hora (Lima)")).toHaveValue("10:00");
  });
});
