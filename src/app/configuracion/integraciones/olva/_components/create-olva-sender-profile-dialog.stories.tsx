import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";
import { olvaSenderProfileHandlers } from "@/mocks/handlers/olva-sender-profile.handlers";
import { CreateOlvaSenderProfileDialog } from "./create-olva-sender-profile-dialog";

const meta = {
  title: "Configuración/Integraciones/Olva/CreateOlvaSenderProfileDialog",
  component: CreateOlvaSenderProfileDialog,
  parameters: {
    layout: "fullscreen",
    msw: {
      handlers: [
        olvaSenderProfileHandlers.listWithProfiles,
        olvaSenderProfileHandlers.createSuccess,
      ],
    },
  },
  args: {
    open: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof CreateOlvaSenderProfileDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

// The dialog renders in a portal, so queries go through `screen` instead of the story canvas
async function fillValidForm() {
  const dialog = within(await screen.findByRole("dialog"));

  await userEvent.type(dialog.getByLabelText("Nombre del remitente"), "Almacén principal");
  await userEvent.type(dialog.getByLabelText("RUC"), "20616141971");
  await userEvent.type(dialog.getByLabelText("Nombres"), "Maria Fernanda");
  await userEvent.type(dialog.getByLabelText("Apellido"), "Quispe Rojas");
  await userEvent.type(dialog.getByLabelText("Correo"), "remitente@empresa.com");

  return dialog;
}

export const Empty: Story = {};

/** With other profiles already created, the user decides whether this one becomes the default. */
export const DefaultSwitchEnabled: Story = {
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    const defaultSwitch = dialog.getByRole("switch", { name: "Remitente predeterminado" });

    await expect(defaultSwitch).toBeEnabled();
    await expect(defaultSwitch).not.toBeChecked();
  },
};

/** The company's first profile is always the default, so the switch is locked on. */
export const FirstProfile: Story = {
  parameters: {
    msw: {
      handlers: [olvaSenderProfileHandlers.listEmpty, olvaSenderProfileHandlers.createSuccess],
    },
  },
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    const defaultSwitch = dialog.getByRole("switch", { name: "Remitente predeterminado" });

    await waitFor(() => expect(defaultSwitch).toBeDisabled());
    await expect(defaultSwitch).toBeChecked();
  },
};

export const ValidationErrors: Story = {
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));

    await userEvent.click(dialog.getByRole("button", { name: "Crear remitente" }));

    await expect(await dialog.findByText("El RUC es obligatorio")).toBeInTheDocument();
  },
};

export const InvalidRuc: Story = {
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));

    await userEvent.type(dialog.getByLabelText("RUC"), "20616141972");
    await userEvent.tab();

    await expect(await dialog.findByText("El RUC no es válido")).toBeInTheDocument();
  },
};

export const CreatesProfile: Story = {
  play: async ({ args }) => {
    const dialog = await fillValidForm();

    await userEvent.click(dialog.getByRole("button", { name: "Crear remitente" }));

    await waitFor(() => expect(args.onOpenChange).toHaveBeenCalledWith(false));
  },
};

export const Submitting: Story = {
  parameters: { msw: { handlers: [olvaSenderProfileHandlers.createPending] } },
  play: async () => {
    const dialog = await fillValidForm();

    await userEvent.click(dialog.getByRole("button", { name: "Crear remitente" }));

    await expect(await dialog.findByRole("button", { name: /Verificando RUC/ })).toBeDisabled();
  },
};

export const DuplicateRuc: Story = {
  parameters: { msw: { handlers: [olvaSenderProfileHandlers.createDuplicateRuc] } },
  play: async () => {
    const dialog = await fillValidForm();

    await userEvent.click(dialog.getByRole("button", { name: "Crear remitente" }));

    await expect(
      await dialog.findByText("Ya tienes un remitente registrado con ese RUC."),
    ).toBeInTheDocument();
  },
};

export const RucNotFoundInOlva: Story = {
  parameters: { msw: { handlers: [olvaSenderProfileHandlers.createRucNotFound] } },
  play: async () => {
    const dialog = await fillValidForm();

    await userEvent.click(dialog.getByRole("button", { name: "Crear remitente" }));

    await expect(await dialog.findByText(/Olva no encontró ese RUC/)).toBeInTheDocument();
  },
};
