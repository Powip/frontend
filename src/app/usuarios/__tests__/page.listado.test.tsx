import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => "/usuarios" }));
jest.mock("@/services/userService", () => ({
  getUsersByCompany: jest.fn(),
  getRoles: jest.fn(),
  updateUser: jest.fn(),
  createCompanyUser: jest.fn(),
  deleteUser: jest.fn(),
}));
jest.mock("@/services/userExport", () => ({ exportUsersToExcel: jest.fn() }));
jest.mock("@/components/modals/UserModal", () => ({ __esModule: true, default: () => null }));

import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { deleteUser, getRoles, getUsersByCompany, updateUser } from "@/services/userService";
import { exportUsersToExcel } from "@/services/userExport";
import type { Role, User } from "@/interfaces/IUser";
import UsuariosPage from "../page";

const person = (overrides: Partial<User> & Pick<User, "id" | "name" | "surname">): User => ({
  identityDocument: `doc-${overrides.id}`,
  email: `${overrides.id}@empresa.com`,
  status: true,
  role: null,
  ...overrides,
});

const CATALOG: Role[] = [
  { id: "r-admin", name: "ADMINISTRADOR" },
  { id: "r-ventas", name: "VENTAS", description: "Pedidos y clientes" },
  { id: "r-ops", name: "OPERACIONES" },
];

const USERS: User[] = [
  person({ id: "u1", name: "Ana", surname: "Torres", role: { id: "r-admin", name: "ADMINISTRADOR" } }),
  person({ id: "u2", name: "Luis", surname: "Paz", status: false, role: { id: "r-ventas", name: "VENTAS" } }),
  person({ id: "u3", name: "Rosa", surname: "Díaz", district: "Breña", role: { id: "", name: "VENTAS" } }),
  person({
    id: "u4",
    name: "Marco",
    surname: "Ruiz",
    phoneNumber: "987654321",
    address: "Jr. Iquique 807",
    role: { id: "r-sup", name: "SUPERVISOR" },
  }),
  person({ id: "u5", name: "Elena", surname: "Soto", status: false, role: null }),
  person({ id: "u6", name: "Ana", surname: "Bravo", role: { id: "r-ventas", name: "VENTAS" } }),
];

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    auth: { accessToken: "token", company: { id: "company-1" }, user: { id: "admin-1", role: "ADMINISTRADOR" } },
    loading: false,
  } as unknown as ReturnType<typeof useAuth>);
  jest.mocked(getUsersByCompany).mockResolvedValue(USERS);
  jest.mocked(getRoles).mockResolvedValue(CATALOG);
});

const visibleNames = () =>
  screen
    .queryAllByRole("button", { name: /^Editar / })
    .map((button) => button.getAttribute("aria-label")?.replace("Editar ", ""));

const summaryList = () => screen.getByRole("list", { name: "Resumen de usuarios" });

const cardValue = (label: string) =>
  (within(summaryList()).getByText(label).closest("li") as HTMLElement).querySelector("p");

const roleCard = (name: string) => screen.getByRole("heading", { name }).closest("li") as HTMLElement;

const chooseOption = (selectLabel: string, optionText: string) => {
  const select = screen.getByRole("combobox", { name: selectLabel }) as HTMLSelectElement;
  const option = within(select).getByRole("option", { name: optionText }) as HTMLOptionElement;
  fireEvent.change(select, { target: { value: option.value } });
};

const search = (value: string) => fireEvent.change(screen.getByLabelText("Buscar usuarios"), { target: { value } });

const renderLoaded = async () => {
  render(<UsuariosPage />);
  await screen.findByRole("button", { name: "Editar Ana Torres" });
  await screen.findByRole("tab", { name: /Roles y permisos \(3\)/ });
};

const openTab = async (name: RegExp) => {
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name }));
  return user;
};

describe("UsuariosPage — pestañas con contadores", () => {
  it("muestra los totales reales de usuarios y roles del catálogo", async () => {
    await renderLoaded();

    expect(screen.getByRole("tab", { name: "Usuarios (6)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Roles y permisos (3)" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Referidos y cobro" })).toBeInTheDocument();
  });

  it("los contadores no cambian con la búsqueda", async () => {
    await renderLoaded();
    search("rosa");

    expect(visibleNames()).toEqual(["Rosa Díaz"]);
    expect(screen.getByRole("tab", { name: "Usuarios (6)" })).toBeInTheDocument();
  });

  it("no muestra cero cuando las cargas fallan", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.mocked(getUsersByCompany).mockRejectedValue(new Error("500"));
    jest.mocked(getRoles).mockRejectedValue(new Error("500"));
    render(<UsuariosPage />);

    await screen.findByText("No se pudieron cargar los usuarios.");
    expect(screen.getByRole("tab", { name: "Usuarios" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("tab", { name: "Roles y permisos" })).toBeInTheDocument());
    expect(screen.queryByRole("tab", { name: /\(0\)/ })).not.toBeInTheDocument();
    jest.mocked(console.error).mockRestore();
  });
});

describe("UsuariosPage — tarjetas", () => {
  it("total e inactivos son reales; activos ahora y roles personalizados no se inventan", async () => {
    await renderLoaded();

    expect(cardValue("Total usuarios")).toHaveTextContent("6");
    expect(cardValue("Inactivos")).toHaveTextContent("2");
    expect(cardValue("Activos ahora")).toHaveTextContent("No disponible");
    expect(cardValue("Roles personalizados")).toHaveTextContent("No disponible");
    expect(within(summaryList()).queryByText("4")).not.toBeInTheDocument();
  });

  it("no cambian al filtrar", async () => {
    await renderLoaded();
    chooseOption("Filtrar por estado", "Inactivo");
    search("luis");

    expect(visibleNames()).toEqual(["Luis Paz"]);
    expect(cardValue("Total usuarios")).toHaveTextContent("6");
    expect(cardValue("Inactivos")).toHaveTextContent("2");
  });

  it("si el listado falla no muestra números", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.mocked(getUsersByCompany).mockRejectedValue(new Error("500"));
    render(<UsuariosPage />);

    await screen.findByText("No se pudieron cargar los usuarios.");
    expect(cardValue("Total usuarios")).toHaveTextContent("—");
    expect(cardValue("Inactivos")).toHaveTextContent("—");
    jest.mocked(console.error).mockRestore();
  });
});

describe("UsuariosPage — búsqueda y filtros", () => {
  it("combina rol, estado y búsqueda", async () => {
    await renderLoaded();

    chooseOption("Filtrar por rol", "VENTAS");
    expect(visibleNames()).toEqual(["Ana Bravo", "Luis Paz", "Rosa Díaz"]);

    chooseOption("Filtrar por estado", "Activo");
    expect(visibleNames()).toEqual(["Ana Bravo", "Rosa Díaz"]);

    search("diaz");
    expect(visibleNames()).toEqual(["Rosa Díaz"]);
  });

  it("ofrece Sin rol y los roles de E3 que no están en E2", async () => {
    await renderLoaded();

    chooseOption("Filtrar por rol", "Sin rol");
    expect(visibleNames()).toEqual(["Elena Soto"]);

    chooseOption("Filtrar por rol", "SUPERVISOR (fuera del catálogo)");
    expect(visibleNames()).toEqual(["Marco Ruiz"]);
  });

  it.each([
    ["teléfono", "987654", ["Marco Ruiz"]],
    ["distrito", "breña", ["Rosa Díaz"]],
    ["dirección", "iquique", ["Marco Ruiz"]],
    ["rol", "administrador", ["Ana Torres"]],
    ["email", "u5@", ["Elena Soto"]],
  ])("busca por %s", async (_, query, expected) => {
    await renderLoaded();
    search(query);
    expect(visibleNames()).toEqual(expected);
  });

  it("sin coincidencias ofrece limpiar los filtros", async () => {
    await renderLoaded();
    chooseOption("Filtrar por estado", "Inactivo");
    search("zzz");

    expect(screen.getByText("No se encontraron usuarios.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));

    expect(visibleNames()).toHaveLength(6);
    expect(screen.getByLabelText("Buscar usuarios")).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Filtrar por estado" })).toHaveValue("all");
  });
});

describe("UsuariosPage — tabla y orden", () => {
  it("muestra las columnas del diseño sin presentar el email como login", async () => {
    await renderLoaded();

    expect(screen.getAllByRole("columnheader").map((cell) => cell.textContent?.trim())).toEqual([
      "",
      "Usuario",
      "Nombre",
      "Apellidos",
      "Dirección",
      "Distrito",
      "Email",
      "Género",
      "Roles",
      "Estado",
      "Teléfono",
      "Acciones",
    ]);
    const row = screen.getByRole("button", { name: "Editar Marco Ruiz" }).closest("tr") as HTMLElement;
    expect(within(row).getAllByText("u4@empresa.com")).toHaveLength(1);
    expect((row as HTMLTableRowElement).cells[1]).toHaveTextContent(/^MR—$/);
    expect(within(row).getByText("SUPERVISOR")).toBeInTheDocument();
  });

  it("ordena por usuario por defecto y, sin login, desempata por nombre", async () => {
    await renderLoaded();

    expect(visibleNames()).toEqual(["Ana Bravo", "Ana Torres", "Elena Soto", "Luis Paz", "Marco Ruiz", "Rosa Díaz"]);
    expect(screen.getByRole("columnheader", { name: /Usuario/ })).toHaveAttribute("aria-sort", "ascending");

    fireEvent.click(screen.getByRole("button", { name: /^Nombre/ }));
    expect(visibleNames()).toEqual(["Ana Bravo", "Ana Torres", "Elena Soto", "Luis Paz", "Marco Ruiz", "Rosa Díaz"]);

    fireEvent.click(screen.getByRole("button", { name: /^Nombre/ }));
    expect(visibleNames()).toEqual(["Rosa Díaz", "Marco Ruiz", "Luis Paz", "Elena Soto", "Ana Bravo", "Ana Torres"]);
    expect(screen.getByRole("columnheader", { name: /Nombre/ })).toHaveAttribute("aria-sort", "descending");

    fireEvent.click(screen.getByRole("button", { name: /^Apellidos/ }));
    expect(visibleNames()).toEqual(["Ana Bravo", "Rosa Díaz", "Luis Paz", "Marco Ruiz", "Elena Soto", "Ana Torres"]);

    fireEvent.click(screen.getByRole("button", { name: /^Estado/ }));
    expect(visibleNames()).toEqual(["Ana Bravo", "Ana Torres", "Marco Ruiz", "Rosa Díaz", "Elena Soto", "Luis Paz"]);
  });
});

describe("UsuariosPage — login", () => {
  it("muestra el username cuando existe, — cuando no, y ordena por él", async () => {
    jest.mocked(getUsersByCompany).mockResolvedValue([
      person({ id: "a", name: "Ana", surname: "Uno", username: "zeta" }),
      person({ id: "b", name: "Beto", surname: "Dos", username: "alfa" }),
      person({ id: "c", name: "Carla", surname: "Tres" }),
    ]);
    render(<UsuariosPage />);
    await screen.findByRole("button", { name: "Editar Ana Uno" });

    expect(visibleNames()).toEqual(["Carla Tres", "Beto Dos", "Ana Uno"]);
    const loginCell = (name: string) =>
      (screen.getByRole("button", { name: `Editar ${name}` }).closest("tr") as HTMLTableRowElement).cells[1];
    expect(loginCell("Beto Dos")).toHaveTextContent("alfa");
    expect(loginCell("Carla Tres")).toHaveTextContent(/—$/);
    expect(loginCell("Carla Tres")).not.toHaveTextContent("c@empresa.com");

    fireEvent.click(screen.getByRole("button", { name: /^Usuario/ }));
    expect(visibleNames()).toEqual(["Ana Uno", "Beto Dos", "Carla Tres"]);
  });
});

describe("UsuariosPage — paginación", () => {
  const many = Array.from({ length: 60 }, (_, i) =>
    person({ id: `p${String(i).padStart(2, "0")}`, name: `Persona${String(i).padStart(2, "0")}`, surname: "Prueba", status: i % 2 === 0 }),
  );

  const renderMany = async () => {
    jest.mocked(getUsersByCompany).mockResolvedValue(many);
    render(<UsuariosPage />);
    await screen.findByRole("button", { name: "Editar Persona00 Prueba" });
  };

  it("usa 50 por página por defecto y ofrece 50, 25 y 10", async () => {
    await renderMany();

    expect(visibleNames()).toHaveLength(50);
    expect(screen.getByText("Mostrando 1–50 de 60 usuarios")).toBeInTheDocument();
    const sizes = within(screen.getByRole("combobox", { name: "Filas por página" })).getAllByRole("option");
    expect(sizes.map((option) => option.textContent)).toEqual(["50", "25", "10"]);
  });

  it("cambiar el tamaño vuelve a la primera página", async () => {
    await renderMany();
    fireEvent.click(screen.getByRole("button", { name: "Página 2" }));
    expect(screen.getByText("Mostrando 51–60 de 60 usuarios")).toBeInTheDocument();

    chooseOption("Filas por página", "25");

    expect(visibleNames()).toHaveLength(25);
    expect(screen.getByText("Mostrando 1–25 de 60 usuarios")).toBeInTheDocument();
  });

  it.each([
    ["el orden", () => fireEvent.click(screen.getByRole("button", { name: /^Apellidos/ }))],
    ["el filtro de estado", () => chooseOption("Filtrar por estado", "Activo")],
    ["el filtro de rol", () => chooseOption("Filtrar por rol", "Sin rol")],
    ["la búsqueda", () => search("persona")],
  ])("al cambiar %s vuelve a la primera página", async (_, change) => {
    await renderMany();
    chooseOption("Filas por página", "10");
    fireEvent.click(screen.getByRole("button", { name: "Página 3" }));
    expect(screen.getByText(/^Mostrando 21–30/)).toBeInTheDocument();

    change();

    expect(screen.getByText(/^Mostrando 1–/)).toBeInTheDocument();
  });
});

describe("UsuariosPage — selección y exportación", () => {
  it("selecciona filas, informa las ocultas por filtros y exporta solo la selección en el orden actual", async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Ana Bravo" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar Luis Paz" }));
    expect(screen.getByText(/2 seleccionados/)).toBeInTheDocument();

    chooseOption("Filtrar por estado", "Activo");
    expect(screen.getByText(/1 oculto por los filtros/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Exportar seleccionados (2)" }));

    await waitFor(() => expect(exportUsersToExcel).toHaveBeenCalledTimes(1));
    expect(jest.mocked(exportUsersToExcel).mock.calls[0][0].map((u: User) => u.id)).toEqual(["u6", "u2"]);
  });

  it("sin selección exporta el listado filtrado completo, no solo la página visible", async () => {
    await renderLoaded();
    chooseOption("Filtrar por estado", "Activo");

    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));

    await waitFor(() => expect(exportUsersToExcel).toHaveBeenCalledTimes(1));
    expect(jest.mocked(exportUsersToExcel).mock.calls[0][0].map((u: User) => u.id)).toEqual(["u6", "u1", "u4", "u3"]);
  });

  it("el checkbox de cabecera selecciona la página visible y Limpiar selección la vacía", async () => {
    await renderLoaded();
    const header = screen.getByRole("checkbox", { name: "Seleccionar usuarios de esta página" });

    fireEvent.click(header);
    expect(screen.getByText(/6 seleccionados/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Seleccionar Elena Soto" })).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Limpiar selección" }));
    expect(screen.queryByText(/seleccionados/)).not.toBeInTheDocument();
    expect(header).not.toBeChecked();
  });

  it("si la exportación falla avisa el error", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.mocked(exportUsersToExcel).mockRejectedValueOnce(new Error("disk"));
    await renderLoaded();

    fireEvent.click(screen.getByRole("button", { name: "Exportar" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("No se pudo generar el archivo de usuarios"));
    expect(toast.success).not.toHaveBeenCalled();
    jest.mocked(console.error).mockRestore();
  });
});

describe("UsuariosPage — acciones pendientes de backend", () => {
  it("Invitar por email abre el diseño completo pero no envía nada", async () => {
    await renderLoaded();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Invitar por email" }));

    const dialog = await screen.findByRole("dialog", { name: "Invitar por email" });
    expect(within(dialog).getByLabelText("Email del colaborador")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Nombre completo")).toBeInTheDocument();
    const roleSelect = within(dialog).getByLabelText("Rol a asignar");
    expect(within(roleSelect).getAllByRole("option").map((o) => o.textContent)).toEqual(["Selecciona el rol", "VENTAS", "OPERACIONES"]);
    expect(within(dialog).getByRole("button", { name: "Enviar invitación" })).toBeDisabled();
    expect(within(dialog).getByText("Invitaciones todavía no habilitadas")).toBeInTheDocument();
  });

  it("Eliminar pide confirmación pero no llama al DELETE de rollback", async () => {
    await renderLoaded();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Eliminar Luis Paz" }));

    const dialog = await screen.findByRole("alertdialog", { name: "¿Eliminar a Luis Paz?" });
    const confirm = within(dialog).getByRole("button", { name: "Eliminar usuario" });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(deleteUser).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("Resumen muestra solo datos reales y marca la actividad como no disponible", async () => {
    await renderLoaded();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Resumen de Marco Ruiz" }));

    const dialog = await screen.findByRole("dialog", { name: "Resumen — Marco Ruiz" });
    expect(within(dialog).getByText("987654321")).toBeInTheDocument();
    expect(within(dialog).getByText("SUPERVISOR")).toBeInTheDocument();
    expect(within(dialog).getByText("Última conexión y actividad no disponibles")).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });
});

describe("UsuariosPage — pestaña Roles y permisos", () => {
  it("muestra el catálogo de E2 con descripción solo si existe y conteos de la empresa", async () => {
    await renderLoaded();
    await openTab(/Roles y permisos/);

    expect(within(roleCard("VENTAS")).getByText("Pedidos y clientes")).toBeInTheDocument();
    expect(within(roleCard("VENTAS")).getByText("3 usuarios")).toBeInTheDocument();
    expect(within(roleCard("ADMINISTRADOR")).getByText("1 usuario")).toBeInTheDocument();
    expect(within(roleCard("OPERACIONES")).getByText("0 usuarios")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "SUPERVISOR" })).not.toBeInTheDocument();
    expect(within(roleCard("ADMINISTRADOR")).queryByText(/se puede elegir/i)).not.toBeInTheDocument();
  });

  it("la tarjeta Personalizado es una acción de creación, sin conteo inventado, y abre el modal", async () => {
    await renderLoaded();
    const user = await openTab(/Roles y permisos/);

    const custom = roleCard("Personalizado");
    expect(within(custom).queryByText(/usuarios?$/)).not.toBeInTheDocument();
    await user.click(within(custom).getByRole("button", { name: "Crear nuevo" }));

    const dialog = await screen.findByRole("dialog", { name: "Crear rol personalizado" });
    expect(within(dialog).getByRole("button", { name: "Guardar rol personalizado" })).toBeDisabled();
  });

  it("todos los modales pendientes se abren y sus avisos no muestran referencias técnicas", async () => {
    const technical = /docs\/|\.md|ms-auth|backend|contrato|DELETE|rollback/i;
    await renderLoaded();
    const user = userEvent.setup();
    const inspect = async (open: () => Promise<void>, role: "dialog" | "alertdialog", name: string, save: string) => {
      await open();
      const dialog = await screen.findByRole(role, { name });
      const saveButton = within(dialog).getByRole("button", { name: save });
      expect(saveButton).toBeDisabled();
      expect(dialog).not.toHaveTextContent(technical);
      const body = dialog.querySelector('[data-slot="users-dialog-body"]');
      const notice = within(dialog).getByRole("note");
      if (body) {
        expect(body).toContainElement(notice);
        expect(body).not.toContainElement(saveButton);
      }
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole(role, { name })).not.toBeInTheDocument());
    };

    await inspect(
      () => user.click(screen.getByRole("button", { name: "Invitar por email" })),
      "dialog",
      "Invitar por email",
      "Enviar invitación",
    );
    await inspect(
      () => user.click(screen.getByRole("button", { name: "Eliminar Luis Paz" })),
      "alertdialog",
      "¿Eliminar a Luis Paz?",
      "Eliminar usuario",
    );
    await user.click(screen.getByRole("button", { name: "Resumen de Luis Paz" }));
    const summary = await screen.findByRole("dialog", { name: "Resumen — Luis Paz" });
    expect(summary).not.toHaveTextContent(technical);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await openTab(/Roles y permisos/);
    await inspect(
      () => user.click(screen.getByRole("button", { name: "Crear rol personalizado" })),
      "dialog",
      "Crear rol personalizado",
      "Guardar rol personalizado",
    );
    await inspect(
      () => user.click(screen.getByRole("button", { name: "Editar permisos de VENTAS" })),
      "dialog",
      "Editar permisos — VENTAS",
      "Guardar permisos",
    );

    await openTab(/Referidos y cobro/);
    await user.click(screen.getByRole("radio", { name: /Monto en efectivo/ }));
    expect(document.body).not.toHaveTextContent(technical);
  });

  it("Crear rol personalizado abre el modal con matriz en vista previa y sin guardar", async () => {
    await renderLoaded();
    const user = await openTab(/Roles y permisos/);

    await user.click(screen.getByRole("button", { name: "Crear rol personalizado" }));

    const dialog = await screen.findByRole("dialog", { name: "Crear rol personalizado" });
    expect(within(dialog).getByRole("button", { name: "Guardar rol personalizado" })).toBeDisabled();
    expect(within(dialog).getAllByRole("radio")).toHaveLength(6);
    const permissionBoxes = within(dialog).getAllByRole("checkbox");
    expect(permissionBoxes.length).toBeGreaterThan(0);
    expect(permissionBoxes.every((box) => (box as HTMLInputElement).disabled && !(box as HTMLInputElement).checked)).toBe(true);
  });

  it("Editar permisos abre una extensión del diseño sin habilitar el guardado", async () => {
    await renderLoaded();
    const user = await openTab(/Roles y permisos/);

    await user.click(screen.getByRole("button", { name: "Editar permisos de VENTAS" }));

    const dialog = await screen.findByRole("dialog", { name: "Editar permisos — VENTAS" });
    expect(within(dialog).getByRole("button", { name: "Guardar permisos" })).toBeDisabled();
    expect(within(dialog).getByText("Edición de permisos todavía no habilitada")).toBeInTheDocument();
  });

  it("'Ver usuarios' vuelve a Usuarios con ese rol, sin búsqueda ni filtro de estado", async () => {
    await renderLoaded();
    search("marco");
    chooseOption("Filtrar por estado", "Inactivo");
    const user = await openTab(/Roles y permisos/);

    await user.click(screen.getByRole("button", { name: "Ver usuarios con rol VENTAS" }));

    expect(screen.getByRole("tab", { name: /Usuarios/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Buscar usuarios")).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Filtrar por estado" })).toHaveValue("all");
    expect((screen.getByRole("combobox", { name: "Filtrar por rol" }) as HTMLSelectElement).selectedOptions[0]).toHaveTextContent("VENTAS");
    expect(visibleNames()).toEqual(["Ana Bravo", "Luis Paz", "Rosa Díaz"]);
  });

  it("mientras carga el catálogo no muestra roles ni conteos", async () => {
    jest.mocked(getRoles).mockReturnValue(new Promise(() => {}));
    render(<UsuariosPage />);
    await screen.findByRole("button", { name: "Editar Ana Torres" });
    await openTab(/Roles y permisos/);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando roles…");
    expect(screen.queryByRole("heading", { name: "VENTAS" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+ usuarios?$/)).not.toBeInTheDocument();
  });

  it("si el catálogo falla muestra el error y Reintentar vuelve a pedirlo", async () => {
    jest.mocked(getRoles).mockRejectedValueOnce(new Error("500")).mockResolvedValueOnce(CATALOG);
    render(<UsuariosPage />);
    await screen.findByRole("button", { name: "Editar Ana Torres" });
    const user = await openTab(/Roles y permisos/);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No se pudieron cargar los roles.");
    await user.click(within(alert).getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("heading", { name: "VENTAS" })).toBeInTheDocument();
    expect(getRoles).toHaveBeenCalledTimes(2);
  });

  it("si E2 no devuelve roles lo informa sin crear roles de ejemplo", async () => {
    jest.mocked(getRoles).mockResolvedValue([]);
    render(<UsuariosPage />);
    await screen.findByRole("button", { name: "Editar Ana Torres" });
    await openTab(/Roles y permisos/);

    expect(await screen.findByText("No hay roles para mostrar.")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Personalizado"]);
  });

  it("si el listado de usuarios falla, los roles se muestran sin conteos", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.mocked(getUsersByCompany).mockRejectedValue(new Error("500"));
    render(<UsuariosPage />);
    await screen.findByText("No se pudieron cargar los usuarios.");
    await openTab(/Roles y permisos/);

    const ventas = (await screen.findByRole("heading", { name: "VENTAS" })).closest("li") as HTMLElement;
    expect(within(ventas).getByText("Sin datos de usuarios")).toBeInTheDocument();
    jest.mocked(console.error).mockRestore();
  });

  it("distingue roles con el mismo nombre por id", async () => {
    jest.mocked(getRoles).mockResolvedValue([
      { id: "r-v1", name: "VENTAS" },
      { id: "r-v2", name: "ventas " },
    ]);
    jest.mocked(getUsersByCompany).mockResolvedValue([
      person({ id: "a", name: "Ana", surname: "Uno", role: { id: "r-v1", name: "VENTAS" } }),
      person({ id: "b", name: "Beto", surname: "Dos", role: { id: "r-v2", name: "ventas" } }),
    ]);
    render(<UsuariosPage />);
    await screen.findByRole("button", { name: "Editar Ana Uno" });
    const user = await openTab(/Roles y permisos/);

    expect(within(roleCard("VENTAS · id r-v1")).getByText("1 usuario")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ver usuarios con rol ventas · id r-v2" }));

    expect(visibleNames()).toEqual(["Beto Dos"]);
  });
});

describe("UsuariosPage — Referidos y cobro", () => {
  it("muestra el diseño sin cifras ficticias ni link inventado", async () => {
    await renderLoaded();
    await openTab(/Referidos y cobro/);

    expect(screen.getByText("Programa de referidos todavía no disponible")).toBeInTheDocument();
    expect(screen.queryByText(/S\/ 0|^0%$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/powip\.lat\/ref/)).not.toBeInTheDocument();
    expect(screen.getByText("Link no disponible todavía")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copiar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Compartir WA" })).toBeDisabled();
  });

  it("elegir efectivo muestra el formulario bancario y Yape/Plin, sin permitir guardar", async () => {
    await renderLoaded();
    const user = await openTab(/Referidos y cobro/);

    expect(screen.queryByRole("form", { name: /Cuenta bancaria/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Monto en efectivo/ }));

    const bankForm = screen.getByRole("form", { name: "Cuenta bancaria BCP" });
    expect(within(bankForm).getByLabelText("Número de cuenta")).toBeInTheDocument();
    expect(within(bankForm).getByRole("button", { name: "Guardar cuenta bancaria" })).toBeDisabled();
    expect(screen.queryByText(/cifrad/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Yape" }));

    const walletForm = screen.getByRole("form", { name: "Cuenta Yape" });
    expect(within(walletForm).getByLabelText("Número de celular Yape")).toBeInTheDocument();
    expect(within(walletForm).getByRole("button", { name: "Guardar Yape" })).toBeDisabled();
  });
});

describe("UsuariosPage — teclado y etiquetas", () => {
  it("las pestañas se recorren con flechas", async () => {
    await renderLoaded();
    const user = userEvent.setup();

    await user.click(screen.getByRole("tab", { name: /Usuarios/ }));
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: /Roles y permisos/ })).toHaveAttribute("aria-selected", "true");
  });

  it("los encabezados ordenables se activan con teclado y actualizan aria-sort", async () => {
    await renderLoaded();
    const user = userEvent.setup();
    const header = () => screen.getByRole("columnheader", { name: /Apellidos/ });

    expect(header()).toHaveAttribute("aria-sort", "none");
    screen.getByRole("button", { name: /^Apellidos/ }).focus();
    await user.keyboard("{Enter}");
    expect(header()).toHaveAttribute("aria-sort", "ascending");
    await user.keyboard(" ");
    expect(header()).toHaveAttribute("aria-sort", "descending");
  });

  it("búsqueda, filtros y selección tienen nombre accesible", async () => {
    await renderLoaded();

    expect(screen.getByRole("searchbox", { name: "Buscar usuarios" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por rol" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por estado" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filas por página" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Seleccionar usuarios de esta página" })).toBeInTheDocument();
  });
});
