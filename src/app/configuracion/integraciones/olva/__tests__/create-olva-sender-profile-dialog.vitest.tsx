import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toOlvaSenderProfile } from "@/features/olva/olva-sender-profile/mappers/to-olva-sender-profile";
import { buildBusinessError } from "@/features/olva/olva-sender-profile/test-utils/axios-error";
import { buildOlvaSenderProfileResponse } from "@/features/olva/olva-sender-profile/test-utils/olva-sender-profile.fixtures";
import { CreateOlvaSenderProfileDialog } from "../_components/create-olva-sender-profile-dialog";

const { createOlvaSenderProfile, getOlvaSenderProfiles } = vi.hoisted(() => ({
  createOlvaSenderProfile: vi.fn(),
  getOlvaSenderProfiles: vi.fn(),
}));

vi.mock("@/features/olva/olva-sender-profile/services/olva-sender-profile.service", () => ({
  createOlvaSenderProfile,
  getOlvaSenderProfiles,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function renderDialog() {
  const onOpenChange = vi.fn();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <CreateOlvaSenderProfileDialog open onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );

  return { onOpenChange, user: userEvent.setup({ delay: null }) };
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Nombre del remitente"), "Almacén principal");
  await user.type(screen.getByLabelText("RUC"), "20616141971");
  await user.type(screen.getByLabelText("Nombres"), "Maria Fernanda");
  await user.type(screen.getByLabelText("Apellido"), "Quispe Rojas");
  await user.type(screen.getByLabelText("Correo"), "remitente@empresa.com");
}

describe("CreateOlvaSenderProfileDialog", () => {
  beforeEach(() => {
    createOlvaSenderProfile.mockResolvedValue(
      toOlvaSenderProfile(buildOlvaSenderProfileResponse()),
    );
    // By default the company already has a profile, so the new one is not the first
    getOlvaSenderProfiles.mockResolvedValue([
      toOlvaSenderProfile(buildOlvaSenderProfileResponse()),
    ]);
  });

  it("shows a message under every empty required field and does not submit", async () => {
    const { user } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Crear remitente" }));

    expect(await screen.findByText("El RUC es obligatorio")).toBeInTheDocument();
    expect(screen.getByText("El nombre del remitente es obligatorio")).toBeInTheDocument();
    expect(screen.getByText("Los nombres son obligatorios")).toBeInTheDocument();
    expect(screen.getByText("El apellido es obligatorio")).toBeInTheDocument();
    expect(screen.getByText("El correo es obligatorio")).toBeInTheDocument();
    expect(createOlvaSenderProfile).not.toHaveBeenCalled();
  });

  it("keeps only digits in the RUC input", async () => {
    const { user } = renderDialog();

    await user.type(screen.getByLabelText("RUC"), "20-616 141a971");

    expect(screen.getByLabelText("RUC")).toHaveValue("20616141971");
  });

  it("creates the profile and closes the dialog", async () => {
    const { user, onOpenChange } = renderDialog();

    await fillValidForm(user);
    await user.click(screen.getByRole("switch", { name: "Remitente predeterminado" }));
    await user.click(screen.getByRole("button", { name: "Crear remitente" }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(createOlvaSenderProfile.mock.calls[0][0]).toMatchObject({
      ruc: "20616141971",
      isDefault: true,
    });
  });

  it("shows a duplicate RUC under the RUC input and keeps the dialog open", async () => {
    createOlvaSenderProfile.mockRejectedValue(
      buildBusinessError(409, "SENDER_PROFILE_DUPLICATE_RUC"),
    );
    const { user, onOpenChange } = renderDialog();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Crear remitente" }));

    expect(
      await screen.findByText("Ya tienes un remitente registrado con ese RUC."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("RUC")).toHaveAttribute("aria-invalid", "true");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("locks the form and cannot be cancelled while the request is in flight", async () => {
    createOlvaSenderProfile.mockReturnValue(new Promise(() => {}));
    const { user, onOpenChange } = renderDialog();

    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: "Crear remitente" }));

    expect(await screen.findByRole("button", { name: /Verificando RUC/ })).toBeDisabled();
    expect(screen.getByLabelText("RUC")).toBeDisabled();

    await user.keyboard("{Escape}");

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("closes from Cancelar", async () => {
    const { user, onOpenChange } = renderDialog();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  describe("default switch", () => {
    const defaultSwitch = () => screen.getByRole("switch", { name: "Remitente predeterminado" });

    it("is enabled and off when the company already has profiles", async () => {
      renderDialog();

      await waitFor(() => expect(getOlvaSenderProfiles).toHaveBeenCalled());

      expect(defaultSwitch()).toBeEnabled();
      expect(defaultSwitch()).not.toBeChecked();
    });

    it("is locked on for the company's first profile, which is sent as the default", async () => {
      getOlvaSenderProfiles.mockResolvedValue([]);
      const { user } = renderDialog();

      await waitFor(() => expect(defaultSwitch()).toBeDisabled());
      expect(defaultSwitch()).toBeChecked();
      expect(
        screen.getByText("Será tu remitente predeterminado por ser el primero."),
      ).toBeInTheDocument();

      await fillValidForm(user);
      await user.click(screen.getByRole("button", { name: "Crear remitente" }));

      await waitFor(() => expect(createOlvaSenderProfile).toHaveBeenCalled());
      expect(createOlvaSenderProfile.mock.calls[0][0]).toMatchObject({ isDefault: true });
    });
  });
});
