import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import {
  publicTrackingAgencyIncidentFixture,
  publicTrackingFixture,
  publicTrackingIncompleteFixture,
} from "@/mocks/whatsapp/whatsapp-integrations.fixtures";
import { PublicTrackingPage } from "./PublicTrackingPage";

const meta = {
  title: "WhatsApp/Publico/PublicTrackingPage",
  component: PublicTrackingPage,
  parameters: { layout: "fullscreen" },
  args: { state: { kind: "pending-integration" } },
} satisfies Meta<typeof PublicTrackingPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PendingIntegration: Story = {};
export const Loading: Story = { args: { state: { kind: "loading" } } };
export const InvalidOrExpiredLink: Story = { args: { state: { kind: "not-found" } } };
export const LoadError: Story = {
  args: {
    state: { kind: "error", message: "Revisa tu conexión e inténtalo de nuevo." },
    onRetry: fn(),
  },
};
export const DeliveredWithEvidenceAndInvoice: Story = {
  args: { state: { kind: "ready", data: publicTrackingFixture } },
};
export const AgencyWithIncident: Story = {
  args: { state: { kind: "ready", data: publicTrackingAgencyIncidentFixture } },
};
export const IncompleteData: Story = {
  args: { state: { kind: "ready", data: publicTrackingIncompleteFixture } },
};
