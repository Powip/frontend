import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PendingIntegrationNotice } from "./PendingIntegrationNotice";

const meta = {
  title: "WhatsApp/PendingIntegrationNotice",
  component: PendingIntegrationNotice,
  parameters: { layout: "padded" },
  args: {
    title: "Conversaciones · pendiente de integración",
    description: "Esta sección se activará cuando el backend de WhatsApp esté disponible.",
    items: ["Tablero por estado del mensaje", "Lista", "Chat por pedido"],
  },
} satisfies Meta<typeof PendingIntegrationNotice>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithSections: Story = {};

export const TitleOnly: Story = {
  args: { description: undefined, items: undefined },
};
