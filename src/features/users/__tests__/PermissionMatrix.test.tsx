import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { PermissionMatrix } from "@/components/users/PermissionMatrix";
import type { PermissionCatalog, PermissionGrant } from "../rolesService";

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
          actions: ["read", "admin"],
          delegableActions: ["read", "admin"],
          permissionNames: { read: "VIEW_PRODUCTS", admin: "MANAGE_PRODUCTS" },
        },
        {
          id: "inventory",
          label: "Inventario",
          path: "/inventario",
          actions: ["read"],
          delegableActions: ["read"],
          permissionNames: { read: "VIEW_INVENTORY" },
          requires: [{ permissionId: "products", actions: ["read"] }],
        },
        {
          id: "costs",
          label: "Costos",
          path: "/administracion",
          actions: ["read"],
          delegableActions: [],
          permissionNames: {},
          adminOnly: true,
        },
      ],
    },
  ],
};
function Harness() {
  const [grants, setGrants] = useState<PermissionGrant[]>([]);
  return (
    <>
      <PermissionMatrix caption="Permisos" catalog={catalog} grants={grants} onChange={setGrants} />
      <output data-testid="grants">{JSON.stringify(grants)}</output>
    </>
  );
}
test("shows only real actions and protects admin-only cells", () => {
  render(<Harness />);
  expect(screen.getByLabelText("Editar no disponible en Productos")).toHaveTextContent("—");
  expect(screen.getByRole("checkbox", { name: "Ver en Costos" })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: "Admin en Productos" })).toBeEnabled();
});
test("inventory selection includes required catalog read; removing dependency removes dependent", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Ver en Inventario" }));
  expect(screen.getByRole("checkbox", { name: "Ver en Productos" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Ver en Inventario" })).toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: "Ver en Productos" }));
  expect(screen.getByRole("checkbox", { name: "Ver en Inventario" })).not.toBeChecked();
});
test("section select-all excludes protected grants and supports deselection", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar sección Catálogo" }));
  expect(screen.getByRole("checkbox", { name: "Admin en Productos" })).toBeChecked();
  expect(screen.getByRole("checkbox", { name: "Ver en Costos" })).not.toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: "Seleccionar sección Catálogo" }));
  expect(screen.getByTestId("grants")).toHaveTextContent("[]");
});
