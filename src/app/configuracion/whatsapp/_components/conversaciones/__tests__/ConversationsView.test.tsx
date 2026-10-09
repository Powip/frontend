import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { WhatsAppConversationFilters } from "@/features/whatsapp/models/conversation.model";
import { EMPTY_CONVERSATION_FILTERS } from "@/features/whatsapp/utils/conversation-filters.util";
import {
  agentCapabilitiesFixture,
  CONVERSATION_FIXTURE_NOW,
  CONVERSATION_FIXTURE_USER_ID,
  conversationBoardFixture,
  conversationBoardWithoutTotalsFixture,
  conversationListFixture,
  conversationStoresFixture,
  conversationTemplatesFixture,
  emptyConversationBoardFixture,
  fullCapabilitiesFixture,
  getConversationFixture,
  readOnlyCapabilitiesFixture,
} from "@/mocks/whatsapp/whatsapp-conversation.fixtures";
import { ConversationsView, type ConversationsViewProps } from "../ConversationsView";

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

afterEach(() => {
  jest.useRealTimers();
});

const PENDING = { kind: "pending-integration" } as const;

function baseProps(overrides: Partial<ConversationsViewProps> = {}): ConversationsViewProps {
  return {
    stores: conversationStoresFixture,
    currentUserId: CONVERSATION_FIXTURE_USER_ID,
    businessName: "LIVII Store",
    filters: EMPTY_CONVERSATION_FILTERS,
    onFiltersChange: jest.fn(),
    view: "board",
    onViewChange: jest.fn(),
    board: { kind: "ready", data: conversationBoardFixture },
    list: { kind: "ready", data: conversationListFixture },
    selectedConversationId: null,
    onSelectConversation: jest.fn(),
    getConversation: getConversationFixture,
    templates: { kind: "ready", data: conversationTemplatesFixture },
    capabilities: agentCapabilitiesFixture,
    mutations: {},
    useStoreAgents: () => ({ kind: "ready", data: [] }),
    autoReply: PENDING,
    canConfigureAutoReply: true,
    canPersistAutoReply: false,
    onOpenOrder: jest.fn(),
    now: CONVERSATION_FIXTURE_NOW,
    ...overrides,
  };
}

function Harness(props: ConversationsViewProps) {
  const [filters, setFilters] = useState<WhatsAppConversationFilters>(props.filters);
  const [selected, setSelected] = useState(props.selectedConversationId);
  return (
    <ConversationsView
      {...props}
      filters={filters}
      onFiltersChange={(next) => {
        setFilters(next);
        props.onFiltersChange(next);
      }}
      selectedConversationId={selected}
      onSelectConversation={(id) => {
        setSelected(id);
        props.onSelectConversation(id);
      }}
    />
  );
}

function renderView(overrides: Partial<ConversationsViewProps> = {}) {
  const props = baseProps(overrides);
  return { props, ...render(<Harness {...props} />) };
}

async function openedAlert(name: string) {
  const alert = await screen.findByRole("alertdialog", { name });
  await waitFor(() => expect(alert).not.toHaveStyle({ pointerEvents: "none" }));
  return alert;
}

function column(name: string) {
  return screen.getByRole("region", { name: new RegExp(`^${name}`) });
}

describe("Tablero y lista", () => {
  it("sin backend no muestra conversaciones ni contadores", () => {
    renderView({ board: PENDING, list: PENDING });
    expect(screen.getByText("Conversaciones pendientes de integración")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /^Respondió/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Abrir conversación/ })).not.toBeInTheDocument();
  });

  it("Respondió tiene prioridad aunque backend agrupe la tarjeta en otra columna", () => {
    renderView();
    expect(
      within(column("Respondió")).getByRole("button", { name: /Sofía Medina/ }),
    ).toBeInTheDocument();
    expect(
      within(column("Entregado")).queryByRole("button", { name: /Sofía Medina/ }),
    ).not.toBeInTheDocument();
    expect(
      within(column("Respondió")).getByText("Sin atender hace 2 h 45 min"),
    ).toBeInTheDocument();
  });

  it("una conversación atendida no aparece como leída", () => {
    renderView();
    const card = within(column("Enviado")).getByRole("button", { name: /Diego Paredes/ });
    expect(within(card).getByText("Atendida")).toBeInTheDocument();
    expect(
      within(column("Leído")).queryByRole("button", { name: /Diego Paredes/ }),
    ).not.toBeInTheDocument();
  });

  it("los contadores vienen de backend y no del largo de la página", () => {
    const { unmount } = renderView();
    expect(within(column("Leído")).getByRole("heading")).toHaveTextContent("Leído23 en total");
    unmount();
    renderView({ board: { kind: "ready", data: conversationBoardWithoutTotalsFixture } });
    expect(within(column("Leído")).getByRole("heading")).toHaveTextContent(/^Leído$/);
  });

  it("muestra el motivo de los no enviados", () => {
    renderView();
    expect(within(column("No enviado")).getByText("Es un teléfono fijo")).toBeInTheDocument();
  });

  it("«Ver más» queda bloqueado sin backend", async () => {
    const user = userEvent.setup({ delay: null });
    renderView();
    const more = within(column("Enviado")).getByRole("button", { name: "Ver más" });
    expect(more).toHaveAttribute("aria-disabled", "true");
    await user.click(more);
    expect(screen.getAllByRole("button", { name: "Ver más" })).toHaveLength(2);
  });

  it("vista lista con paginación bloqueada sin backend", () => {
    renderView({ view: "list" });
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(
      conversationListFixture.items.length + 1,
    );
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("distingue vacío de sin coincidencias", async () => {
    const user = userEvent.setup({ delay: null });
    const { unmount } = renderView({
      board: { kind: "ready", data: emptyConversationBoardFixture },
    });
    expect(screen.getByText("Todavía no hay conversaciones.")).toBeInTheDocument();
    unmount();
    const { props } = renderView({
      board: { kind: "ready", data: emptyConversationBoardFixture },
      filters: { search: "ORD-000", storeId: "store-kunca", assignedToMe: false },
    });
    expect(screen.getByText("No hay conversaciones con estos filtros.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(props.onFiltersChange).toHaveBeenLastCalledWith(EMPTY_CONVERSATION_FILTERS);
  });
});

describe("Filtros", () => {
  it("la búsqueda espera a que termines de escribir y usa el mínimo de caracteres", () => {
    jest.useFakeTimers();
    const { props } = renderView();
    const search = screen.getByRole("searchbox", { name: "Buscar pedido, cliente o teléfono" });
    fireEvent.change(search, { target: { value: "L" } });
    expect(screen.getByText("Escribe al menos 2 caracteres para buscar.")).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "Lucía" } });
    expect(props.onFiltersChange).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(props.onFiltersChange).toHaveBeenCalledTimes(1);
    expect(props.onFiltersChange).toHaveBeenLastCalledWith({
      ...EMPTY_CONVERSATION_FILTERS,
      search: "Lucía",
    });
  });

  it("tienda y «Asignadas a mí» usan IDs", async () => {
    const user = userEvent.setup({ delay: null });
    const { props } = renderView();
    await user.click(screen.getByRole("combobox", { name: "Tienda" }));
    await user.click(screen.getByRole("option", { name: "KUNCA" }));
    expect(props.onFiltersChange).toHaveBeenLastCalledWith({
      ...EMPTY_CONVERSATION_FILTERS,
      storeId: "store-kunca",
    });
    await user.click(screen.getByRole("button", { name: "Asignadas a mí" }));
    expect(props.onFiltersChange).toHaveBeenLastCalledWith({
      ...EMPTY_CONVERSATION_FILTERS,
      storeId: "store-kunca",
      assignedToMe: true,
    });
  });

  it("sin usuario identificado no permite filtrar por asignación", async () => {
    const user = userEvent.setup({ delay: null });
    const { props } = renderView({ currentUserId: null });
    const mine = screen.getByRole("button", { name: "Asignadas a mí" });
    expect(mine).toHaveAttribute("aria-disabled", "true");
    expect(mine).toHaveAccessibleDescription("No se pudo identificar tu usuario.");
    await user.click(mine);
    expect(props.onFiltersChange).not.toHaveBeenCalled();
  });
});

describe("Panel de la conversación", () => {
  it("abre la conversación desde la tarjeta", async () => {
    const user = userEvent.setup({ delay: null });
    const { props } = renderView();
    await user.click(within(column("Respondió")).getByRole("button", { name: /Lucía Ramos/ }));
    expect(props.onSelectConversation).toHaveBeenCalledWith("cv-lucia");
    const drawer = await screen.findByRole("dialog", { name: "Lucía Ramos" });
    expect(within(drawer).getByText(/Quedan 23 h \d+ min para responder/)).toBeInTheDocument();
  });

  it("las respuestas rápidas completan el borrador sin enviar nada", async () => {
    const user = userEvent.setup({ delay: null });
    renderView({ selectedConversationId: "cv-lucia" });
    const drawer = screen.getByRole("dialog");
    const messages = within(drawer).getAllByRole("listitem").length;
    await user.click(within(drawer).getByRole("button", { name: "Reprogramar entrega" }));
    const textarea = within(drawer).getByRole("textbox", { name: "Mensaje al comprador" });
    expect(textarea).toHaveValue(
      "Hola Lucía, ¿qué día y en qué horario te queda mejor recibir tu pedido? Lo revisamos con el courier y te confirmamos por aquí.",
    );
    const send = within(drawer).getByRole("button", { name: "Enviar" });
    expect(send).toHaveAttribute("aria-disabled", "true");
    expect(send).toHaveAccessibleDescription(/Pendiente de integración/);
    await user.click(send);
    expect((textarea as HTMLTextAreaElement).value).toContain("Hola Lucía");
    expect(within(drawer).getAllByRole("listitem")).toHaveLength(messages);
    expect(within(drawer).queryByText(/Enviando/)).not.toBeInTheDocument();
  });

  it("sin link de rastreo bloquea esa respuesta rápida con explicación", () => {
    renderView({ selectedConversationId: "cv-kevin" });
    const quick = screen.getByRole("button", { name: "Link de rastreo" });
    expect(quick).toHaveAttribute("aria-disabled", "true");
    expect(quick).toHaveAccessibleDescription("Este pedido no tiene link de rastreo disponible.");
  });

  it("la ventana se cierra con el panel abierto y conserva el texto", () => {
    jest.useFakeTimers();
    jest.setSystemTime(CONVERSATION_FIXTURE_NOW);
    renderView({ selectedConversationId: "cv-kevin" });
    const textarea = screen.getByRole("textbox", { name: "Mensaje al comprador" });
    fireEvent.change(textarea, { target: { value: "La agencia atiende hasta las 8 pm" } });
    expect(screen.getByText(/Quedan 2 min/)).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(3 * 60 * 1000);
    });
    expect(screen.getByText("Ventana cerrada")).toBeInTheDocument();
    expect(
      screen.getByText(/La ventana de 24 h se cerró. Tu texto se conserva/),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Mensaje al comprador" })).toHaveValue(
      "La agencia atiende hasta las 8 pm",
    );
    expect(screen.getByRole("textbox", { name: "Mensaje al comprador" })).toHaveAttribute(
      "readonly",
    );
    expect(screen.queryByRole("button", { name: "Enviar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar plantilla" })).toBeInTheDocument();
  });

  it("con ventana desconocida bloquea el envío", () => {
    renderView({ selectedConversationId: "cv-sofia" });
    expect(screen.getByText("Ventana sin confirmar")).toBeInTheDocument();
    const send = screen.getByRole("button", { name: "Enviar" });
    expect(send).toHaveAttribute("aria-disabled", "true");
    expect(send).toHaveAccessibleDescription(
      /POWIP no confirmó si la ventana de 24 h está abierta/,
    );
    expect(screen.getByRole("button", { name: "Enviar plantilla" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("una conversación atendida con ventana cerrada ofrece solo plantillas aprobadas", () => {
    renderView({ selectedConversationId: "cv-diego" });
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText("Atendida")).toBeInTheDocument();
    expect(within(drawer).getByText("Ventana cerrada")).toBeInTheDocument();
    expect(
      within(drawer).queryByRole("button", { name: "Marcar atendida" }),
    ).not.toBeInTheDocument();
    expect(
      within(drawer).queryByRole("textbox", { name: "Mensaje al comprador" }),
    ).not.toBeInTheDocument();
    expect(
      within(drawer).getByRole("combobox", { name: "Plantilla aprobada" }),
    ).toBeInTheDocument();
  });

  it("marcar atendida queda bloqueado y aclara que no implica lectura", async () => {
    const user = userEvent.setup({ delay: null });
    renderView({ selectedConversationId: "cv-lucia" });
    const attend = screen.getByRole("button", { name: "Marcar atendida" });
    expect(attend).toHaveAttribute("aria-disabled", "true");
    await user.click(attend);
    expect(screen.getByText("Respondió · sin atender")).toBeInTheDocument();
    expect(
      screen.getByText("Marcar atendida no indica que el comprador leyó un mensaje."),
    ).toBeInTheDocument();
  });

  it("Ver pedido usa el ID real y se bloquea sin pedido", async () => {
    const user = userEvent.setup({ delay: null });
    const { props, unmount } = renderView({ selectedConversationId: "cv-lucia" });
    await user.click(screen.getByRole("button", { name: "Ver pedido" }));
    expect(props.onOpenOrder).toHaveBeenCalledWith("order-cv-lucia");
    unmount();
    const second = renderView({ selectedConversationId: "cv-luis" });
    const view = screen.getByRole("button", { name: "Ver pedido" });
    expect(view).toHaveAttribute("aria-disabled", "true");
    expect(view).toHaveAccessibleDescription("Esta conversación no tiene un pedido asociado.");
    await user.click(view);
    expect(second.props.onOpenOrder).not.toHaveBeenCalled();
  });

  it("en No enviado permite corregir el pedido y bloquea el reintento", async () => {
    const user = userEvent.setup({ delay: null });
    const { props } = renderView({ selectedConversationId: "cv-alexandra" });
    const notice = screen.getByRole("region", { name: "Aviso no enviado" });
    expect(within(notice).getByText("No enviado: El número no tiene WhatsApp")).toBeInTheDocument();
    await user.click(within(notice).getByRole("button", { name: "Corregir en el pedido" }));
    expect(props.onOpenOrder).toHaveBeenCalledWith("order-cv-alexandra");
    expect(within(notice).getByRole("button", { name: "Reintentar" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("distingue evidencia de despacho y foto de entrega", () => {
    renderView({ selectedConversationId: "cv-jorge" });
    expect(screen.getByText("Evidencia de despacho · 08:10")).toBeInTheDocument();
    expect(screen.getByText("Foto del despacho; no confirma la entrega")).toBeInTheDocument();
    expect(screen.getByText("Foto de entrega · Moto propia · 12:40")).toBeInTheDocument();
  });

  it("muestra adjuntos del comprador sin inventar el archivo", () => {
    renderView({ selectedConversationId: "cv-lucia" });
    expect(screen.getByRole("link", { name: /Imagen/ })).toHaveAttribute(
      "href",
      "https://example.com/foto.jpg",
    );
    expect(screen.getByText("Audio · no disponible")).toBeInTheDocument();
  });

  it("con el comprador dado de baja no se puede escribir", () => {
    renderView({ selectedConversationId: "cv-pedro", capabilities: fullCapabilitiesFixture });
    expect(
      screen.getAllByText(
        "El comprador se dio de baja: no se le pueden enviar mensajes ni plantillas.",
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Dar de baja" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar" })).toHaveAttribute("aria-disabled", "true");
  });

  it("dar de baja pide confirmación y queda bloqueado sin backend", async () => {
    const user = userEvent.setup({ delay: null });
    renderView({ selectedConversationId: "cv-lucia", capabilities: fullCapabilitiesFixture });
    await user.click(screen.getByRole("button", { name: "Dar de baja" }));
    const confirm = screen.getByRole("dialog", { name: "Dar de baja a este comprador" });
    expect(within(confirm).getByText(/no recibirá más avisos de LIVII/)).toBeInTheDocument();
    expect(within(confirm).getByRole("button", { name: "Dar de baja" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("la asignación no impide responder y reasignar queda bloqueado", () => {
    const { unmount } = renderView({ selectedConversationId: "cv-lucia" });
    expect(screen.getByText("Katherine F.")).toBeInTheDocument();
    expect(screen.getByText(/La asignación no te impide responder/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reasignar" })).not.toBeInTheDocument();
    unmount();
    renderView({ selectedConversationId: "cv-lucia", capabilities: fullCapabilitiesFixture });
    expect(screen.getByRole("button", { name: "Reasignar" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("sin permiso para responder no muestra el cuadro de texto", () => {
    renderView({ selectedConversationId: "cv-lucia", capabilities: readOnlyCapabilitiesFixture });
    expect(
      screen.getByText("No tienes permiso para responder ni dejar notas en esta conversación."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("la nota interna queda bloqueada y no se agrega al hilo", async () => {
    const user = userEvent.setup({ delay: null });
    renderView({ selectedConversationId: "cv-lucia" });
    const items = screen.getAllByRole("listitem").length;
    await user.click(screen.getByRole("radio", { name: "Nota interna" }));
    await user.type(screen.getByRole("textbox", { name: "Nota interna" }), "Llamar");
    const save = screen.getByRole("button", { name: "Guardar nota" });
    expect(save).toHaveAttribute("aria-disabled", "true");
    await user.click(save);
    expect(screen.getAllByRole("listitem")).toHaveLength(items);
  });
});

describe("Borradores", () => {
  it("pide confirmar al cerrar con texto y no lo traslada a otra conversación", async () => {
    const user = userEvent.setup({ delay: null });
    renderView({ selectedConversationId: "cv-lucia" });
    await user.type(screen.getByRole("textbox", { name: "Mensaje al comprador" }), "Hola");
    await user.click(screen.getByRole("button", { name: "Cerrar conversación" }));
    const confirm = screen.getByRole("alertdialog", {
      name: "¿Cerrar la conversación y descartar lo que escribiste?",
    });
    await user.click(within(confirm).getByRole("button", { name: "Seguir escribiendo" }));
    expect(screen.getByRole("textbox", { name: "Mensaje al comprador" })).toHaveValue("Hola");

    await user.click(screen.getByRole("button", { name: "Cerrar conversación" }));
    await user.click(screen.getByRole("button", { name: "Descartar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(within(column("Respondió")).getByRole("button", { name: /Kevin Flores/ }));
    expect(screen.getByRole("textbox", { name: "Mensaje al comprador" })).toHaveValue("");
  });

  it("al cambiar de conversación desde la URL pide confirmar el descarte", async () => {
    const user = userEvent.setup({ delay: null });
    const props = baseProps({ selectedConversationId: "cv-lucia" });
    let navigate: (id: string | null) => void = () => undefined;
    function UrlDriven() {
      const [selected, setSelected] = useState<string | null>("cv-lucia");
      navigate = setSelected;
      return <ConversationsView {...props} selectedConversationId={selected} />;
    }
    render(<UrlDriven />);
    await user.type(screen.getByRole("textbox", { name: "Mensaje al comprador" }), "Hola");
    await user.tab();
    await act(async () => navigate("cv-kevin"));
    const confirm = await openedAlert("¿Cambiar de conversación y descartar lo que escribiste?");
    await user.click(within(confirm).getByRole("button", { name: "Seguir escribiendo" }));
    expect(props.onSelectConversation).toHaveBeenLastCalledWith("cv-lucia");
    await act(async () => navigate("cv-lucia"));
    expect(screen.getByRole("dialog", { name: "Lucía Ramos" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Mensaje al comprador" })).toHaveValue("Hola");
    await user.tab();
    await act(async () => navigate("cv-kevin"));
    const again = await openedAlert("¿Cambiar de conversación y descartar lo que escribiste?");
    await user.click(within(again).getByRole("button", { name: "Descartar" }));
    expect(screen.getByRole("dialog", { name: "Kevin Flores" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Mensaje al comprador" })).toHaveValue("");
  });

  it("un refetch del detalle no borra el texto", async () => {
    const user = userEvent.setup({ delay: null });
    const props = baseProps({ selectedConversationId: "cv-lucia" });
    const { rerender } = render(<ConversationsView {...props} />);
    await user.type(screen.getByRole("textbox", { name: "Mensaje al comprador" }), "Hola");
    const refreshed = (id: string) => {
      const state = getConversationFixture(id);
      return state.kind === "ready"
        ? { kind: "ready" as const, data: { ...state.data, version: 4 } }
        : state;
    };
    rerender(<ConversationsView {...props} getConversation={refreshed} />);
    expect(screen.getByRole("textbox", { name: "Mensaje al comprador" })).toHaveValue("Hola");
  });

  it("no guarda mensajes ni teléfonos en el navegador", async () => {
    const user = userEvent.setup({ delay: null });
    const setItem = jest.spyOn(Storage.prototype, "setItem");
    renderView({ selectedConversationId: "cv-lucia" });
    await user.type(screen.getByRole("textbox", { name: "Mensaje al comprador" }), "Hola");
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it("si el envío falla conserva el texto y no agrega mensajes", async () => {
    const user = userEvent.setup({ delay: null });
    const sendReply = jest.fn().mockRejectedValue(new Error("La ventana se cerró."));
    renderView({ selectedConversationId: "cv-lucia", mutations: { sendReply } });
    const items = screen.getAllByRole("listitem").length;
    await user.type(screen.getByRole("textbox", { name: "Mensaje al comprador" }), "Hola");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(sendReply).toHaveBeenCalledWith({
      conversationId: "cv-lucia",
      text: "Hola",
      version: 3,
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La ventana se cerró. Tu texto se conserva.",
    );
    expect(screen.getByRole("textbox", { name: "Mensaje al comprador" })).toHaveValue("Hola");
    expect(screen.getAllByRole("listitem")).toHaveLength(items);
  });

  it("mientras se envía bloquea un segundo envío", async () => {
    const user = userEvent.setup({ delay: null });
    const sendReply = jest.fn(() => new Promise<void>(() => undefined));
    renderView({ selectedConversationId: "cv-lucia", mutations: { sendReply } });
    await user.type(screen.getByRole("textbox", { name: "Mensaje al comprador" }), "Hola");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(screen.getByText("Enviando…")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(sendReply).toHaveBeenCalledTimes(1);
  });
});
