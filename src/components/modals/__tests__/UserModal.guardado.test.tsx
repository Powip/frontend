import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/services/userService", () => ({
  getRoles: jest.fn(),
  createCompanyUser: jest.fn(),
  updateUser: jest.fn(),
}));
jest.mock("@/components/ui/select", () => {
  const R = jest.requireActual("react");
  const SelectTrigger = ({ id }: { id?: string }) => R.createElement("span", { "data-trigger-id": id });
  const SelectContent = ({ children }: { children?: React.ReactNode }) =>
    R.createElement(R.Fragment, null, children);
  const SelectItem = (
    { value, children, disabled }: { value: string; children?: React.ReactNode; disabled?: boolean },
  ) => R.createElement("option", { value, disabled }, children);
  const Select = ({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    disabled?: boolean;
    children?: React.ReactNode;
  }) => {
    const kids = R.Children.toArray(children) as React.ReactElement<{ id?: string; children?: React.ReactNode }>[];
    const trigger = kids.find((c) => c.type === SelectTrigger);
    const content = kids.find((c) => c.type === SelectContent);
    return R.createElement(
      "select",
      {
        "aria-label": trigger?.props.id ?? "select",
        value: value ?? "",
        disabled,
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onValueChange?.(e.target.value),
      },
      R.createElement("option", { value: "" }, "—"),
      content?.props.children,
    );
  };
  return { Select, SelectTrigger, SelectContent, SelectItem, SelectValue: () => null };
});

import { StrictMode } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getRoles, updateUser } from "@/services/userService";
import UserModal from "../UserModal";
import type { User } from "@/interfaces/IUser";

const mockUpdate = jest.mocked(updateUser);

const USER_A: User = {
  id: "u-a",
  identityDocument: "11111111",
  name: "Ana",
  surname: "Torres",
  email: "ana@empresa.com",
  status: true,
  role: { id: "r-ventas", name: "VENTAS" },
};

const USER_B: User = {
  ...USER_A,
  id: "u-b",
  identityDocument: "22222222",
  name: "Luis",
  surname: "Paz",
  email: "luis@empresa.com",
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useAuth).mockReturnValue({
    auth: { accessToken: "token", company: { id: "company-1" }, user: { id: "admin-1", role: "ADMINISTRADOR" } },
  } as unknown as ReturnType<typeof useAuth>);
  jest.mocked(getRoles).mockResolvedValue([{ id: "r-ventas", name: "VENTAS" }]);
});

const pendingUpdates = () => {
  const resolvers: Array<(value: unknown) => void> = [];
  const rejecters: Array<(reason: unknown) => void> = [];
  mockUpdate.mockImplementation(
    () =>
      new Promise((resolve, reject) => {
        resolvers.push(resolve);
        rejecters.push(reject);
      }),
  );
  return { resolvers, rejecters };
};

const roleReady = () =>
  waitFor(() =>
    expect(screen.queryByRole("combobox", { name: "Rol" }) ?? screen.getByRole("group", { name: "Rol" })).toBeEnabled(),
  );
const pressEscape = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
const closeButton = () => screen.queryByRole("button", { name: "Close" });
const clickOutside = () => {
  const overlay = document.querySelector('[data-slot="dialog-overlay"]') as HTMLElement;
  expect(overlay).toBeInTheDocument();
  fireEvent.pointerDown(overlay);
  fireEvent.mouseDown(overlay);
};

function renderModal(user: User | null, props: Partial<React.ComponentProps<typeof UserModal>> = {}) {
  const onClose = jest.fn();
  const onUserSaved = jest.fn();
  const utils = render(
    <UserModal open user={user} onClose={onClose} onUserSaved={onUserSaved} {...props} />,
  );
  return { ...utils, onClose, onUserSaved };
}

describe("UserModal — guardado pendiente", () => {
  it("sin guardado en curso se puede cerrar con Esc y con la X", async () => {
    const { onClose } = renderModal(USER_A);
    await roleReady();

    expect(closeButton()).toBeInTheDocument();
    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(closeButton() as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("mientras guarda bloquea Cancelar, X, Esc, clic afuera y un segundo envío", async () => {
    const { resolvers } = pendingUpdates();
    const { onClose, onUserSaved } = renderModal(USER_A);
    await roleReady();

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    const saving = await screen.findByRole("button", { name: "Guardando..." });
    expect(saving).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(closeButton()).not.toBeInTheDocument();

    pressEscape();
    clickOutside();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.submit(saving.closest("form") as HTMLFormElement);

    expect(onClose).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    resolvers[0]({});

    await waitFor(() => expect(onUserSaved).toHaveBeenCalledTimes(1));
    expect(closeButton()).toBeInTheDocument();
    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("si el guardado falla, vuelve a permitir cerrar sin reportar éxito", async () => {
    const { rejecters } = pendingUpdates();
    const { onClose, onUserSaved } = renderModal(USER_A);
    await roleReady();

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByRole("button", { name: "Guardando..." });

    rejecters[0]({ response: { data: { message: "Error de ms-auth" } } });

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Error de ms-auth"));
    expect(onUserSaved).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("el guardado de un usuario anterior no cierra ni bloquea el formulario de otro", async () => {
    const { resolvers } = pendingUpdates();
    const { onClose, onUserSaved, rerender } = renderModal(USER_A);
    await roleReady();
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByRole("button", { name: "Guardando..." });

    rerender(<UserModal open user={USER_B} onClose={onClose} onUserSaved={onUserSaved} />);

    await waitFor(() => expect(screen.getByLabelText("Nombre")).toHaveValue("Luis"));
    await roleReady();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
    expect(closeButton()).toBeInTheDocument();

    resolvers[0]({});

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Usuario actualizado exitosamente"));
    expect(onUserSaved).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Luis");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();

    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("si el padre cierra durante el guardado, al reabrir el mismo usuario no queda bloqueado", async () => {
    const { resolvers } = pendingUpdates();
    const { onClose, onUserSaved, rerender } = renderModal(USER_A);
    await roleReady();
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByRole("button", { name: "Guardando..." });

    rerender(<UserModal open={false} user={USER_A} onClose={onClose} onUserSaved={onUserSaved} />);
    rerender(<UserModal open user={USER_A} onClose={onClose} onUserSaved={onUserSaved} />);

    await roleReady();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
    expect(closeButton()).toBeInTheDocument();

    resolvers[0]({});

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Usuario actualizado exitosamente"));
    expect(onUserSaved).not.toHaveBeenCalled();
    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("en StrictMode bloquea durante el guardado y lo libera una sola vez al terminar", async () => {
    const { resolvers } = pendingUpdates();
    const onClose = jest.fn();
    const onUserSaved = jest.fn();
    render(
      <StrictMode>
        <UserModal open user={USER_A} onClose={onClose} onUserSaved={onUserSaved} />
      </StrictMode>,
    );
    await roleReady();
    expect(closeButton()).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByRole("button", { name: "Guardando..." });
    expect(closeButton()).not.toBeInTheDocument();
    pressEscape();
    expect(onClose).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    resolvers[0]({});

    await waitFor(() => expect(onUserSaved).toHaveBeenCalledTimes(1));
    expect(closeButton()).toBeInTheDocument();
    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("al cambiar de usuario con el modal abierto, el nuevo formulario arranca sin bloqueo y puede guardar", async () => {
    const { resolvers } = pendingUpdates();
    const { onClose, onUserSaved, rerender } = renderModal(USER_A);
    await roleReady();
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByRole("button", { name: "Guardando..." });

    rerender(<UserModal open user={USER_B} onClose={onClose} onUserSaved={onUserSaved} />);
    await waitFor(() => expect(screen.getByLabelText("Nombre")).toHaveValue("Luis"));
    await roleReady();

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await screen.findByRole("button", { name: "Guardando..." });
    expect(closeButton()).not.toBeInTheDocument();

    resolvers[0]({});
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Guardando..." })).toBeDisabled();
    expect(closeButton()).not.toBeInTheDocument();
    pressEscape();
    expect(onClose).not.toHaveBeenCalled();
    expect(onUserSaved).not.toHaveBeenCalled();

    resolvers[1]({});
    await waitFor(() => expect(onUserSaved).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[1][0]).toBe("u-b");
    expect(closeButton()).toBeInTheDocument();
  });
});
