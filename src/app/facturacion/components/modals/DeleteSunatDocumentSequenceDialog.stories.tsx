import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, screen, userEvent } from "storybook/test";
import { sunatDocumentSequenceHandlers } from "@/mocks/handlers/sunat-document-sequence.handlers";
import { DeleteSunatDocumentSequenceDialog } from "./DeleteSunatDocumentSequenceDialog";

const meta = {
  title: "Facturación/DeleteSunatDocumentSequenceDialog",
  component: DeleteSunatDocumentSequenceDialog,
  parameters: {
    msw: { handlers: [sunatDocumentSequenceHandlers.deleteSuccess] },
  },
  args: {
    isOpen: true,
    onClose: fn(),
  },
} satisfies Meta<typeof DeleteSunatDocumentSequenceDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

// The AlertDialog renders in a portal outside the story canvas, so query through `screen`
async function confirmDelete() {
  await userEvent.click(await screen.findByRole("button", { name: /eliminar serie/i }));
}

export const NonDefaultSeries: Story = {
  args: {
    documentTypeLabel: "Nota de Crédito Electrónica",
    sequence: {
      companyId: "company-001",
      rucIssuer: "20616141971",
      taxDocumentType: "07",
      series: "FC01",
      nextCorrelative: 3,
      isDefault: false,
    },
  },
};

/**
 * The dialog surfaces an extra warning when the series being deleted is
 * the current default for its document type, since the backend doesn't
 * auto-promote another series to fill that gap.
 */
export const DefaultSeriesShowsWarning: Story = {
  args: {
    documentTypeLabel: "Factura Electrónica",
    sequence: {
      companyId: "company-001",
      rucIssuer: "20616141971",
      taxDocumentType: "01",
      series: "F001",
      nextCorrelative: 43,
      isDefault: true,
    },
  },
};

export const ConfirmDeleteSuccess: Story = {
  args: {
    documentTypeLabel: "Nota de Crédito Electrónica",
    sequence: {
      companyId: "company-001",
      rucIssuer: "20616141971",
      taxDocumentType: "07",
      series: "FC01",
      nextCorrelative: 3,
      isDefault: false,
    },
  },
  play: confirmDelete,
};

export const ConfirmDeleteNotFound: Story = {
  args: {
    documentTypeLabel: "Nota de Crédito Electrónica",
    sequence: {
      companyId: "company-001",
      rucIssuer: "20616141971",
      taxDocumentType: "07",
      series: "FC01",
      nextCorrelative: 3,
      isDefault: false,
    },
  },
  parameters: {
    msw: { handlers: [sunatDocumentSequenceHandlers.deleteNotFound] },
  },
  play: confirmDelete,
};
