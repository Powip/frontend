import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import RolesPanel from "../RolesPanel";
import {
  type CompanyRole,
  createCompanyRole,
  deleteCompanyRole,
  getPermissionCatalog,
  getRolePermissions,
  type PermissionCatalog,
  updateCompanyRole,
} from "../rolesService";
import type { useCompanyRoles } from "../useCompanyRoles";

jest.mock("../rolesService", () => ({
  getPermissionCatalog: jest.fn(),
  getRolePermissions: jest.fn(),
  createCompanyRole: jest.fn(),
  updateCompanyRole: jest.fn(),
  deleteCompanyRole: jest.fn(),
  userError: (error: Error) => error.message,
  PERMISSION_ACTIONS: ["read", "create", "update", "delete", "admin"],
}));
const catalog: PermissionCatalog = {
  version: 1,
  sections: [
    {
      id: "catalog",
      label: "Catálogo",
      routes: [
        {
          id: "products",
          label: "Productos",
          path: "/productos",
          actions: ["read"],
          delegableActions: ["read"],
          permissionNames: { read: "VIEW_PRODUCTS" },
        },
      ],
    },
  ],
};
const role: CompanyRole = {
  id: "role",
  name: "Solo catálogo",
  assignmentName: "CUSTOM_UUID",
  color: "#0f766e",
  isCustom: true,
  isSystem: false,
  assignable: true,
  canEditPermissions: true,
  userCount: 0,
  permissionsVersion: 4,
};
function state(
  overrides: Partial<ReturnType<typeof useCompanyRoles>> = {},
): ReturnType<typeof useCompanyRoles> {
  return {
    scope: "company-a:actor",
    access: { userId: "actor", companyId: "company-a", canRead: true, canWrite: true },
    roles: [role],
    loading: false,
    error: "",
    refresh: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getPermissionCatalog).mockResolvedValue(catalog);
  jest.mocked(getRolePermissions).mockResolvedValue({
    roleId: "role",
    version: 4,
    grants: [{ permissionId: "products", actions: ["read"] }],
    canEditPermissions: true,
  });
});
test("denied access never loads catalog or exposes mutations", () => {
  render(
    <RolesPanel
      state={state({
        access: { userId: "actor", companyId: "company-a", canRead: false, canWrite: false },
      })}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("no tiene permiso");
  expect(getPermissionCatalog).not.toHaveBeenCalled();
  expect(screen.queryByText("Solo catálogo")).not.toBeInTheDocument();
});
test("ordinary user managers can view but cannot create or save roles", async () => {
  render(
    <RolesPanel
      state={state({
        access: { userId: "actor", companyId: "company-a", canRead: true, canWrite: false },
      })}
    />,
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "Ver permisos" })).toBeEnabled());
  expect(screen.queryByRole("button", { name: "Crear rol personalizado" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ver permisos" }));
  expect(await screen.findByRole("checkbox", { name: "Ver en Productos" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Guardar rol" })).not.toBeInTheDocument();
});
test("create sends selected catalog grants and refreshes after success", async () => {
  const current = state();
  jest.mocked(createCompanyRole).mockResolvedValue(role);
  render(<RolesPanel state={current} />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Crear rol personalizado" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Crear rol personalizado" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), {
    target: { value: "Marketing" },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: "Ver en Productos" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar rol" }));
  await waitFor(() =>
    expect(createCompanyRole).toHaveBeenCalledWith({
      name: "Marketing",
      description: "",
      color: "#0f766e",
      grants: [{ permissionId: "products", actions: ["read"] }],
    }),
  );
  expect(current.refresh).toHaveBeenCalled();
});
test("edit includes version and keeps draft open on assigned-role conflict", async () => {
  jest
    .mocked(updateCompanyRole)
    .mockRejectedValue(new Error("Este perfil tiene usuarios asignados. Crea una copia."));
  render(<RolesPanel state={state()} />);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Editar permisos" })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Editar permisos" }));
  await screen.findByRole("checkbox", { name: "Ver en Productos" });
  fireEvent.click(screen.getByRole("button", { name: "Guardar rol" }));
  await screen.findByRole("alert");
  expect(updateCompanyRole).toHaveBeenCalledWith("role", expect.objectContaining({ version: 4 }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});
test.each([
  ["system", { isCustom: false, isSystem: true, userCount: 0 }],
  ["assigned", { userCount: 2, canEditPermissions: true }],
])("%s profiles remain immutable even if DTO advertises editability", async (_, patch) => {
  render(<RolesPanel state={state({ roles: [{ ...role, ...patch }] })} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Ver permisos" })).toBeEnabled());
  const remove = screen.queryByRole("button", { name: "Eliminar rol Solo catálogo" });
  if (remove) expect(remove).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Ver permisos" }));
  expect(await screen.findByRole("checkbox", { name: "Ver en Productos" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Guardar rol" })).not.toBeInTheDocument();
  expect(deleteCompanyRole).not.toHaveBeenCalled();
});
test("copy of assigned profile loads its grants and creates a separate editable profile", async () => {
  jest.mocked(getRolePermissions).mockResolvedValue({
    roleId: "role",
    version: 4,
    grants: [{ permissionId: "products", actions: ["read"] }],
    canEditPermissions: false,
  });
  jest.mocked(createCompanyRole).mockResolvedValue({ ...role, id: "copy" });
  render(
    <RolesPanel state={state({ roles: [{ ...role, userCount: 1, canEditPermissions: false }] })} />,
  );
  await waitFor(() => expect(screen.getByRole("button", { name: "Crear copia" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Crear copia" }));
  const grant = await screen.findByRole("checkbox", { name: "Ver en Productos" });
  expect(grant).toBeChecked();
  expect(grant).toBeEnabled();
  expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Solo catálogo (copia)");
  fireEvent.click(screen.getByRole("button", { name: "Guardar rol" }));
  await waitFor(() =>
    expect(createCompanyRole).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Solo catálogo (copia)",
        grants: [{ permissionId: "products", actions: ["read"] }],
      }),
    ),
  );
  expect(updateCompanyRole).not.toHaveBeenCalled();
});

test("copy excludes protected or unknown actions from the source profile", async () => {
  jest.mocked(getRolePermissions).mockResolvedValue({
    roleId: "role",
    version: 4,
    grants: [
      { permissionId: "products", actions: ["read", "admin"] },
      { permissionId: "platform", actions: ["admin"] },
    ],
    canEditPermissions: false,
  });
  jest.mocked(createCompanyRole).mockResolvedValue({ ...role, id: "copy" });
  render(<RolesPanel state={state({ roles: [{ ...role, isCustom: false, isSystem: true }] })} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Crear copia" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Crear copia" }));
  await screen.findByRole("checkbox", { name: "Ver en Productos" });
  fireEvent.click(screen.getByRole("button", { name: "Guardar rol" }));
  await waitFor(() =>
    expect(createCompanyRole).toHaveBeenCalledWith(
      expect.objectContaining({ grants: [{ permissionId: "products", actions: ["read"] }] }),
    ),
  );
});
