import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { sunatDocumentSequenceHandlers } from "@/mocks/handlers/identity-lookup.handlers";
import { SeriesTab } from "./SeriesTab";

const meta = {
  title: "Facturación/SeriesTab",
  component: SeriesTab,
  parameters: {
    // Mixed state by default: some series configured and defaulted, one
    // configured but not default (so "Marcar" has something to do), one
    // left unconfigured (so the "No configurado" cells render too).
    msw: { handlers: [sunatDocumentSequenceHandlers.mixedList] },
  },
} satisfies Meta<typeof SeriesTab>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MixedConfiguration: Story = {};

export const Loading: Story = {
  parameters: {
    msw: { handlers: [sunatDocumentSequenceHandlers.listPending] },
  },
};

export const NothingConfiguredYet: Story = {
  parameters: {
    msw: { handlers: [sunatDocumentSequenceHandlers.emptyList] },
  },
};

export const FailedToLoad: Story = {
  parameters: {
    msw: { handlers: [sunatDocumentSequenceHandlers.listError] },
  },
};

/**
 * Clicking "Marcar" on the non-default Nota de Crédito row should promote
 * it to default without a confirmation step (unlike delete, this isn't
 * destructive - the backend flips it atomically).
 */
export const SetDefaultSeries: Story = {
  parameters: {
    msw: {
      handlers: [
        sunatDocumentSequenceHandlers.mixedList,
        sunatDocumentSequenceHandlers.setDefaultSuccess,
      ],
    },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /marcar/i }));
  },
};

/**
 * Clicking "Agregar serie" opens the same modal used for "Gestionar", but
 * in add-new-series mode: no fixed (taxDocumentType, series) pair is
 * passed in, so the document-type Select and series Input render editable.
 */
export const OpenAddSeriesModal: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /agregar serie/i }));
  },
};

/**
 * Opens the delete confirmation dialog for a configured row (Nota de
 * Crédito) - the "Eliminar" button on unconfigured rows stays disabled and
 * is covered by NothingConfiguredYet instead.
 */
export const OpenDeleteConfirmation: Story = {
  parameters: {
    msw: {
      handlers: [
        sunatDocumentSequenceHandlers.mixedList,
        sunatDocumentSequenceHandlers.deleteSuccess,
      ],
    },
  },
  play: async ({ canvas, userEvent }) => {
    const deleteButtons = await canvas.findAllByTitle("Eliminar serie");

    await userEvent.click(deleteButtons[0]);
  },
};
