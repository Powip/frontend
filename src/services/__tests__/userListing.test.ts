import type { Role, User } from "@/interfaces/IUser";
import {
  ALL_ROLES_FILTER,
  NO_ROLE_FILTER,
  buildRoleOptions,
  countUsersByRole,
  filterUsers,
  paginate,
  sortUsers,
  summarizeUsers,
} from "../userListing";

const user = (overrides: Partial<User> & Pick<User, "id" | "name" | "surname">): User => ({
  identityDocument: "",
  email: `${overrides.id}@empresa.com`,
  status: true,
  role: null,
  ...overrides,
});

const CATALOG: Role[] = [
  { id: "r-admin", name: "ADMINISTRADOR" },
  { id: "r-ventas", name: "VENTAS", description: "  Pedidos y clientes  " },
];

const USERS: User[] = [
  user({ id: "u1", name: "Ana", surname: "Torres", role: { id: "r-admin", name: "ADMINISTRADOR" } }),
  user({ id: "u2", name: "Luis", surname: "Paz", status: false, role: { id: "r-ventas", name: "VENTAS" } }),
  user({ id: "u3", name: "Rosa", surname: "Díaz", role: { id: "", name: "ventas" }, district: "Breña" }),
  user({ id: "u4", name: "Marco", surname: "Ruiz", role: { id: "r-legacy", name: "SUPERVISOR" }, phoneNumber: "987654321" }),
  user({ id: "u5", name: "Elena", surname: "Soto", status: false, role: null }),
  user({ id: "u6", name: "Iván", surname: "Gil", role: { id: "r-blank", name: "   " } }),
];

describe("summarizeUsers", () => {
  it("cuenta activos solo con status true y trata un rol sin nombre como sin rol", () => {
    const withUnknownStatus = [...USERS, { ...USERS[0], id: "u7", status: undefined as unknown as boolean }];

    expect(summarizeUsers(withUnknownStatus)).toEqual({ total: 7, active: 4, inactive: 3, withoutRole: 2 });
  });

  it("devuelve ceros para una empresa sin usuarios", () => {
    expect(summarizeUsers([])).toEqual({ total: 0, active: 0, inactive: 0, withoutRole: 0 });
  });
});

describe("buildRoleOptions", () => {
  it("usa el catálogo primero, agrega los roles de E3 que faltan y no duplica por id ni por nombre", () => {
    const options = buildRoleOptions(CATALOG, USERS);

    expect(options.map((o) => [o.name, o.inCatalog])).toEqual([
      ["ADMINISTRADOR", true],
      ["VENTAS", true],
      ["SUPERVISOR", false],
    ]);
    expect(options[1].description).toBe("Pedidos y clientes");
  });

  it("no inventa descripción cuando E2 no la trae", () => {
    expect(buildRoleOptions(CATALOG, [])[0].description).toBeUndefined();
  });

  it("un mismo nombre con otro id es otro rol y queda identificado como fuera del catálogo", () => {
    const options = buildRoleOptions(CATALOG, [
      user({ id: "x", name: "X", surname: "Y", role: { id: "r-ventas-2", name: "VENTAS" } }),
    ]);

    expect(options.filter((o) => o.name === "VENTAS").map((o) => o.inCatalog)).toEqual([true, false]);
  });

  it("con E2 sin ids, reconoce los roles de E3 por nombre", () => {
    const users = [user({ id: "x", name: "X", surname: "Y", role: { id: "r-ventas", name: "Ventas" } })];
    const options = buildRoleOptions([{ id: "", name: "VENTAS" }], users);

    expect(options).toHaveLength(1);
    expect(countUsersByRole(users, options).get(options[0].key)).toBe(1);
  });
});

describe("identificación de roles entre E2 y E3", () => {
  const someone = (id: string, role: User["role"]) => user({ id, name: id, surname: "X", role });

  const describeRoles = (catalog: Role[], users: User[]) => {
    const options = buildRoleOptions(catalog, users);
    const counts = countUsersByRole(users, options);
    return options.map((option) => {
      const members = filterUsers(users, { query: "", roleKey: option.key, status: "all" }, options).map((u) => u.id);
      expect(members).toHaveLength(counts.get(option.key) ?? -1);
      return [option.label, members];
    });
  };

  it("mismo id con variaciones de mayúsculas y espacios es el mismo rol", () => {
    expect(describeRoles([{ id: "r-v", name: "VENTAS" }], [someone("a", { id: "r-v", name: "  ventas " })])).toEqual([
      ["VENTAS", ["a"]],
    ]);
  });

  it("mismo nombre sin id en E3 o en E2 se reconoce por nombre", () => {
    expect(describeRoles([{ id: "r-v", name: "VENTAS" }], [someone("a", { id: "", name: "Ventas" })])).toEqual([
      ["VENTAS", ["a"]],
    ]);
    expect(describeRoles([{ id: "", name: " Ventas" }], [someone("a", { id: "r-v", name: "VENTAS" })])).toEqual([
      ["Ventas", ["a"]],
    ]);
  });

  it("mismo nombre con ids distintos no se fusiona y la etiqueta muestra el id", () => {
    expect(
      describeRoles(
        [{ id: "r-v", name: "VENTAS" }],
        [someone("a", { id: "r-v", name: "VENTAS" }), someone("b", { id: "r-otro", name: "ventas" })],
      ),
    ).toEqual([
      ["VENTAS · id r-v", ["a"]],
      ["ventas · id r-otro (fuera del catálogo)", ["b"]],
    ]);
  });

  it("un rol sin id no se asigna a ninguno de dos roles de E2 con el mismo nombre", () => {
    expect(
      describeRoles(
        [
          { id: "r-1", name: "VENTAS" },
          { id: "r-2", name: "VENTAS" },
        ],
        [someone("a", { id: "", name: "VENTAS" }), someone("b", { id: "r-2", name: "VENTAS" })],
      ),
    ).toEqual([
      ["VENTAS · id r-1", []],
      ["VENTAS · id r-2", ["b"]],
      ["VENTAS · sin id (fuera del catálogo)", ["a"]],
    ]);
  });

  it("la coincidencia exacta de id gana aunque E2 traiga antes el mismo nombre sin id", () => {
    expect(
      describeRoles(
        [
          { id: "", name: "VENTAS" },
          { id: "r-v", name: "VENTAS" },
        ],
        [someone("a", { id: "r-v", name: "VENTAS" }), someone("b", { id: "", name: "VENTAS" })],
      ),
    ).toEqual([
      ["VENTAS · sin id", ["b"]],
      ["VENTAS · id r-v", ["a"]],
    ]);
  });

  it("si E3 trae dos ids con el mismo nombre, no los fusiona con el rol de E2 sin id", () => {
    expect(
      describeRoles(
        [{ id: "", name: "VENTAS" }],
        [someone("a", { id: "r-1", name: "VENTAS" }), someone("b", { id: "r-2", name: "VENTAS" })],
      ),
    ).toEqual([
      ["VENTAS · sin id", []],
      ["VENTAS · id r-1 (fuera del catálogo)", ["a"]],
      ["VENTAS · id r-2 (fuera del catálogo)", ["b"]],
    ]);
  });
});

describe("countUsersByRole", () => {
  it("cuenta cada usuario una sola vez, incluidos los roles reconocidos solo por nombre", () => {
    const options = buildRoleOptions(CATALOG, USERS);
    const counts = countUsersByRole(USERS, options);

    expect(options.map((o) => [o.name, counts.get(o.key)])).toEqual([
      ["ADMINISTRADOR", 1],
      ["VENTAS", 2],
      ["SUPERVISOR", 1],
    ]);
  });
});

describe("filterUsers", () => {
  const options = buildRoleOptions(CATALOG, USERS);
  const ventas = options.find((o) => o.name === "VENTAS")?.key ?? "";
  const ids = (users: User[]) => users.map((u) => u.id);
  const all = { query: "", roleKey: ALL_ROLES_FILTER, status: "all" as const };

  it("combina rol, estado y búsqueda", () => {
    expect(ids(filterUsers(USERS, { ...all, roleKey: ventas }, options))).toEqual(["u2", "u3"]);
    expect(ids(filterUsers(USERS, { ...all, roleKey: ventas, status: "active" }, options))).toEqual(["u3"]);
    expect(ids(filterUsers(USERS, { query: "paz", roleKey: ventas, status: "active" }, options))).toEqual([]);
  });

  it("Sin rol incluye usuarios sin rol o con nombre de rol vacío", () => {
    expect(ids(filterUsers(USERS, { ...all, roleKey: NO_ROLE_FILTER }, options))).toEqual(["u5", "u6"]);
  });

  it("filtra por un rol que solo aparece en E3", () => {
    const supervisor = options.find((o) => o.name === "SUPERVISOR")?.key ?? "";
    expect(ids(filterUsers(USERS, { ...all, roleKey: supervisor }, options))).toEqual(["u4"]);
  });

  it.each([
    ["teléfono", "98765", ["u4"]],
    ["distrito", "brena", ["u3"]],
    ["apellido sin tilde", "diaz", ["u3"]],
    ["rol", "supervisor", ["u4"]],
    ["email", "u5@empresa", ["u5"]],
    ["espacios alrededor", "  luis ", ["u2"]],
  ])("busca por %s", (_, query, expected) => {
    expect(ids(filterUsers(USERS, { ...all, query }, options))).toEqual(expected);
  });

  it("el estado inactivo incluye status distinto de true", () => {
    expect(ids(filterUsers(USERS, { ...all, status: "inactive" }, options))).toEqual(["u2", "u5"]);
  });
});

describe("sortUsers", () => {
  const people = [
    user({ id: "b", name: "Ana", surname: "Torres", email: "z@x.com" }),
    user({ id: "a", name: "ana", surname: "Bravo", email: "y@x.com", status: false }),
    user({ id: "c", name: "Álvaro", surname: "Torres", email: "a@x.com" }),
    user({ id: "d", name: "Ana", surname: "Bravo", email: "y@x.com" }),
  ];
  const ids = (users: User[]) => users.map((u) => u.id);

  it("ordena por nombre sin distinguir mayúsculas ni tildes y desempata por apellido, email e id", () => {
    expect(ids(sortUsers(people, "name", "asc"))).toEqual(["c", "a", "d", "b"]);
  });

  it("al invertir el nombre mantiene el desempate ascendente", () => {
    expect(ids(sortUsers(people, "name", "desc"))).toEqual(["a", "d", "b", "c"]);
  });

  it("ordena por apellido y desempata por nombre", () => {
    expect(ids(sortUsers(people, "surname", "asc"))).toEqual(["a", "d", "c", "b"]);
  });

  it("ordena por email", () => {
    expect(ids(sortUsers(people, "email", "asc"))).toEqual(["c", "a", "d", "b"]);
  });

  it("estado ascendente pone primero los activos y descendente los inactivos", () => {
    expect(ids(sortUsers(people, "status", "asc"))).toEqual(["c", "d", "b", "a"]);
    expect(ids(sortUsers(people, "status", "desc"))[0]).toBe("a");
  });

  it("no modifica el arreglo original", () => {
    const copy = [...people];
    sortUsers(people, "name", "desc");
    expect(people).toEqual(copy);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 23 }, (_, i) => i);

  it("devuelve la página pedida y el total de páginas", () => {
    expect(paginate(items, 3, 10)).toMatchObject({ items: [20, 21, 22], currentPage: 3, totalPages: 3 });
  });

  it("si la página no existe, muestra la última", () => {
    expect(paginate(items, 9, 10)).toMatchObject({ currentPage: 3, items: [20, 21, 22] });
  });

  it("sin elementos hay una sola página vacía", () => {
    expect(paginate([], 4, 25)).toMatchObject({ items: [], currentPage: 1, totalPages: 1 });
  });
});
