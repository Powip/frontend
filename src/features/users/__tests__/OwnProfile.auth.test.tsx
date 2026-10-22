import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { InternalAxiosRequestConfig } from "axios";
import OwnProfilePage from "@/app/configuracion/editar-usuario/page";
import axiosAuth from "@/lib/axiosAuth";
import { tokenStore } from "@/lib/tokenStore";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { user: { id: "self" } }, logout: jest.fn() }),
}));
jest.mock("@/components/header/HeaderConfig", () => ({
  HeaderConfig: () => <h1>Datos Personales</h1>,
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const originalAdapter = axiosAuth.defaults.adapter;
afterEach(() => {
  axiosAuth.defaults.adapter = originalAdapter;
  tokenStore.set(null);
});

test("own profile read, save and password change all send the current bearer", async () => {
  tokenStore.set("current-self-token", "self:company");
  const adapter = jest.fn(async (config: InternalAxiosRequestConfig) => ({
    data:
      config.method === "get"
        ? {
            id: "self",
            name: "Ana",
            surname: "Pérez",
            email: "ana@example.com",
            address: "Lima",
            district: "Lima",
            phoneNumber: "900000000",
          }
        : {},
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  }));
  axiosAuth.defaults.adapter = adapter;
  const { container } = render(<OwnProfilePage />);
  await screen.findByDisplayValue("Ana");
  fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
  await waitFor(() =>
    expect(adapter.mock.calls.some(([config]) => config.method === "put")).toBe(true),
  );
  const inputs = container.querySelectorAll('input[type="password"]');
  fireEvent.change(inputs[0], { target: { value: "current-password" } });
  fireEvent.change(inputs[1], { target: { value: "new-password" } });
  fireEvent.change(inputs[2], { target: { value: "new-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));
  await waitFor(() => expect(adapter).toHaveBeenCalledTimes(3));
  expect(adapter.mock.calls.map(([config]) => config.method)).toEqual(["get", "put", "post"]);
  for (const [config] of adapter.mock.calls)
    expect(config.headers.get("Authorization")).toBe("Bearer current-self-token");
});
