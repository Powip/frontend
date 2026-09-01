import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { identityLookupHandlers } from "@/mocks/handlers/identity-lookup.handlers";
import { VerifyIdentityButton } from "./VerifyIdentityButton";

const meta = {
  title: "Facturación/VerifyIdentityButton",
  component: VerifyIdentityButton,
  parameters: {
    // Default to the success handler so every story is interactive
    // out of the box; individual stories override to show other states.
    msw: { handlers: [identityLookupHandlers.success] },
  },
  args: {
    onVerified: fn(),
  },
} satisfies Meta<typeof VerifyIdentityButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DniReadyToVerify: Story = {
  args: {
    documentType: "DNI",
    documentNumber: "44070820",
  },
};

export const RucReadyToVerify: Story = {
  args: {
    documentType: "RUC",
    documentNumber: "20616141971",
  },
};

/**
 * Below the 8-digit DNI threshold: the button stays disabled and the
 * tooltip explains why, without ever calling the API.
 */
export const InvalidFormatDisabled: Story = {
  args: {
    documentType: "DNI",
    documentNumber: "123",
  },
};

/**
 * Carnet de Extranjería / Pasaporte have no RENIEC/SUNAT lookup provider -
 * toIdentityLookupDocumentType returns null for those, which this
 * component renders as the disabled "próximamente" state.
 */
export const UnsupportedDocumentType: Story = {
  args: {
    documentType: null,
    documentNumber: null,
  },
};

export const LoadingWhileVerifying: Story = {
  args: {
    documentType: "DNI",
    documentNumber: "44070820",
  },
  parameters: {
    msw: { handlers: [identityLookupHandlers.pending] },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button"));
  },
};

export const NotFoundError: Story = {
  args: {
    documentType: "DNI",
    documentNumber: "99999999",
  },
  parameters: {
    msw: { handlers: [identityLookupHandlers.notFound] },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button"));
  },
};

export const RateLimitedError: Story = {
  args: {
    documentType: "RUC",
    documentNumber: "20616141971",
  },
  parameters: {
    msw: { handlers: [identityLookupHandlers.rateLimited] },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button"));
  },
};

export const ProviderUnavailableError: Story = {
  args: {
    documentType: "RUC",
    documentNumber: "20616141971",
  },
  parameters: {
    msw: { handlers: [identityLookupHandlers.providerUnavailable] },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button"));
  },
};
