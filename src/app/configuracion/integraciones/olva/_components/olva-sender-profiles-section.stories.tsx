import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";
import {
  createStatefulOlvaSenderProfileHandlers,
  olvaSenderProfileHandlers,
} from "@/mocks/handlers/olva-sender-profile.handlers";
import { OlvaSenderProfilesSection } from "./olva-sender-profiles-section";

const meta = {
  title: "Configuración/Integraciones/Olva/OlvaSenderProfilesSection",
  component: OlvaSenderProfilesSection,
  parameters: {
    layout: "padded",
    msw: { handlers: [olvaSenderProfileHandlers.listWithProfiles] },
  },
} satisfies Meta<typeof OlvaSenderProfilesSection>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithProfiles: Story = {};

export const Empty: Story = {
  parameters: { msw: { handlers: [olvaSenderProfileHandlers.listEmpty] } },
};

/** The "Nuevo remitente" button opens the creation dialog. */
export const OpensCreateDialog: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const button = await canvas.findByRole("button", { name: /Nuevo remitente/ });

    // The button stays disabled until the list has loaded
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);

    await expect(
      await screen.findByRole("dialog", { name: "Nuevo remitente" }),
    ).toBeInTheDocument();
  },
};

/** Only non-default profiles offer "Hacer predeterminado" and "Eliminar". */
export const ActionsOnlyOnNonDefaultProfiles: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await canvas.findByText("Tienda Miraflores");

    await expect(canvas.getAllByRole("button", { name: /Hacer predeterminado/ })).toHaveLength(1);
    await expect(canvas.getAllByRole("button", { name: /^Eliminar/ })).toHaveLength(1);
    await expect(
      canvas.queryByRole("button", { name: "Hacer predeterminado: Almacén principal" }),
    ).not.toBeInTheDocument();
  },
};

/** Making another profile the default moves the badge and removes its own actions. */
export const SetsDefault: Story = {
  parameters: { msw: { handlers: createStatefulOlvaSenderProfileHandlers() } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      await canvas.findByRole("button", { name: "Hacer predeterminado: Tienda Miraflores" }),
    );

    await waitFor(() =>
      expect(
        canvas.queryByRole("button", { name: "Hacer predeterminado: Tienda Miraflores" }),
      ).not.toBeInTheDocument(),
    );
    await expect(
      await canvas.findByRole("button", { name: "Hacer predeterminado: Almacén principal" }),
    ).toBeInTheDocument();
  },
};

/** Deleting asks for confirmation first, then removes the profile from the list. */
export const ArchivesProfile: Story = {
  parameters: { msw: { handlers: createStatefulOlvaSenderProfileHandlers() } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      await canvas.findByRole("button", { name: "Eliminar: Tienda Miraflores" }),
    );

    const dialog = within(await screen.findByRole("alertdialog"));
    await expect(dialog.getByText("Eliminar remitente")).toBeInTheDocument();

    await userEvent.click(dialog.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(canvas.queryByText("Tienda Miraflores")).not.toBeInTheDocument());
  },
};

export const CancelsArchive: Story = {
  parameters: { msw: { handlers: createStatefulOlvaSenderProfileHandlers() } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      await canvas.findByRole("button", { name: "Eliminar: Tienda Miraflores" }),
    );
    await userEvent.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancelar" }),
    );

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    await expect(canvas.getByText("Tienda Miraflores")).toBeInTheDocument();
  },
};

/** The dialog stays open while the request is in flight. */
export const ArchiveSubmitting: Story = {
  parameters: {
    msw: {
      handlers: [
        olvaSenderProfileHandlers.listWithProfiles,
        olvaSenderProfileHandlers.archivePending,
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      await canvas.findByRole("button", { name: "Eliminar: Tienda Miraflores" }),
    );

    const dialog = within(await screen.findByRole("alertdialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Eliminar" }));

    await expect(await dialog.findByRole("button", { name: /Eliminando/ })).toBeDisabled();
  },
};
