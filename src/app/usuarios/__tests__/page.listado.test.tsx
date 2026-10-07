import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }), usePathname: () => "/usuarios" }));
jest.mock("@/services/userService", () => ({ getUsersByCompany: jest.fn(), getRoles: jest.fn(), updateUser: jest.fn() }));
jest.mock("@/components/modals/UserModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/ui/select", () => {
  const R = jest.requireActual("react");
  const SelectTrigger = () => null;
  const SelectContent = ({ children }: { children?: React.ReactNode }) => R.createElement(R.Fragment, null, children);
  const SelectItem = ({ value, children }: { value: string; children?: React.ReactNode }) =>
    R.createElement("option", { value }, children);
  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children?: React.ReactNode;
  }) => {
    const kids = R.Children.toArray(children) as React.ReactElement<Record<string, unknown>>[];
    const trigger = kids.find((c) => c.type === SelectTrigger);
    const content = kids.find((c) => c.type === SelectContent);
    return R.createElement(
      "select",
      {
        "aria-label": trigger?.props["aria-label"] ?? "select",
        value: value ?? "",
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onValueChange?.(e.target.value),
      },
      content?.props.children,
    );
  };
  return { Select, SelectTrigger, SelectContent, SelectItem, SelectValue: () => null };
});

import { useAuth } from "@/contexts/AuthContext";
import { getRoles, getUsersByCompany } from "@/services/userService";
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
  person({ id: "u4", name: "Marco", surname: "Ruiz", phoneNumber: "987654321", role: { id: "r-sup", name: "SUPERVISOR" } }),
  person({ id: "u5", name: "Elena", surname: "Soto", status: false, role: null }),
  person({ id: "u6", name: "Ana", surname: "Bravo", role: { id: "r-ventas", name: "VENTAS" } }),
];

const authWith = () =>
  jest.mocked(useAuth).mockReturnValue({
    auth: { accessToken: "token", company: { id: "company-1" }, user: { id: "admin-1", role: "ADMINISTRADOR" } },
    loading: false,
  } as unknown as ReturnType<typeof useAuth>);

beforeEach(() => {
  jest.clearAllMocks();
  authWith();
  jest.mocked(getUsersByCompany).mockResolvedValue(USERS);
  jest.mocked(getRoles).mockResolvedValue(CATALOG);
});

const visibleNames = () =>
  screen
    .queryAllByRole("button", { name: /^Editar / })
    .map((button) => button.getAttribute("aria-label")?.replace("Editar ", ""));

const cardValue = (label: string) =>
  (
    within(screen.getByRole("list", { name: "Resumen de usuarios" })).getByText(label).closest("li") as HTMLElement
  ).querySelectorAll("p")[1];

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
  await waitFor(() =>
    expect(within(screen.getByRole("combobox", { name: "Filtrar por rol" })).getByRole("option", { name: "OPERACIONES" })).toBeInTheDocument(),
  );
};

describe("UsuariosPage — tarjetas de resumen", () => {
  it("muestra total, activos, inactivos y sin rol del listado completo", async () => {
    await renderLoaded();

    expect(cardValue("Total")).toHaveTextContent("6");
    expect(cardValue("Activos")).toHaveTextContent("4");
    expect(cardValue("Inactivos")).toHaveTextContent("2");
    expect(cardValue("Sin rol")).toHaveTextContent("1");
    expect(screen.getByText("Cuentas habilitadas")).toBeInTheDocument();
    expect(screen.queryByText(/activos ahora|conectad/i)).not.toBeInTheDocument();
  });

  it("no cambian al buscar o filtrar", async () => {
    await renderLoaded();

    chooseOption("Filtrar por estado", "Inactivos");
    search("luis");

    expect(visibleNames()).toEqual(["Luis Paz"]);
    expect(cardValue("Total")).toHaveTextContent("6");
    expect(cardValue("Activos")).toHaveTextContent("4");
  });

  it("si el listado falla no muestra números", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.mocked(getUsersByCompany).mockRejectedValue(new Error("500"));
    render(<UsuariosPage />);

    await screen.findByText("No se pudieron cargar los usuarios.");
    expect(cardValue("Total")).toHaveTextContent("—");
    expect(cardValue("Sin rol")).toHaveTextContent("—");
    jest.mocked(console.error).mockRestore();
  });
});

describe("UsuariosPage — búsqueda y filtros", () => {
  it("combina rol, estado y búsqueda", async () => {
    await renderLoaded();

    chooseOption("Filtrar por rol", "VENTAS");
    expect(visibleNames()).toEqual(["Ana Bravo", "Luis Paz", "Rosa Díaz"]);

    chooseOption("Filtrar por estado", "Activos");
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

  it("busca por teléfono, distrito y rol", async () => {
    await renderLoaded();

    search("987654");
    expect(visibleNames()).toEqual(["Marco Ruiz"]);
    search("breña");
    expect(visibleNames()).toEqual(["Rosa Díaz"]);
    search("administrador");
    expect(visibleNames()).toEqual(["Ana Torres"]);
  });

  it("sin coincidencias ofrece limpiar los filtros", async () => {
    await renderLoaded();
    chooseOption("Filtrar por estado", "Inactivos");
    search("zzz");

    expect(screen.getByText("No se encontraron usuarios.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));

    expect(visibleNames()).toHaveLength(6);
    expect(screen.getByLabelText("Buscar usuarios")).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Filtrar por estado" })).toHaveValue("all");
  });
});

describe("UsuariosPage — orden", () => {
  it("ordena por nombre por defecto y alterna la dirección desde el encabezado", async () => {
    await renderLoaded();

    expect(visibleNames()).toEqual(["Ana Bravo", "Ana Torres", "Elena Soto", "Luis Paz", "Marco Ruiz", "Rosa Díaz"]);
    expect(screen.getByRole("columnheader", { name: /Nombre/ })).toHaveAttribute("aria-sort", "ascending");

    fireEvent.click(screen.getByRole("button", { name: /^Nombre/ }));

    expect(visibleNames()).toEqual(["Rosa Díaz", "Marco Ruiz", "Luis Paz", "Elena Soto", "Ana Bravo", "Ana Torres"]);
    expect(screen.getByRole("columnheader", { name: /Nombre/ })).toHaveAttribute("aria-sort", "descending");
  });

  it("ordena por apellido, email y estado", async () => {
    await renderLoaded();

    fireEvent.click(screen.getByRole("button", { name: /^Apellido/ }));
    expect(visibleNames()).toEqual(["Ana Bravo", "Rosa Díaz", "Luis Paz", "Marco Ruiz", "Elena Soto", "Ana Torres"]);

    fireEvent.click(screen.getByRole("button", { name: /^Email/ }));
    expect(visibleNames()).toEqual(["Ana Torres", "Luis Paz", "Rosa Díaz", "Marco Ruiz", "Elena Soto", "Ana Bravo"]);

    fireEvent.click(screen.getByRole("button", { name: /^Estado/ }));
    expect(visibleNames()).toEqual(["Ana Bravo", "Ana Torres", "Marco Ruiz", "Rosa Díaz", "Elena Soto", "Luis Paz"]);
  });
});

describe("UsuariosPage — paginación", () => {
  const many = Array.from({ length: 30 }, (_, i) =>
    person({ id: `p${i}`, name: `Persona${String(i).padStart(2, "0")}`, surname: "Prueba", status: i % 2 === 0 }),
  );

  const goToLastPage = () => fireEvent.click(screen.getByRole("button", { name: "3" }));

  it("cambia el tamaño de página y vuelve a la primera", async () => {
    jest.mocked(getUsersByCompany).mockResolvedValue(many);
    render(<UsuariosPage />);
    await screen.findByRole("button", { name: "Editar Persona00 Prueba" });

    expect(visibleNames()).toHaveLength(10);
    goToLastPage();
    expect(visibleNames()[0]).toBe("Persona20 Prueba");

    chooseOption("Filas por página", "25");

    expect(visibleNames()).toHaveLength(25);
    expect(visibleNames()[0]).toBe("Persona00 Prueba");
    expect(screen.getByText("Mostrando 1 - 25 de 30 usuarios")).toBeInTheDocument();
  });

  it.each([
    ["el orden", () => fireEvent.click(screen.getByRole("button", { name: /^Apellido/ }))],
    ["el filtro de estado", () => chooseOption("Filtrar por estado", "Activos")],
    ["el filtro de rol", () => chooseOption("Filtrar por rol", "Sin rol")],
    ["la búsqueda", () => search("persona")],
  ])("al cambiar %s vuelve a la primera página", async (_, change) => {
    jest.mocked(getUsersByCompany).mockResolvedValue(many);
    render(<UsuariosPage />);
    await screen.findByRole("button", { name: "Editar Persona00 Prueba" });
    goToLastPage();
    expect(screen.getByText(/^Mostrando 21 - 30/)).toBeInTheDocument();

    change();

    expect(screen.getByText(/^Mostrando 1 - /)).toBeInTheDocument();
  });
});

describe("UsuariosPage — pestaña Roles", () => {
  const openRoles = async () => {
    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Roles" }));
    return user;
  };

  it("muestra el catálogo de E2 con descripción solo si existe y cantidad de usuarios de la empresa", async () => {
    await renderLoaded();
    await openRoles();

    const ventas = roleCard("VENTAS");
    expect(within(ventas).getByText("Pedidos y clientes")).toBeInTheDocument();
    expect(within(ventas).getByText("3 usuarios")).toBeInTheDocument();
    expect(within(roleCard("ADMINISTRADOR")).getByText("1 usuario")).toBeInTheDocument();
    expect(within(roleCard("OPERACIONES")).getByText("0 usuarios")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "SUPERVISOR" })).not.toBeInTheDocument();
  });

  it("no presenta ADMINISTRADOR como elegible ni ofrece acciones sin backend", async () => {
    await renderLoaded();
    await openRoles();

    expect(within(roleCard("ADMINISTRADOR")).queryByText(/se puede elegir/i)).not.toBeInTheDocument();
    expect(within(roleCard("VENTAS")).getByText(/se puede elegir/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /crear rol|editar permisos|invitar|eliminar|resumen/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/personalizado|sistema|módulos/i)).not.toBeInTheDocument();
  });

  it("'Ver usuarios' vuelve a Usuarios con ese rol, sin búsqueda ni filtro de estado, en la página 1", async () => {
    await renderLoaded();
    search("marco");
    chooseOption("Filtrar por estado", "Inactivos");
    const user = await openRoles();

    await user.click(screen.getByRole("button", { name: "Ver usuarios con rol VENTAS" }));

    expect(screen.getByRole("tab", { name: "Usuarios" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Buscar usuarios")).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Filtrar por estado" })).toHaveValue("all");
    const roleFilter = screen.getByRole("combobox", { name: "Filtrar por rol" }) as HTMLSelectElement;
    expect(roleFilter.selectedOptions[0]).toHaveTextContent("VENTAS");
    expect(visibleNames()).toEqual(["Ana Bravo", "Luis Paz", "Rosa Díaz"]);
  });

  it("mientras carga el catálogo no muestra roles ni conteos", async () => {
    jest.mocked(getRoles).mockReturnValue(new Promise(() => {}));
    render(<UsuariosPage />);
    await screen.findByRole("button", { name: "Editar Ana Torres" });
    await openRoles();

    expect(screen.getByRole("status")).toHaveTextContent("Cargando roles…");
    expect(screen.queryByRole("heading", { name: "VENTAS" })).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+ usuarios?$/)).not.toBeInTheDocument();
  });

  it("si el catálogo falla muestra el error y Reintentar vuelve a pedirlo", async () => {
    jest.mocked(getRoles).mockRejectedValueOnce(new Error("500")).mockResolvedValueOnce(CATALOG);
    render(<UsuariosPage />);
    await screen.findByRole("button", { name: "Editar Ana Torres" });
    const user = await openRoles();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No se pudieron cargar los roles.");
    expect(screen.queryByRole("heading", { name: "VENTAS" })).not.toBeInTheDocument();

    await user.click(within(alert).getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("heading", { name: "VENTAS" })).toBeInTheDocument();
    expect(getRoles).toHaveBeenCalledTimes(2);
  });

  it("si E2 no devuelve roles muestra el estado vacío", async () => {
    jest.mocked(getRoles).mockResolvedValue([]);
    render(<UsuariosPage />);
    await screen.findByRole("button", { name: "Editar Ana Torres" });
    await openRoles();

    expect(await screen.findByText("ms-auth no devolvió roles para mostrar.")).toBeInTheDocument();
  });

  it("si el listado de usuarios falla, los roles se muestran sin conteos", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.mocked(getUsersByCompany).mockRejectedValue(new Error("500"));
    render(<UsuariosPage />);
    await screen.findByText("No se pudieron cargar los usuarios.");
    await openRoles();

    const ventas = (await screen.findByRole("heading", { name: "VENTAS" })).closest("li") as HTMLElement;
    expect(within(ventas).getByText("Sin datos de usuarios")).toBeInTheDocument();
    expect(within(ventas).queryByText(/\d+ usuarios?/)).not.toBeInTheDocument();
    jest.mocked(console.error).mockRestore();
  });
});

describe("UsuariosPage — roles con el mismo nombre", () => {
  it("distingue por id en el filtro, en el catálogo y en 'Ver usuarios'", async () => {
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

    const roleFilter = screen.getByRole("combobox", { name: "Filtrar por rol" });
    await waitFor(() =>
      expect(within(roleFilter).getAllByRole("option").map((o) => o.textContent)).toEqual([
        "Todos los roles",
        "VENTAS · id r-v1",
        "ventas · id r-v2",
        "Sin rol",
      ]),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "Roles" }));
    expect(within(roleCard("VENTAS · id r-v1")).getByText("1 usuario")).toBeInTheDocument();
    expect(within(roleCard("ventas · id r-v2")).getByText("1 usuario")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ver usuarios con rol ventas · id r-v2" }));

    expect(visibleNames()).toEqual(["Beto Dos"]);
  });
});

describe("UsuariosPage — teclado", () => {
  it("las pestañas se recorren con flechas y 'Ver usuarios' responde a Enter", async () => {
    await renderLoaded();
    const user = userEvent.setup();

    screen.getByRole("tab", { name: "Usuarios" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(screen.getByRole("tab", { name: "Roles" })).toHaveAttribute("aria-selected", "true");

    screen.getByRole("button", { name: "Ver usuarios con rol OPERACIONES" }).focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("tab", { name: "Usuarios" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("No se encontraron usuarios.")).toBeInTheDocument();
  });

  it("los encabezados ordenables se activan con Enter y Espacio y actualizan aria-sort", async () => {
    await renderLoaded();
    const user = userEvent.setup();
    const header = () => screen.getByRole("columnheader", { name: /Apellido/ });

    expect(header()).toHaveAttribute("aria-sort", "none");
    screen.getByRole("button", { name: /^Apellido/ }).focus();
    await user.keyboard("{Enter}");
    expect(header()).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("columnheader", { name: /Nombre/ })).toHaveAttribute("aria-sort", "none");

    await user.keyboard(" ");
    expect(header()).toHaveAttribute("aria-sort", "descending");
  });

  it("la búsqueda y los filtros tienen nombre accesible", async () => {
    await renderLoaded();

    expect(screen.getByRole("searchbox", { name: "Buscar usuarios" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por rol" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filtrar por estado" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filas por página" })).toBeInTheDocument();
  });
});
