import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn, screen, userEvent } from "storybook/test";
import { sunatDocumentSequenceHandlers } from "@/mocks/handlers/sunat-document-sequence.handlers";
import { ManageSunatDocumentSequenceModal } from "./ManageSunatDocumentSequenceModal";

const EXISTING_SEQUENCES = [
  {
    companyId: "company-001",
    rucIssuer: "20616141971",
    taxDocumentType: "01" as const,
    series: "F001",
    nextCorrelative: 101,
    isDefault: true,
  },
  {
    companyId: "company-001",
    rucIssuer: "20616141971",
    taxDocumentType: "03" as const,
    series: "B001",
    nextCorrelative: 1,
    isDefault: true,
  },
];

const meta = {
  title: "Facturación/ManageSunatDocumentSequenceModal",
  component: ManageSunatDocumentSequenceModal,
  parameters: {
    msw: { handlers: [sunatDocumentSequenceHandlers.initializeSuccess] },
  },
  args: {
    isOpen: true,
    onClose: fn(),
    existingSequences: EXISTING_SEQUENCES,
  },
} satisfies Meta<typeof ManageSunatDocumentSequenceModal>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * `definition: null` is what puts the modal in "add a brand-new series"
 * mode: the document-type Select and series Input become editable instead
 * of static text, and it opens with no correlative filled in.
 */
export const AddNewSeries: Story = {
  args: {
    definition: null,
    sequence: null,
  },
};

/**
 * Picking a document type that already has an existing series (e.g.
 * Factura, which has F001 above) auto-suggests the next code - F002 - so
 * the user doesn't have to work it out by hand.
 */
export const AddNewSeriesSuggestsNextCode: Story = {
  args: {
    definition: null,
    sequence: null,
  },
  // The dialog and the Select options render in portals outside the story canvas, so query through `screen`
  play: async () => {
    await userEvent.click(await screen.findByRole("combobox", { name: /tipo de documento/i }));
    await userEvent.click(await screen.findByRole("option", { name: /factura electrónica/i }));
  },
};

export const ManageExistingSeries: Story = {
  args: {
    definition: { taxDocumentType: "01", series: "F001" },
    sequence: EXISTING_SEQUENCES[0],
  },
};
